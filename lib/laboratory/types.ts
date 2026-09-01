/**
 * Laboratory Markdown Specification v0.1 — intermediate representation.
 *
 * Nothing outside `lib/laboratory/parse-laboratory.ts` (and its helpers) should
 * ever need to look at raw Markdown text again. The parser is the only piece
 * of the system that reads `.md` source; the renderer, the evaluation engine,
 * and every API route work exclusively against these types.
 */

export type LaboratoryStatus = "draft" | "published" | "archived";

export interface LaboratoryMetadata {
  id: string;
  title: string;
  subject?: string;
  version: number;
  duration?: number;
  points?: number;
  status: LaboratoryStatus;
}

export type EvaluatorKind = "automatic" | "manual" | "ai";

export const QUESTION_TYPES = [
  "text",
  "textarea",
  "number",
  "boolean",
  "single-choice",
  "multiple-choice",
  "select",
  "code",
  "github-pr",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const EVALUATOR_KINDS = ["automatic", "manual", "ai"] as const;

interface BaseQuestion {
  id: string;
  points: number;
  required: boolean;
  evaluator: EvaluatorKind;
  placeholder?: string;
  /**
   * Plain-text prose immediately preceding this question in the document —
   * not authored directly, derived by the parser from the paragraph right
   * before the `{{answer}}` placeholder (top-level paragraphs only). Used as
   * prompt context for the AI evaluator; absent if no such paragraph exists
   * (e.g. a placeholder inside a table cell).
   */
  context?: string;
}

export interface TextQuestion extends BaseQuestion {
  type: "text";
  correct?: string;
}

export interface TextareaQuestion extends BaseQuestion {
  type: "textarea";
}

export interface NumberQuestion extends BaseQuestion {
  type: "number";
  expected?: number;
  tolerance?: number;
}

export interface BooleanQuestion extends BaseQuestion {
  type: "boolean";
  correct?: boolean;
}

export interface SingleChoiceQuestion extends BaseQuestion {
  type: "single-choice";
  options: string[];
  correct?: string;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: "multiple-choice";
  options: string[];
  correct?: string[];
}

export interface SelectQuestion extends BaseQuestion {
  type: "select";
  options: string[];
  correct?: string;
}

export interface CodeQuestion extends BaseQuestion {
  type: "code";
  language: string;
}

/**
 * `evaluator` is narrowed to exclude `"automatic"` — a Pull Request can never
 * be graded by a deterministic rule, so this type never appears in
 * `AUTOMATIC_EVALUATORS` (see evaluation/engine.ts). `Omit<BaseQuestion,...>`
 * is required here, not just stylistic: TypeScript won't let a subinterface
 * narrow an inherited property's type via plain `extends`.
 */
export interface GitHubPullRequestQuestion extends Omit<BaseQuestion, "evaluator"> {
  type: "github-pr";
  /** Must match the `id` of a `{{repository}}` declared in the same document. */
  source: string;
  evaluator: "manual" | "ai";
}

export type QuestionDefinition =
  | TextQuestion
  | TextareaQuestion
  | NumberQuestion
  | BooleanQuestion
  | SingleChoiceQuestion
  | MultipleChoiceQuestion
  | SelectQuestion
  | CodeQuestion
  | GitHubPullRequestQuestion;

export const REPOSITORY_PROVIDERS = ["github"] as const;
export type RepositoryProvider = (typeof REPOSITORY_PROVIDERS)[number];

/**
 * A `{{repository}}` declaration — a laboratory-level resource, not a
 * student answer. Extracted from the raw Markdown before parsing (like
 * rubrics), never rendered inline in `content[]`.
 */
export interface RepositoryResource {
  id: string;
  provider: RepositoryProvider;
  url: string;
  branch: string;
}

/** Answer value shapes, keyed by question id, as stored in a submission's `answers` JSON. */
export type AnswerValue = string | number | boolean | string[];

export interface RubricDefinition {
  /** The question id this rubric grades (`{{rubric for="..."}}`). */
  for: string;
  /** Raw rubric body text — internal only, never sent to the student. */
  content: string;
}

/**
 * Whitelisted set of renderable node kinds. Deliberately NOT a passthrough of
 * arbitrary mdast nodes — anything outside this list is a parse error, not a
 * silently-dropped or best-effort-rendered node. `labAnswer` is the only kind
 * with no Markdown equivalent; it's spliced in wherever a `{{answer}}`
 * placeholder occurred, including inside table cells.
 */
export type LaboratoryNode =
  | { type: "heading"; depth: 1 | 2 | 3 | 4 | 5 | 6; children: LaboratoryNode[] }
  | { type: "paragraph"; children: LaboratoryNode[] }
  | { type: "text"; value: string }
  | { type: "strong"; children: LaboratoryNode[] }
  | { type: "emphasis"; children: LaboratoryNode[] }
  | { type: "inlineCode"; value: string }
  | { type: "code"; lang: string | null; value: string }
  | { type: "list"; ordered: boolean; children: LaboratoryNode[] }
  | { type: "listItem"; children: LaboratoryNode[] }
  | { type: "table"; align: Array<"left" | "right" | "center" | null>; children: LaboratoryNode[] }
  | { type: "tableRow"; children: LaboratoryNode[] }
  | { type: "tableCell"; children: LaboratoryNode[] }
  | { type: "image"; url: string; alt: string | null; title: string | null }
  | { type: "thematicBreak" }
  | { type: "blockquote"; children: LaboratoryNode[] }
  | { type: "link"; url: string; children: LaboratoryNode[] }
  | { type: "break" }
  | { type: "labAnswer"; questionId: string };

export interface LaboratoryDefinition {
  metadata: LaboratoryMetadata;
  content: LaboratoryNode[];
  questions: QuestionDefinition[];
  rubrics: RubricDefinition[];
  repositories: RepositoryResource[];
}

export interface LaboratoryParseError {
  message: string;
  questionId?: string;
}

export interface LaboratoryParseWarning {
  message: string;
}

export type LaboratoryParseResult =
  | { ok: true; laboratory: LaboratoryDefinition; warnings: LaboratoryParseWarning[] }
  | { ok: false; errors: LaboratoryParseError[] };

export type EvaluationStatus = "correct" | "incorrect" | "pending_review" | "graded";

export interface EvaluationResult {
  status: EvaluationStatus;
  /** null while pending_review (manual not yet graded, or ai suggestion not yet requested). */
  score: number | null;
  maxScore: number;
  feedback?: string;
  confidence?: number;
  evaluator: EvaluatorKind;
}

/** One question's grading state, as stored in a submission's `grading` JSON. */
export interface QuestionGrading {
  evaluator: EvaluatorKind;
  status: EvaluationStatus;
  autoScore?: number | null;
  manualScore?: number | null;
  /** What actually counts toward the total: manual if present, else automatic, else 0 (pending). */
  finalScore: number | null;
  feedback?: string;
}

export type GradingMap = Record<string, QuestionGrading>;
export type AnswersMap = Record<string, AnswerValue>;
