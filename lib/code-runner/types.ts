/**
 * Shared types for the `ide` question type — used by both laboratories
 * (Markdown `{{answer type="ide"}}`) and exams (JSON `type: "ide"`), so the
 * IDE component, the run service and the graders only know about one shape.
 * See docs/specs/piston-code-runner.md.
 */

export const IDE_LANGUAGES = ["python", "java", "typescript"] as const;
export type IdeLanguage = (typeof IDE_LANGUAGES)[number];

export const IDE_MODES = ["single", "multi"] as const;
export type IdeMode = (typeof IDE_MODES)[number];

export interface IdeFile {
  name: string;
  content: string;
  /** Provided by the teacher; never editable, never taken from the client. */
  readonly?: boolean;
}

/** Everything about an `ide` question except the common question fields (id, points...). */
export interface IdeConfig {
  language: IdeLanguage;
  mode: IdeMode;
  /** The file that gets executed. Always present in `starterFiles` (editable). */
  entry: string;
  starterFiles: IdeFile[];
  allowNewFiles: boolean;
  maxFiles: number;
  stdin: string;
  stdinEditable: boolean;
  runEnabled: boolean;
  runLimit?: number;
  autocomplete: boolean;
  height: number;
}

/** What gets stored as a student's answer: only the editable files. */
export interface IdeAnswerValue {
  files: { name: string; content: string }[];
  stdin?: string;
}

export type RunStatus = "ok" | "runtime_error" | "compile_error" | "timeout" | "memory" | "unavailable";

export interface RunResult {
  status: RunStatus;
  language: string;
  version: string;
  compile?: { output: string; code: number | null };
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  durationMs: number;
  truncated: boolean;
  runsUsed?: number;
  runsLimit?: number;
}

export function isIdeAnswerValue(value: unknown): value is IdeAnswerValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const files = (value as { files?: unknown }).files;
  return (
    Array.isArray(files) &&
    files.every((f) => typeof f === "object" && f !== null && typeof f.name === "string" && typeof f.content === "string")
  );
}
