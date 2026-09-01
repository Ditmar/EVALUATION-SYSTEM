import type { ComponentType } from "react";
import type { AnswerValue, QuestionDefinition, RepositoryResource } from "@/lib/laboratory/types";

/** JSON-serialized shape of a `GitHubSubmissionAttempt` row, as returned by the API (dates as ISO strings). */
export interface GithubAttemptSummary {
  attemptNumber: number;
  pullRequestUrl: string;
  pullRequestNumber: number;
  pullRequestState: string;
  headRepositoryOwner: string;
  headRepositoryName: string;
  headBranch: string;
  baseCommitSha: string;
  submittedCommitSha: string;
  filesChanged: number;
  commitsCount: number;
  additions: number;
  deletions: number;
  submittedAt: string;
}

export interface AnswerComponentProps {
  question: QuestionDefinition;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  disabled?: boolean;
  /**
   * Only used by the `github-pr` answer type, to build its request URLs.
   * Absent in contexts with no real submission yet (e.g. the admin preview
   * during import) — that component degrades to a static, non-interactive
   * preview when this is missing. A harmless no-op for every other type.
   */
  labId?: string;
  /** Hydrated initial state for `github-pr` — the latest attempt, if any. A no-op for every other type. */
  githubAttempt?: GithubAttemptSummary | null;
  /** The `{{repository}}` resource a `github-pr` question's `source` points at. A no-op for every other type. */
  repository?: RepositoryResource;
}

export type AnswerComponent = ComponentType<AnswerComponentProps>;
