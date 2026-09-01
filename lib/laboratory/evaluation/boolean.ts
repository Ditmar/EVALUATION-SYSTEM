import type { AnswerValue, BooleanQuestion, EvaluationResult } from "../types";

/** `type="boolean"` with a `correct="true|false"` attribute. */
export function evaluateBoolean(question: BooleanQuestion, value: AnswerValue | undefined): EvaluationResult {
  const submitted = typeof value === "boolean" ? value : undefined;
  const isCorrect = question.correct !== undefined && submitted === question.correct;

  return {
    status: isCorrect ? "correct" : "incorrect",
    score: isCorrect ? question.points : 0,
    maxScore: question.points,
    evaluator: "automatic",
  };
}
