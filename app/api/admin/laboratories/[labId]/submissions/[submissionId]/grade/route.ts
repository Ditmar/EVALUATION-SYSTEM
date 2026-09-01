import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import { computeTotalScore } from "@/lib/laboratory/submission";
import type { GradingMap } from "@/lib/laboratory/types";

const GradeSchema = z.object({
  questionId: z.string().min(1),
  manualScore: z.number().min(0),
  feedback: z.string().trim().max(5000).optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: { labId: string; submissionId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsedBody = GradeSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const laboratory = await prisma.laboratory.findFirst({
    where: { id: params.labId, createdById: auth.session.userId },
  });
  if (!laboratory) {
    return NextResponse.json({ error: "Laboratorio no encontrado." }, { status: 404 });
  }

  const submission = await prisma.laboratorySubmission.findFirst({
    where: { id: params.submissionId, laboratoryId: laboratory.id },
  });
  if (!submission) {
    return NextResponse.json({ error: "Entrega no encontrada." }, { status: 404 });
  }

  const parsed = parseLaboratory(submission.markdownSnapshot);
  if (!parsed.ok) {
    return NextResponse.json({ error: "No se pudo interpretar el laboratorio de esta entrega." }, { status: 500 });
  }

  const question = parsed.laboratory.questions.find((q) => q.id === parsedBody.data.questionId);
  if (!question) {
    return NextResponse.json({ error: "Pregunta no encontrada." }, { status: 404 });
  }

  if (parsedBody.data.manualScore > question.points) {
    return NextResponse.json(
      { error: `El puntaje no puede superar el máximo de la pregunta (${question.points}).` },
      { status: 400 }
    );
  }

  const existingGrading = (submission.grading as GradingMap | null) ?? {};
  const nextGrading: GradingMap = {
    ...existingGrading,
    [question.id]: {
      evaluator: question.evaluator,
      status: "graded",
      manualScore: parsedBody.data.manualScore,
      finalScore: parsedBody.data.manualScore,
      feedback: parsedBody.data.feedback || undefined,
    },
  };

  const totalScore = computeTotalScore(nextGrading);
  const allGraded = parsed.laboratory.questions.every((q) => nextGrading[q.id]?.status !== "pending_review");

  const updated = await prisma.laboratorySubmission.update({
    where: { id: submission.id },
    data: {
      grading: nextGrading as unknown as Prisma.InputJsonValue,
      totalScore,
      status: submission.status === "IN_PROGRESS" ? submission.status : allGraded ? "GRADED" : submission.status,
      gradedAt: new Date(),
    },
  });

  return NextResponse.json({ submission: updated });
}
