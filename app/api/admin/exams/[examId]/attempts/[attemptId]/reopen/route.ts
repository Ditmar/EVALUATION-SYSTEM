import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { computeExpiresAt } from "@/lib/time";
import { isPenalized } from "@/lib/penalties";

const ReopenSchema = z.object({
  minutes: z.number().int().min(1).max(600),
});

/**
 * "Second chance" for an attempt that was closed (SUBMITTED/LOCKED) because
 * it hit the penalty threshold. Flips it back to IN_PROGRESS with a new
 * deadline so the student can resume with their saved answers — the
 * register/start endpoints already resume IN_PROGRESS attempts by CI.
 *
 * Incidents are NOT erased: penaltyCount keeps the full history and
 * penaltyBaseline is moved up to it, giving a fresh budget of maxPenalties.
 * An OTHER activity event is logged so the reopen is visible in the audit trail.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { examId: string; attemptId: string } }
) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const exam = await prisma.exam.findFirst({
    where: { id: params.examId, createdById: auth.session.userId },
  });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ReopenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Indica una cantidad de minutos válida (1 a 600)." }, { status: 400 });
  }

  const attempt = await prisma.examAttempt.findFirst({
    where: { id: params.attemptId, examId: exam.id },
  });
  if (!attempt) {
    return NextResponse.json({ error: "Intento no encontrado." }, { status: 404 });
  }

  if (attempt.status !== "SUBMITTED" && attempt.status !== "LOCKED") {
    return NextResponse.json({ error: "Solo se pueden reabrir intentos enviados o bloqueados." }, { status: 409 });
  }
  if (!isPenalized(attempt.penaltyCount, attempt.penaltyBaseline, exam.maxPenalties)) {
    return NextResponse.json(
      { error: "Solo se pueden reabrir intentos cerrados por alcanzar el máximo de incidencias." },
      { status: 409 }
    );
  }

  const now = new Date();
  const [updated] = await prisma.$transaction([
    prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "IN_PROGRESS",
        submittedAt: null,
        expiresAt: computeExpiresAt(now, parsed.data.minutes),
        penaltyBaseline: attempt.penaltyCount,
        reopenCount: { increment: 1 },
        reopenedAt: now,
      },
    }),
    prisma.activityEvent.create({
      data: {
        attemptId: attempt.id,
        type: "OTHER",
        detail: `Examen reabierto por el docente (segunda oportunidad, ${parsed.data.minutes} min). Incidencias previas conservadas: ${attempt.penaltyCount}.`,
        isPenalty: false,
      },
    }),
  ]);

  return NextResponse.json({ attempt: updated });
}
