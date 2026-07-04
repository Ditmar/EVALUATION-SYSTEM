import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { computeTotalScore } from "@/lib/grading/totals";

const GradeSchema = z.object({
  answerId: z.string().min(1),
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

  const answer = await prisma.answer.findFirst({
    where: { id: parsed.data.answerId, attemptId: params.attemptId },
    include: { question: true },
  });
  if (!answer) {
    return NextResponse.json({ error: "Respuesta no encontrada." }, { status: 404 });
  }

  if (parsed.data.manualScore > answer.question.points) {
    return NextResponse.json(
      { error: `El puntaje no puede superar el máximo de la pregunta (${answer.question.points}).` },
      { status: 400 }
    );
  }

  const updatedAnswer = await prisma.answer.update({
    where: { id: answer.id },
    data: {
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
