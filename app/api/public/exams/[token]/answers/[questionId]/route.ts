import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAttemptSessionFromRequest } from "@/lib/auth/attempt-session";
import { AnswerSubmitSchema } from "@/lib/validation/activity-schema";
import { gradeMultipleChoice, gradeSingleChoice } from "@/lib/grading/auto-grade";
import { remainingMs } from "@/lib/time";
import { checkRateLimitByKey } from "@/lib/rate-limit-guard";
import type { Prisma } from "@prisma/client";
import { asIdeConfig } from "@/lib/code-runner/ide-config";
import { entryContent, resolveRunFiles } from "@/lib/code-runner/files";

export async function PUT(
  request: NextRequest,
  { params }: { params: { token: string; questionId: string } }
) {
  const exam = await prisma.exam.findUnique({ where: { publicToken: params.token } });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  const session = await getAttemptSessionFromRequest(request, params.token, exam.id);
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const limited = checkRateLimitByKey(`attempt:${session.attemptId}`, "answers");
  if (limited) return limited;

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
  let codeFiles: Prisma.InputJsonValue | undefined;
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
  } else if ("codeFiles" in parsed.data) {
    const config = question.type === "CODE_IDE" ? asIdeConfig(question.ideConfig) : null;
    if (!config) {
      return NextResponse.json({ error: "Respuesta inválida." }, { status: 400 });
    }
    // Same file rules as a run, so what's saved is always runnable/gradable.
    const resolved = resolveRunFiles(config, parsed.data.codeFiles.files);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    const editable = resolved.files.filter((f) => !f.readonly).map(({ name, content }) => ({ name, content }));
    const value = { files: editable, ...(parsed.data.codeFiles.stdin !== undefined ? { stdin: parsed.data.codeFiles.stdin } : {}) };
    codeFiles = value;
    // Legacy column: the entry file, so CSV export and older views keep working.
    codeAnswer = entryContent(config, value);
  }

  const answer = await prisma.answer.upsert({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
    create: {
      attemptId: attempt.id,
      questionId: question.id,
      selectedOption,
      selectedOptions,
      codeAnswer,
      codeFiles,
      isCorrect,
      autoScore,
    },
    update: {
      selectedOption,
      selectedOptions,
      codeAnswer,
      codeFiles,
      isCorrect,
      autoScore,
    },
  });

  return NextResponse.json({ ok: true, savedAt: answer.updatedAt });
}
