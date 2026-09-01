import type { AnswerValue, EvaluationResult, MultipleChoiceQuestion, SelectQuestion, SingleChoiceQuestion } from "../types";

/** `type="single-choice"` / `type="select"` with a `correct="..."` attribute. */
export function evaluateSingleChoice(question: SingleChoiceQuestion | SelectQuestion, value: AnswerValue | undefined): EvaluationResult {
  const submitted = typeof value === "string" ? value : undefined;
  const isCorrect = question.correct !== undefined && submitted === question.correct;

  return {
    status: isCorrect ? "correct" : "incorrect",
    score: isCorrect ? question.points : 0,
    maxScore: question.points,
    evaluator: "automatic",
  };
}

/**
 * `type="multiple-choice"` with a `correct="A|C"` attribute — all-or-nothing,
 * the selected set must exactly match the correct set (no partial credit),
 * mirroring `gradeMultipleChoice` in `lib/grading/auto-grade.ts`.
 */
export function evaluateMultipleChoice(question: MultipleChoiceQuestion, value: AnswerValue | undefined): EvaluationResult {
  const submitted = Array.isArray(value) ? value : [];
  const correct = question.correct ?? [];

  const correctSet = new Set(correct);
  const submittedSet = new Set(submitted);
  const isCorrect = correctSet.size === submittedSet.size && [...correctSet].every((id) => submittedSet.has(id));

  return {
    status: isCorrect ? "correct" : "incorrect",
    score: isCorrect ? question.points : 0,
    maxScore: question.points,
    evaluator: "automatic",
  };
}
