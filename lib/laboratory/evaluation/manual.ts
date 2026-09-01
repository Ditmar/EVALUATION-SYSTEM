import type { EvaluationResult, QuestionDefinition } from "../types";

/** Always pending — the teacher assigns the score by hand in the grading view. */
export function evaluateManual(question: QuestionDefinition): EvaluationResult {
  return { status: "pending_review", score: null, maxScore: question.points, evaluator: "manual" };
}
