import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import { evaluateWithAi } from "@/lib/laboratory/evaluation/ai";
import type { AnswersMap } from "@/lib/laboratory/types";

const BodySchema = z.object({ questionId: z.string().min(1) });

export async function POST(request: NextRequest, { params }: { params: { labId: string; submissionId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsedBody = BodySchema.safeParse(body);
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
  if (question.evaluator !== "ai") {
    return NextResponse.json({ error: "Esta pregunta no está configurada para evaluación con IA." }, { status: 400 });
  }

  const rubric = parsed.laboratory.rubrics.find((r) => r.for === question.id)?.content ?? null;
  const answers = (submission.answers as AnswersMap | null) ?? {};
  const studentAnswer = answers[question.id];

  try {
    const suggestion = await evaluateWithAi(
      question,
      question.context ?? `Pregunta "${question.id}"`,
      rubric,
      typeof studentAnswer === "string" ? studentAnswer : ""
    );

    const aiEvaluation = await prisma.laboratoryAiEvaluation.create({
      data: {
        submissionId: submission.id,
        questionId: question.id,
        suggestedScore: suggestion.score,
        feedback: suggestion.feedback,
        rawResponse: JSON.parse(JSON.stringify(suggestion.raw)),
        model: suggestion.model,
      },
    });

    return NextResponse.json({ aiEvaluation });
  } catch (error) {
    return NextResponse.json(
      { error: `No se pudo obtener la evaluación con IA: ${(error as Error).message}` },
      { status: 502 }
    );
  }
}
