import { NextRequest, NextResponse } from "next/server";
import type { ActivityEventType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAttemptSessionFromRequest } from "@/lib/auth/attempt-session";
import { ActivityEventSchema } from "@/lib/validation/activity-schema";
import {
  activePenaltyCount,
  applyPenaltyEvent,
  isPenaltyEvent,
  type OnMaxPenalties,
  type PenaltyEventType,
} from "@/lib/penalties";
import { finalizeAttempt } from "@/lib/attempt-finalize";
import { checkRateLimitByKey } from "@/lib/rate-limit-guard";

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const exam = await prisma.exam.findUnique({ where: { publicToken: params.token } });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  const session = await getAttemptSessionFromRequest(request, params.token, exam.id);
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const limited = checkRateLimitByKey(`attempt:${session.attemptId}`, "activity");
  if (limited) return limited;

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
  // Dejar de compartir pantalla cuenta como incidencia en exámenes con
  // captura obligatoria, aunque el monitoreo de foco esté desactivado.
  const penalizable =
    attempt.status === "IN_PROGRESS" &&
    (exam.trackFocusEvents || (exam.requireScreenCapture && eventType === "screen_share_stopped"));

  // The threshold is evaluated against the active budget (incidents since the
  // last reopen); the lifetime total keeps accumulating in penaltyCount.
  const activeCount = activePenaltyCount(attempt.penaltyCount, attempt.penaltyBaseline);
  const result = penalizable
    ? applyPenaltyEvent(
        activeCount,
        exam.maxPenalties,
        eventType,
        exam.onMaxPenalties.toLowerCase() as OnMaxPenalties
      )
    : { newCount: activeCount, action: "none" as const };

  await prisma.activityEvent.create({
    data: {
      attemptId: attempt.id,
      type: eventType.toUpperCase() as ActivityEventType,
      detail: parsed.data.detail ?? null,
      isPenalty: penalizable && isPenaltyEvent(eventType),
    },
  });

  if (result.newCount !== activeCount) {
    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { penaltyCount: attempt.penaltyBaseline + result.newCount },
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
