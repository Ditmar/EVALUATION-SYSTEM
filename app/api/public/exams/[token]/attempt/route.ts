import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAttemptSessionFromRequest } from "@/lib/auth/attempt-session";
import { remainingMs } from "@/lib/time";
import { finalizeAttempt } from "@/lib/attempt-finalize";
import { activePenaltyCount } from "@/lib/penalties";
import { countRunsByQuestion } from "@/lib/code-runner/run-service";

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const exam = await prisma.exam.findUnique({
    where: { publicToken: params.token },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  const session = await getAttemptSessionFromRequest(request, params.token, exam.id);
  if (!session) {
    return NextResponse.json(
      { error: "No se encontró un intento activo para este examen en este navegador." },
      { status: 401 }
    );
  }

  let attempt = await prisma.examAttempt.findUnique({ where: { id: session.attemptId } });
  if (!attempt) {
    return NextResponse.json({ error: "Intento no encontrado." }, { status: 404 });
  }

  if (attempt.status === "IN_PROGRESS" && remainingMs(attempt.expiresAt) <= 0) {
    attempt = await finalizeAttempt(attempt.id, "EXPIRED");
  }

  const answers = await prisma.answer.findMany({ where: { attemptId: attempt.id } });
  const answersByQuestionId = new Map(answers.map((a) => [a.questionId, a]));
  const ideRunCounts = exam.questions.some((q) => q.type === "CODE_IDE")
    ? await countRunsByQuestion({ attemptId: attempt.id })
    : {};

  // Never send correctAnswer/correctAnswers/expectedSolution/rubric to the
  // student before submission — only the fields needed to render the question.
  const questions = exam.questions.map((q) => {
    const answer = answersByQuestionId.get(q.id);
    return {
      questionId: q.id,
      type: q.type,
      statement: q.statement,
      points: q.points,
      options: q.options,
      language: q.language,
      // Starter files are part of the statement, not an answer key.
      ideConfig: q.type === "CODE_IDE" ? q.ideConfig : null,
      runsUsed: q.type === "CODE_IDE" ? ideRunCounts[q.id] ?? 0 : undefined,
      currentAnswer: answer
        ? {
            selectedOption: answer.selectedOption,
            selectedOptions: answer.selectedOptions,
            codeAnswer: answer.codeAnswer,
            codeFiles: answer.codeFiles,
          }
        : null,
    };
  });

  return NextResponse.json({
    status: attempt.status,
    remainingMs: remainingMs(attempt.expiresAt),
    penaltyCount: activePenaltyCount(attempt.penaltyCount, attempt.penaltyBaseline),
    reopened: attempt.reopenCount > 0,
    maxPenalties: exam.maxPenalties,
    trackFocusEvents: exam.trackFocusEvents,
    requireScreenCapture: exam.requireScreenCapture,
    screenCaptureIntervalMinutes: exam.screenCaptureIntervalMinutes,
    student: { nombres: attempt.nombres, apellidos: attempt.apellidos, ci: attempt.ci, correo: attempt.correo },
    questions,
  });
}
