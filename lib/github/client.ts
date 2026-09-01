import { Octokit } from "@octokit/rest";

/**
 * `GITHUB_TOKEN` is optional — public repositories work fine against the
 * unauthenticated GitHub API, just at a much lower rate limit. Never
 * hardcode a token; this mirrors the `AI_API_KEY` env-var pattern already
 * used by `lib/ai/factory.ts`.
 */
export function getGitHubClient(): Octokit {
  return new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });
}
