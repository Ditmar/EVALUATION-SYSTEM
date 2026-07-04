import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAttemptSessionFromRequest } from "@/lib/auth/attempt-session";
import { AnswerSubmitSchema } from "@/lib/validation/activity-schema";
import { gradeMultipleChoice, gradeSingleChoice } from "@/lib/grading/auto-grade";
import { remainingMs } from "@/lib/time";
import { checkPublicRateLimit } from "@/lib/rate-limit-guard";

export async function PUT(
  request: NextRequest,
  { params }: { params: { token: string; questionId: string } }
) {
  const limited = checkPublicRateLimit(request, "answers");
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

  if (attempt.status !== "IN_PROGRESS" || remainingMs(attempt.expiresAt) <= 0) {
    return NextResponse.json(
      { error: "El examen ya no admite respuestas (finalizado, vencido o bloqueado)." },
      { status: 409 }
    );
  }

  const question = await prisma.question.findUnique({ where: { id: params.questionId } });
  if (!question || question.examId !== exam.id) {
    return NextResponse.json({ error: "Pregunta no encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AnswerSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Respuesta inválida." }, { status: 400 });
  }

  let selectedOption: string | undefined;
  let selectedOptions: string[] | undefined;
  let codeAnswer: string | undefined;
  let isCorrect: boolean | null = null;
  let autoScore: number | null = null;

  if ("selectedOption" in parsed.data) {
    selectedOption = parsed.data.selectedOption;
    if (question.type === "SINGLE_CHOICE") {
      const result = gradeSingleChoice(
        { type: "single_choice", points: question.points, correctAnswer: question.correctAnswer },
        selectedOption
      );
      isCorrect = result.isCorrect;
      autoScore = result.autoScore;
    }
  } else if ("selectedOptions" in parsed.data) {
    selectedOptions = parsed.data.selectedOptions;
    if (question.type === "MULTIPLE_CHOICE") {
      const result = gradeMultipleChoice(
        { type: "multiple_choice", points: question.points, correctAnswers: question.correctAnswers },
        selectedOptions
      );
      isCorrect = result.isCorrect;
      autoScore = result.autoScore;
    }
  } else if ("codeAnswer" in parsed.data) {
    codeAnswer = parsed.data.codeAnswer;
  }

  const answer = await prisma.answer.upsert({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
    create: {
      attemptId: attempt.id,
      questionId: question.id,
      selectedOption,
      selectedOptions,
      codeAnswer,
      isCorrect,
      autoScore,
    },
    update: {
      selectedOption,
      selectedOptions,
      codeAnswer,
      isCorrect,
      autoScore,
    },
  });

  return NextResponse.json({ ok: true, savedAt: answer.updatedAt });
}
