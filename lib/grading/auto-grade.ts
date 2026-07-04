import type { QuestionInput } from "@/lib/validation/exam-schema";

export interface GradableQuestion {
  type: "single_choice" | "multiple_choice" | "code";
  points: number;
  correctAnswer?: string | null;
  correctAnswers?: unknown;
}

export interface GradeResult {
  isCorrect: boolean | null;
  autoScore: number | null;
}

export function gradeSingleChoice(question: GradableQuestion, selectedOption: string | null | undefined): GradeResult {
  if (!selectedOption) return { isCorrect: false, autoScore: 0 };
  const isCorrect = selectedOption === question.correctAnswer;
  return { isCorrect, autoScore: isCorrect ? question.points : 0 };
}

/**
 * All-or-nothing: full points only if the selected set exactly matches the
 * correct set (no missing, no extra). No partial credit in the MVP.
 */
export function gradeMultipleChoice(
  question: GradableQuestion,
  selectedOptions: string[] | null | undefined
): GradeResult {
  const correct = Array.isArray(question.correctAnswers) ? (question.correctAnswers as string[]) : [];
  const selected = selectedOptions ?? [];

  const correctSet = new Set(correct);
  const selectedSet = new Set(selected);

  const isCorrect =
    correctSet.size === selectedSet.size && [...correctSet].every((id) => selectedSet.has(id));

  return { isCorrect, autoScore: isCorrect ? question.points : 0 };
}

export type StudentSafeQuestion = Omit<
  QuestionInput,
  "correctAnswer" | "correctAnswers" | "expectedSolution" | "rubric"
>;

/**
 * Strips answer-key fields before a question is ever sent to the student's
 * browser. Must be applied to every question payload served pre-submission.
 */
export function toStudentQuestion(question: QuestionInput): StudentSafeQuestion {
  const { correctAnswer, correctAnswers, expectedSolution, rubric, ...rest } = question as QuestionInput & {
    correctAnswer?: string;
    correctAnswers?: string[];
    expectedSolution?: string;
    rubric?: string;
  };
  return rest;
}
