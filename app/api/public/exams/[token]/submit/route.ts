import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAttemptSessionFromRequest } from "@/lib/auth/attempt-session";
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

  const limited = checkRateLimitByKey(`attempt:${session.attemptId}`, "submit");
  if (limited) return limited;

  const attempt = await prisma.examAttempt.findUnique({ where: { id: session.attemptId } });
  if (!attempt) {
    return NextResponse.json({ error: "Intento no encontrado." }, { status: 404 });
  }

  if (attempt.status !== "IN_PROGRESS") {
    // Idempotent: submitting twice (e.g. a retried request) just returns the
    // already-finalized state instead of erroring.
    return NextResponse.json({ status: attempt.status, totalAutoScore: attempt.totalAutoScore });
  }

  const updated = await finalizeAttempt(attempt.id, "SUBMITTED");

  return NextResponse.json({ status: updated.status, totalAutoScore: updated.totalAutoScore });
}
