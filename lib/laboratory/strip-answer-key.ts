import type { LaboratoryDefinition, QuestionDefinition } from "./types";

/**
 * Plain `Omit` over a union type isn't distributive — it collapses to the
 * keys common to every member, which would silently drop type-specific
 * fields like `options`/`language` (present on only some question types)
 * from the resulting type entirely, not just `correct`/`expected`/`tolerance`.
 * This distributes the `Omit` over each union member first, so e.g. a
 * `CodeQuestion` still structurally requires `language` after stripping.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, Extract<keyof T, K>> : never;

export type StudentSafeQuestion = DistributiveOmit<QuestionDefinition, "correct" | "expected" | "tolerance">;

/**
 * Removes every field that would leak the answer key before a question is
 * ever sent to a student's browser. Mirrors `toStudentQuestion` in
 * `lib/grading/auto-grade.ts` — same rule, same reason: correctness/tolerance
 * checks must happen only on the server, never trusted to (or visible in) the
 * client bundle.
 */
export function stripAnswerKey(question: QuestionDefinition): StudentSafeQuestion {
  const clone: Record<string, unknown> = { ...question };
  delete clone.correct;
  delete clone.expected;
  delete clone.tolerance;
  return clone as StudentSafeQuestion;
}

export interface StudentSafeLaboratory {
  metadata: LaboratoryDefinition["metadata"];
  content: LaboratoryDefinition["content"];
  questions: StudentSafeQuestion[];
  /** Public GitHub repo URLs the student needs to fork — not secret, unlike `rubrics`. */
  repositories: LaboratoryDefinition["repositories"];
}

/**
 * Full student-facing projection of a parsed laboratory: strips answer-key
 * fields from every question and omits `rubrics` entirely (rubric text is
 * teacher-only grading guidance, never shown to the student).
 */
export function toStudentLaboratory(laboratory: LaboratoryDefinition): StudentSafeLaboratory {
  return {
    metadata: laboratory.metadata,
    content: laboratory.content,
    questions: laboratory.questions.map(stripAnswerKey),
    repositories: laboratory.repositories,
  };
}
