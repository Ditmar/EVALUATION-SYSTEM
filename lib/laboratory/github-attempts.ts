import { prisma } from "@/lib/db";
import type { GitHubSubmissionAttempt } from "@prisma/client";

/** "Current" attempt for a (submission, question) pair = the highest `attemptNumber`. */
export async function getLatestGithubAttempt(submissionId: string, questionId: string): Promise<GitHubSubmissionAttempt | null> {
  return prisma.gitHubSubmissionAttempt.findFirst({
    where: { submissionId, questionId },
    orderBy: { attemptNumber: "desc" },
  });
}

/** One query for every `github-pr` question in a submission, e.g. to hydrate initial page state. */
export async function getLatestGithubAttemptsBySubmission(submissionId: string): Promise<Map<string, GitHubSubmissionAttempt>> {
  const attempts = await prisma.gitHubSubmissionAttempt.findMany({
    where: { submissionId },
    orderBy: { attemptNumber: "desc" },
  });

  const latestByQuestion = new Map<string, GitHubSubmissionAttempt>();
  for (const attempt of attempts) {
    if (!latestByQuestion.has(attempt.questionId)) latestByQuestion.set(attempt.questionId, attempt);
  }
  return latestByQuestion;
}
