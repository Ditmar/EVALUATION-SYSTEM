import { getAiProvider } from "@/lib/ai/factory";
import type { EvidenceItem } from "@/lib/ai/provider";
import type { QuestionDefinition } from "../types";

export interface AiEvaluationSuggestion {
  score: number;
  maxScore: number;
  feedback: string;
  evidence?: EvidenceItem[];
  confidence?: number;
  aiLikelihood?: number;
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
  // Score a blank answer as 0 without ever asking the model — an empty
  // "Respuesta del estudiante:" section in the prompt gives the LLM nothing
  // to ground a score in, and models don't reliably default to 0 on their
  // own for it (observed: an empty answer sometimes still got a generous
  // score). Deciding this in code is the only way to guarantee it.
  if (!studentAnswer.trim()) {
    return {
      score: 0,
      maxScore: question.points,
      feedback: "El estudiante no envió ninguna respuesta.",
      raw: { skipped: "empty-answer" },
      model: "n/a",
    };
  }

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
    aiLikelihood: result.aiLikelihood,
    raw: result.raw,
    model: result.model,
  };
}
