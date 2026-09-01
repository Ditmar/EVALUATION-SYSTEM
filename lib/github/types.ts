export interface ParsedPullRequestUrl {
  owner: string;
  repo: string;
  number: number;
}

export type PullRequestState = "open" | "closed" | "merged";

export interface PullRequestSummary {
  number: number;
  /** "merged" takes precedence over "closed" when `merged` is true — see `toPullRequestState`. */
  state: PullRequestState;
  title: string;

  base: { owner: string; repo: string; branch: string; sha: string };
  head: { owner: string; repo: string; branch: string; sha: string };

  commits: number;
  changedFiles: number;
  additions: number;
  deletions: number;
}

export interface RepositoryDiffFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface RepositoryDiff {
  baseSha: string;
  headSha: string;
  files: RepositoryDiffFile[];
}
