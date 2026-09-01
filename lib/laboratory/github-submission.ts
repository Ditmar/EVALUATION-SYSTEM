import { getPullRequest, parsePullRequestUrl, parseRepositoryUrl, validateAgainstBaseRepository } from "@/lib/github/github-service";
import type { PullRequestSummary } from "@/lib/github/types";
import type { GitHubPullRequestQuestion, LaboratoryDefinition, RepositoryResource } from "./types";

export interface GithubPrValidation {
  question: GitHubPullRequestQuestion;
  repository: RepositoryResource;
  pullRequest: PullRequestSummary;
}

/**
 * The full validation pipeline behind both "Validar" and "Entregar": finds
 * the question + its configured base repository, parses the pasted URL, and
 * asks GitHub directly — never trusts anything the client already showed.
 * Throws a plain `Error` with a message safe to show the student directly
 * for every expected failure (bad URL, PR not found, wrong repo, merged/
 * closed); callers should treat any thrown error here as an expected
 * "invalid submission" outcome, not a server fault.
 */
export async function validatePullRequestSubmission(
  laboratory: LaboratoryDefinition,
  questionId: string,
  pullRequestUrl: string
): Promise<GithubPrValidation> {
  const question = laboratory.questions.find((q) => q.id === questionId);
  if (!question) {
    throw new Error("Pregunta no encontrada.");
  }
  if (question.type !== "github-pr") {
    throw new Error("Esta pregunta no acepta entregas mediante Pull Request de GitHub.");
  }

  const repository = laboratory.repositories.find((r) => r.id === question.source);
  if (!repository) {
    throw new Error("El repositorio base de esta pregunta no está definido en el laboratorio.");
  }

  const baseRef = parseRepositoryUrl(repository.url);
  if (!baseRef) {
    throw new Error("La URL del repositorio base configurada en el laboratorio no es válida.");
  }

  const parsedPr = parsePullRequestUrl(pullRequestUrl);
  if (!parsedPr) {
    throw new Error("La URL ingresada no corresponde a un Pull Request de GitHub (debe verse como https://github.com/owner/repo/pull/123).");
  }

  const pullRequest = await getPullRequest(parsedPr.owner, parsedPr.repo, parsedPr.number);
  validateAgainstBaseRepository(pullRequest, baseRef.owner, baseRef.repo);

  return { question, repository, pullRequest };
}
