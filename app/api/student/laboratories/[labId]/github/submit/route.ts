import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStudentSession } from "@/lib/auth/require-student";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import { validatePullRequestSubmission } from "@/lib/laboratory/github-submission";
import { getLatestGithubAttempt } from "@/lib/laboratory/github-attempts";
import { mergeAnswer } from "@/lib/laboratory/submission";
import type { AnswersMap } from "@/lib/laboratory/types";

const BodySchema = z.object({ questionId: z.string().min(1), pullRequestUrl: z.string().min(1) });

/**
 * Freezes a new GitHub submission attempt. Re-runs the full validation
 * pipeline from scratch — never trusts a SHA the client already saw from a
 * prior "Validar" call, since the student could have pushed more commits in
 * between. `baseCommitSha` comes from the laboratory's current
 * `LaboratoryRepository.commitSha` snapshot (frozen at the last publish),
 * never from the PR's own live base pointer.
 */
export async function POST(request: NextRequest, { params }: { params: { labId: string } }) {
  const auth = await requireStudentSession(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsedBody = BodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const submission = await prisma.laboratorySubmission.findFirst({
    where: { laboratoryId: params.labId, studentId: auth.session.studentId },
  });
  if (!submission) {
    return NextResponse.json({ error: "No has iniciado este laboratorio." }, { status: 404 });
  }
  if (submission.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Este laboratorio ya fue enviado." }, { status: 409 });
  }

  const parsed = parseLaboratory(submission.markdownSnapshot);
  if (!parsed.ok) {
    return NextResponse.json({ error: "No se pudo interpretar el laboratorio." }, { status: 500 });
  }

  let validation;
  try {
    validation = await validatePullRequestSubmission(parsed.laboratory, parsedBody.data.questionId, parsedBody.data.pullRequestUrl);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  const { question, repository, pullRequest } = validation;

  const repositoryRow = await prisma.laboratoryRepository.findUnique({
    where: { laboratoryId_resourceId: { laboratoryId: submission.laboratoryId, resourceId: repository.id } },
  });
  if (!repositoryRow?.commitSha) {
    return NextResponse.json(
      { error: "Este laboratorio debe publicarse nuevamente para fijar el commit base del repositorio antes de aceptar entregas." },
      { status: 409 }
    );
  }

  const lastAttempt = await getLatestGithubAttempt(submission.id, question.id);
  const attemptNumber = (lastAttempt?.attemptNumber ?? 0) + 1;

  try {
    const attempt = await prisma.gitHubSubmissionAttempt.create({
      data: {
        submissionId: submission.id,
        questionId: question.id,
        attemptNumber,
        sourceRepositoryUrl: repository.url,
        sourceBranch: repository.branch,
        headRepositoryOwner: pullRequest.head.owner,
        headRepositoryName: pullRequest.head.repo,
        headBranch: pullRequest.head.branch,
        pullRequestUrl: parsedBody.data.pullRequestUrl,
        pullRequestNumber: pullRequest.number,
        pullRequestState: pullRequest.state,
        baseCommitSha: repositoryRow.commitSha,
        submittedCommitSha: pullRequest.head.sha,
        filesChanged: pullRequest.changedFiles,
        commitsCount: pullRequest.commits,
        additions: pullRequest.additions,
        deletions: pullRequest.deletions,
      },
    });

    // Informational only (keeps the generic "N of M answered" progress
    // counter working for this type too) — the attempt row above is the
    // real source of truth for grading.
    const nextAnswers = mergeAnswer(submission.answers as AnswersMap | null, question.id, parsedBody.data.pullRequestUrl);
    await prisma.laboratorySubmission.update({
      where: { id: submission.id },
      data: { answers: nextAnswers as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({ attempt });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya se procesó un envío para esta pregunta, intenta de nuevo." }, { status: 409 });
    }
    throw error;
  }
}
