import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAttemptSessionFromRequest } from "@/lib/auth/attempt-session";
import { remainingMs } from "@/lib/time";
import { asIdeConfig } from "@/lib/code-runner/ide-config";
import { RunRequestSchema, runIdeQuestion } from "@/lib/code-runner/run-service";

/**
 * Runs a CODE_IDE answer during an exam attempt. Same gate as the autosave
 * route: only while the attempt is IN_PROGRESS and not past its deadline.
 * The config (language, entry, read-only files, limits) comes from the
 * Question row — the client only sends files and stdin.
 */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const exam = await prisma.exam.findUnique({ where: { publicToken: params.token } });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  const session = await getAttemptSessionFromRequest(request, params.token, exam.id);
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsedBody = RunRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const attempt = await prisma.examAttempt.findUnique({ where: { id: session.attemptId } });
  if (!attempt) {
    return NextResponse.json({ error: "Intento no encontrado." }, { status: 404 });
  }
  if (attempt.status !== "IN_PROGRESS" || remainingMs(attempt.expiresAt) <= 0) {
    return NextResponse.json({ error: "El examen ya no admite ejecuciones (finalizado, vencido o bloqueado)." }, { status: 409 });
  }

  const question = await prisma.question.findUnique({ where: { id: parsedBody.data.questionId } });
  const config = question && question.examId === exam.id && question.type === "CODE_IDE" ? asIdeConfig(question.ideConfig) : null;
  if (!config) {
    return NextResponse.json({ error: "Pregunta no encontrada." }, { status: 404 });
  }

  return runIdeQuestion({ context: "EXAM", attemptId: attempt.id }, config, parsedBody.data);
}
