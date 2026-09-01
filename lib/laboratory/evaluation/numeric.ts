import type { AnswerValue, EvaluationResult, NumberQuestion } from "../types";

/** `type="number"` with `expected`+`tolerance` — correct iff |answer - expected| <= tolerance. */
export function evaluateNumeric(question: NumberQuestion, value: AnswerValue | undefined): EvaluationResult {
  const submitted = typeof value === "number" ? value : Number(value);
  const expected = question.expected;

  if (expected === undefined || Number.isNaN(submitted)) {
    return { status: "incorrect", score: 0, maxScore: question.points, evaluator: "automatic" };
  }

  const tolerance = question.tolerance ?? 0;
  const isCorrect = Math.abs(submitted - expected) <= tolerance;

  return {
    status: isCorrect ? "correct" : "incorrect",
    score: isCorrect ? question.points : 0,
    maxScore: question.points,
    evaluator: "automatic",
  };
}
