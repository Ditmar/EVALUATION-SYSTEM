import { getAiProvider } from "@/lib/ai/factory";
import type { QuestionDefinition } from "../types";

export interface AiEvaluationSuggestion {
  score: number;
  maxScore: number;
  feedback: string;
  confidence?: number;
  raw: unknown;
  model: string;
}

/**
 * On-demand AI grading for `evaluator="ai"` questions (in practice, free-text
 * `textarea` answers graded against a `{{rubric}}`). Triggered by the teacher
 * from the grading view, never automatically and never applied as the final
 * score — the result is always a suggestion the teacher accepts, edits, or
 * ignores, exactly like `AiEvaluation` already works for exam code answers.
 *
 * Neither existing `AiProvider` adapter computes a confidence value today, so
 * `confidence` is left undefined rather than faked — this reshapes the
 * provider's `{suggestedScore, feedback, raw, model}` into the
 * `{score, maxScore, feedback, confidence}` shape from the Laboratory spec.
 */
export async function evaluateWithAi(
  question: QuestionDefinition,
  questionText: string,
  rubric: string | null,
  studentAnswer: string
): Promise<AiEvaluationSuggestion> {
  const provider = getAiProvider();
  const result = await provider.evaluateTextAnswer({
    question: questionText,
    rubric,
    studentAnswer,
    maxPoints: question.points,
  });

  return {
    score: result.suggestedScore,
    maxScore: question.points,
    feedback: result.feedback,
    raw: result.raw,
    model: result.model,
  };
}
