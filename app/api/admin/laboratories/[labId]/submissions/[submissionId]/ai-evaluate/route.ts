import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLaboratoryAccess } from "@/lib/auth/require-admin";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import { evaluateWithAi } from "@/lib/laboratory/evaluation/ai";
import { formatDiffForPrompt } from "@/lib/laboratory/evaluation/repository-context";
import { getLatestGithubAttempt } from "@/lib/laboratory/github-attempts";
import { getCompareDiff, parseRepositoryUrl } from "@/lib/github/github-service";
import type { AnswersMap, GitHubPullRequestQuestion, LaboratoryDefinition } from "@/lib/laboratory/types";

const BodySchema = z.object({ questionId: z.string().min(1) });

/** Builds the "student answer" text for a `github-pr` question: a formatted diff, not plain prose — see `repository-context.ts`. */
async function buildGithubAnswerText(laboratory: LaboratoryDefinition, question: GitHubPullRequestQuestion, submissionId: string): Promise<string> {
  const attempt = await getLatestGithubAttempt(submissionId, question.id);
  if (!attempt) {
    throw new Error("No hay una entrega de GitHub para esta pregunta todavía.");
  }

  const repository = laboratory.repositories.find((r) => r.id === question.source);
  const baseRef = repository ? parseRepositoryUrl(repository.url) : null;
  if (!repository || !baseRef) {
    throw new Error("El repositorio base de esta pregunta ya no está disponible.");
  }

  const diff = await getCompareDiff(baseRef.owner, baseRef.repo, attempt.baseCommitSha, attempt.headRepositoryOwner, attempt.submittedCommitSha);

  return formatDiffForPrompt(diff, {
    baseOwner: baseRef.owner,
    baseRepo: baseRef.repo,
    baseBranch: repository.branch,
    headOwner: attempt.headRepositoryOwner,
    headRepo: attempt.headRepositoryName,
    headBranch: attempt.headBranch,
    pullRequestNumber: attempt.pullRequestNumber,
    commitsCount: attempt.commitsCount,
  });
}

export async function POST(request: NextRequest, { params }: { params: { labId: string; submissionId: string } }) {
  const auth = await requireLaboratoryAccess(request, params.labId);
  if ("response" in auth) return auth.response;
  const { laboratory } = auth;

  const body = await request.json().catch(() => null);
  const parsedBody = BodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
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

  try {
    let studentAnswerText: string;
    if (question.type === "github-pr") {
      studentAnswerText = await buildGithubAnswerText(parsed.laboratory, question, submission.id);
    } else {
      const answers = (submission.answers as AnswersMap | null) ?? {};
      const value = answers[question.id];
      studentAnswerText = typeof value === "string" ? value : "";
    }

    const suggestion = await evaluateWithAi(question, question.context ?? `Pregunta "${question.id}"`, rubric, studentAnswerText);

    const aiEvaluation = await prisma.laboratoryAiEvaluation.create({
      data: {
        submissionId: submission.id,
        questionId: question.id,
        suggestedScore: suggestion.score,
        feedback: suggestion.feedback,
        evidence: suggestion.evidence ? JSON.parse(JSON.stringify(suggestion.evidence)) : undefined,
        aiLikelihood: suggestion.aiLikelihood,
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
