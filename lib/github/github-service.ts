import { getGitHubClient } from "./client";
import type { ParsedPullRequestUrl, PullRequestState, PullRequestSummary, RepositoryDiff } from "./types";

const PR_URL = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)\/?/;
const REPO_URL = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/?$/;

/** Pure — no network. Returns `null` (not an error) for anything that isn't a GitHub PR URL. */
export function parsePullRequestUrl(url: string): ParsedPullRequestUrl | null {
  const match = PR_URL.exec(url.trim());
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: Number(match[3]) };
}

/** Pure — no network. Returns `null` for anything that isn't a plain GitHub repository URL. */
export function parseRepositoryUrl(url: string): { owner: string; repo: string } | null {
  const match = REPO_URL.exec(url.trim());
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

function toPullRequestState(state: string, merged: boolean): PullRequestState {
  if (merged) return "merged";
  return state === "closed" ? "closed" : "open";
}

function describeGitHubError(error: unknown, fallback: string): Error {
  const status = (error as { status?: number } | null)?.status;
  if (status === 404) return new Error(`${fallback} (no encontrado en GitHub).`);
  if (status === 403) return new Error(`${fallback} (GitHub rechazó la solicitud — límite de rate o permisos insuficientes).`);
  return new Error(`${fallback}: ${(error as Error)?.message ?? "error desconocido"}`);
}

export async function getPullRequest(owner: string, repo: string, number: number): Promise<PullRequestSummary> {
  const octokit = getGitHubClient();

  let response;
  try {
    response = await octokit.pulls.get({ owner, repo, pull_number: number });
  } catch (error) {
    throw describeGitHubError(error, `No se pudo obtener el Pull Request #${number} de ${owner}/${repo}`);
  }

  const pr = response.data;
  return {
    number: pr.number,
    state: toPullRequestState(pr.state, pr.merged ?? false),
    title: pr.title,
    base: { owner: pr.base.repo.owner.login, repo: pr.base.repo.name, branch: pr.base.ref, sha: pr.base.sha },
    head: { owner: pr.head.repo?.owner.login ?? pr.head.label.split(":")[0], repo: pr.head.repo?.name ?? repo, branch: pr.head.ref, sha: pr.head.sha },
    commits: pr.commits,
    changedFiles: pr.changed_files,
    additions: pr.additions,
    deletions: pr.deletions,
  };
}

export async function getBranchHeadSha(owner: string, repo: string, branch: string): Promise<string> {
  const octokit = getGitHubClient();
  try {
    const response = await octokit.repos.getBranch({ owner, repo, branch });
    return response.data.commit.sha;
  } catch (error) {
    throw describeGitHubError(error, `No se pudo resolver la rama "${branch}" de ${owner}/${repo}`);
  }
}

/**
 * Confirms this PR actually targets the laboratory's configured base
 * repository (a PR's `base` is, by definition, which repo/branch it was
 * opened against — that's the whole "fork relationship" check, no separate
 * parent-repo lookup needed) and that it can still receive review — a
 * merged or closed PR can't take more commits, so "Validar" showing a green
 * checklist over one would misrepresent the actual submit flow.
 */
export function validateAgainstBaseRepository(pr: PullRequestSummary, baseOwner: string, baseRepo: string): void {
  if (pr.base.owner.toLowerCase() !== baseOwner.toLowerCase() || pr.base.repo.toLowerCase() !== baseRepo.toLowerCase()) {
    throw new Error(`El Pull Request #${pr.number} no está dirigido al repositorio base configurado (${baseOwner}/${baseRepo}).`);
  }
  if (pr.state === "merged") {
    throw new Error(`El Pull Request #${pr.number} ya fue fusionado (merged) y no puede seguir recibiendo commits.`);
  }
  if (pr.state === "closed") {
    throw new Error(`El Pull Request #${pr.number} está cerrado y no puede seguir recibiendo commits.`);
  }
}

/**
 * Diffs two commits across a fork network using GitHub's `basehead` compare
 * syntax (`base...owner:head`) — the same mechanism GitHub's own PR "Files
 * changed" tab uses. Called on-demand; never stored eagerly, since it's
 * fully reproducible from two already-frozen SHAs.
 */
export async function getCompareDiff(
  baseOwner: string,
  baseRepo: string,
  baseSha: string,
  headOwner: string,
  headSha: string
): Promise<RepositoryDiff> {
  const octokit = getGitHubClient();
  const basehead = `${baseSha}...${headOwner}:${headSha}`;

  let response;
  try {
    response = await octokit.repos.compareCommitsWithBasehead({ owner: baseOwner, repo: baseRepo, basehead });
  } catch (error) {
    throw describeGitHubError(error, `No se pudo comparar ${baseSha} con ${headOwner}:${headSha}`);
  }

  return {
    baseSha,
    headSha,
    files: (response.data.files ?? []).map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch,
    })),
  };
}
