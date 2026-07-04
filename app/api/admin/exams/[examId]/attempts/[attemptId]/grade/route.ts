import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { computeTotalScore } from "@/lib/grading/totals";

const GradeSchema = z.object({
  questionId: z.string().min(1),
  manualScore: z.number().min(0),
  teacherComment: z.string().trim().max(5000).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { examId: string; attemptId: string } }
) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = GradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const exam = await prisma.exam.findFirst({
    where: { id: params.examId, createdById: auth.session.userId },
  });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  const attempt0 = await prisma.examAttempt.findFirst({
    where: { id: params.attemptId, examId: exam.id },
  });
  if (!attempt0) {
    return NextResponse.json({ error: "Intento no encontrado." }, { status: 404 });
  }

  const question = await prisma.question.findFirst({
    where: { id: parsed.data.questionId, examId: exam.id },
  });
  if (!question) {
    return NextResponse.json({ error: "Pregunta no encontrada." }, { status: 404 });
  }

  if (parsed.data.manualScore > question.points) {
    return NextResponse.json(
      { error: `El puntaje no puede superar el máximo de la pregunta (${question.points}).` },
      { status: 400 }
    );
  }

  // Upsert: the student may never have saved an answer for this question (left
  // it blank), in which case no Answer row exists yet. The teacher must still
  // be able to grade it (typically with 0 points) rather than being stuck.
  const updatedAnswer = await prisma.answer.upsert({
    where: { attemptId_questionId: { attemptId: params.attemptId, questionId: question.id } },
    create: {
      attemptId: params.attemptId,
      questionId: question.id,
      manualScore: parsed.data.manualScore,
      teacherComment: parsed.data.teacherComment || null,
      gradedAt: new Date(),
      gradedById: auth.session.userId,
    },
    update: {
      manualScore: parsed.data.manualScore,
      teacherComment: parsed.data.teacherComment || null,
      gradedAt: new Date(),
      gradedById: auth.session.userId,
    },
  });

  const allAnswers = await prisma.answer.findMany({ where: { attemptId: params.attemptId } });
  const totals = computeTotalScore(allAnswers);

  const attempt = await prisma.examAttempt.update({
    where: { id: params.attemptId },
    data: {
      totalAutoScore: totals.totalAutoScore,
      totalManualScore: totals.totalManualScore,
      totalScore: totals.totalScore,
    },
  });

  return NextResponse.json({ answer: updatedAnswer, attempt });
}
