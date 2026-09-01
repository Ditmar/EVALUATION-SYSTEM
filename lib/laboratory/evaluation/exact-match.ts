import type { AnswerValue, EvaluationResult, TextQuestion } from "../types";

/** `type="text"` with a `correct="..."` attribute — case-sensitive, trimmed exact match. */
export function evaluateExactMatch(question: TextQuestion, value: AnswerValue | undefined): EvaluationResult {
  const submitted = typeof value === "string" ? value.trim() : "";
  const isCorrect = question.correct !== undefined && submitted === question.correct.trim();
  return {
    status: isCorrect ? "correct" : "incorrect",
    score: isCorrect ? question.points : 0,
    maxScore: question.points,
    evaluator: "automatic",
  };
}
