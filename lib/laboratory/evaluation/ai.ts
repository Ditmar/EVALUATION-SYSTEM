import { getAiProvider } from "@/lib/ai/factory";
import type { EvidenceItem } from "@/lib/ai/provider";
import type { QuestionDefinition } from "../types";

export interface AiEvaluationSuggestion {
  score: number;
  maxScore: number;
  feedback: string;
  evidence?: EvidenceItem[];
  confidence?: number;
  raw: unknown;
  model: string;
}

/**
 * On-demand AI grading for `evaluator="ai"` questions — free-text `textarea`
 * answers graded against a `{{rubric}}`, or `github-pr` reviews (where the
 * caller passes a formatted diff, built by
 * `lib/laboratory/evaluation/repository-context.ts`, as `studentAnswer`;
 * this function has no GitHub-specific knowledge either way). Triggered by
 * the teacher from the grading view, never automatically and never applied
 * as the final score — the result is always a suggestion the teacher
 * accepts, edits, or ignores, exactly like `AiEvaluation` already works for
 * exam code answers.
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
    evidence: result.evidence,
    confidence: result.confidence,
    raw: result.raw,
    model: result.model,
  };
}
