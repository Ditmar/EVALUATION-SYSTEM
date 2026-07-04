import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: { examId: string; attemptId: string } }
) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const exam = await prisma.exam.findFirst({
    where: { id: params.examId, createdById: auth.session.userId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  const attempt = await prisma.examAttempt.findFirst({
    where: { id: params.attemptId, examId: exam.id },
    include: {
      answers: { include: { aiEvaluations: { orderBy: { createdAt: "desc" } } } },
      activityEvents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!attempt) {
    return NextResponse.json({ error: "Intento no encontrado." }, { status: 404 });
  }

  const answersByQuestionId = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const questions = exam.questions.map((q) => ({
    ...q,
    answer: answersByQuestionId.get(q.id) ?? null,
  }));

  return NextResponse.json({ attempt, questions });
}
