import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAttemptSessionFromRequest } from "@/lib/auth/attempt-session";
import { ActivityEventSchema } from "@/lib/validation/activity-schema";
import { applyPenaltyEvent, isPenaltyEvent, type OnMaxPenalties, type PenaltyEventType } from "@/lib/penalties";
import { finalizeAttempt } from "@/lib/attempt-finalize";
import { checkPublicRateLimit } from "@/lib/rate-limit-guard";

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const limited = checkPublicRateLimit(request, "activity");
  if (limited) return limited;

  const exam = await prisma.exam.findUnique({ where: { publicToken: params.token } });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  const session = await getAttemptSessionFromRequest(request, params.token, exam.id);
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const attempt = await prisma.examAttempt.findUnique({ where: { id: session.attemptId } });
  if (!attempt) {
    return NextResponse.json({ error: "Intento no encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ActivityEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }

  const eventType = parsed.data.type as PenaltyEventType;
  const penalizable = attempt.status === "IN_PROGRESS" && exam.trackFocusEvents;

  const result = penalizable
    ? applyPenaltyEvent(
        attempt.penaltyCount,
        exam.maxPenalties,
        eventType,
        exam.onMaxPenalties.toLowerCase() as OnMaxPenalties
      )
    : { newCount: attempt.penaltyCount, action: "none" as const };

  await prisma.activityEvent.create({
    data: {
      attemptId: attempt.id,
      type: eventType.toUpperCase() as
        | "TAB_HIDDEN"
        | "WINDOW_BLUR"
        | "FULLSCREEN_EXIT"
        | "HEARTBEAT"
        | "RECONNECT"
        | "OTHER",
      detail: parsed.data.detail ?? null,
      isPenalty: penalizable && isPenaltyEvent(eventType),
    },
  });

  if (result.newCount !== attempt.penaltyCount) {
    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { penaltyCount: result.newCount },
    });
  }

  if (result.action === "auto_submit") {
    await finalizeAttempt(attempt.id, "SUBMITTED");
  } else if (result.action === "lock") {
    await finalizeAttempt(attempt.id, "LOCKED");
  }

  return NextResponse.json({
    penaltyCount: result.newCount,
    remaining: Math.max(0, exam.maxPenalties - result.newCount),
    action: result.action,
  });
}
