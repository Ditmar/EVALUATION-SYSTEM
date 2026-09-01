import type { AnswerValue, EvaluationResult, QuestionDefinition, QuestionType } from "../types";
import { evaluateExactMatch } from "./exact-match";
import { evaluateNumeric } from "./numeric";
import { evaluateBoolean } from "./boolean";
import { evaluateSingleChoice, evaluateMultipleChoice } from "./choice";
import { evaluateManual } from "./manual";

type SyncEvaluatorFn = (question: never, value: AnswerValue | undefined) => EvaluationResult;

/**
 * Registry of deterministic (`evaluator: "automatic"`) strategies, keyed by
 * question `type` — extending this with a new type means adding one entry
 * here, not touching this file's control flow. `text`/`number`/`boolean`/
 * `single-choice`/`select`/`multiple-choice` are the only types that can ever
 * be automatic; `textarea` and `code` have no deterministic rule and always
 * fall back to manual review even if `evaluator="automatic"` was requested.
 */
const AUTOMATIC_EVALUATORS: Partial<Record<QuestionType, SyncEvaluatorFn>> = {
  text: evaluateExactMatch as SyncEvaluatorFn,
  number: evaluateNumeric as SyncEvaluatorFn,
  boolean: evaluateBoolean as SyncEvaluatorFn,
  "single-choice": evaluateSingleChoice as SyncEvaluatorFn,
  select: evaluateSingleChoice as SyncEvaluatorFn,
  "multiple-choice": evaluateMultipleChoice as SyncEvaluatorFn,
};

/**
 * Synchronous half of the EvaluationEngine — used right after a student
 * submits, to compute whatever can be computed immediately. `evaluator="ai"`
 * never resolves here (it requires a network call the teacher triggers
 * on-demand from the grading view); see `evaluateWithAi` in `./ai.ts` for
 * that path. Both halves always report a suggestion, never a final grade —
 * "ai" and "manual" answers stay `pending_review` until a teacher decides.
 */
export function evaluate(question: QuestionDefinition, value: AnswerValue | undefined): EvaluationResult {
  if (question.evaluator === "automatic") {
    const fn = AUTOMATIC_EVALUATORS[question.type];
    if (fn) return fn(question as never, value);
    return evaluateManual(question);
  }

  if (question.evaluator === "manual") {
    return evaluateManual(question);
  }

  return { status: "pending_review", score: null, maxScore: question.points, evaluator: "ai" };
}
