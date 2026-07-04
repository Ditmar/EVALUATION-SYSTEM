import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { getAiProvider } from "@/lib/ai/factory";

export async function POST(
  request: NextRequest,
  { params }: { params: { examId: string; answerId: string } }
) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const exam = await prisma.exam.findFirst({
    where: { id: params.examId, createdById: auth.session.userId },
  });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  if (!exam.allowAiCodeEvaluation) {
    return NextResponse.json(
      { error: "La evaluación con IA está deshabilitada para este examen." },
      { status: 403 }
    );
  }

  const answer = await prisma.answer.findFirst({
    where: { id: params.answerId },
    include: { question: true },
  });
  if (!answer || answer.question.examId !== exam.id) {
    return NextResponse.json({ error: "Respuesta no encontrada." }, { status: 404 });
  }

  if (answer.question.type !== "CODE") {
    return NextResponse.json({ error: "Sólo las preguntas de código admiten evaluación con IA." }, { status: 400 });
  }

  if (!answer.question.enableAiEvaluation) {
    return NextResponse.json(
      { error: "La evaluación con IA está deshabilitada para esta pregunta." },
      { status: 403 }
    );
  }

  try {
    const provider = getAiProvider();
    const result = await provider.evaluateCodeAnswer({
      statement: answer.question.statement,
      language: answer.question.language ?? "javascript",
      expectedSolution: answer.question.expectedSolution,
      rubric: answer.question.rubric,
      studentCode: answer.codeAnswer ?? "",
      maxPoints: answer.question.points,
    });

    const aiEvaluation = await prisma.aiEvaluation.create({
      data: {
        answerId: answer.id,
        suggestedScore: result.suggestedScore,
        feedback: result.feedback,
        rawResponse: JSON.parse(JSON.stringify(result.raw)),
        model: result.model,
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
