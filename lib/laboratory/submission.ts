import { evaluate } from "./evaluation/engine";
import type { AnswerValue, AnswersMap, GradingMap, LaboratoryDefinition } from "./types";

/**
 * Merges a single question's answer into the submission's `answers` JSON
 * blob without touching any other key — this is what makes independent,
 * per-field debounced autosave safe: two fields with timers that fire close
 * together can't clobber each other because each PATCH only ever touches its
 * own key.
 */
export function mergeAnswer(existing: AnswersMap | null | undefined, questionId: string, value: AnswerValue): AnswersMap {
  return { ...(existing ?? {}), [questionId]: value };
}

/**
 * Sum of what actually counts per question: `finalScore` if graded, else 0
 * (pending) — mirrors the exam scoring rule in
 * `lib/grading/totals.ts` (manual if present, else automatic, else 0).
 */
export function computeTotalScore(grading: GradingMap | null | undefined): number {
  if (!grading) return 0;
  return Object.values(grading).reduce((sum, entry) => sum + (entry.finalScore ?? 0), 0);
}

export interface FinalizeResult {
  grading: GradingMap;
  totalScore: number;
  status: "SUBMITTED" | "GRADED";
}

/**
 * Runs the same auto-grading pass a student's own "Enviar laboratorio" does:
 * evaluates every question against the current answers and decides whether
 * the submission is fully auto-gradeable (`GRADED`) or still has questions
 * pending manual/AI review (`SUBMITTED`). Shared by the student submit
 * endpoint and the admin "Cerrar" action so closing a reopened submission
 * recomputes grading exactly the same way a normal submit would.
 */
export function finalizeSubmission(laboratory: LaboratoryDefinition, answers: AnswersMap | null | undefined): FinalizeResult {
  const grading: GradingMap = {};
  for (const question of laboratory.questions) {
    const result = evaluate(question, (answers ?? {})[question.id]);
    grading[question.id] = {
      evaluator: result.evaluator,
      status: result.status,
      autoScore: result.evaluator === "automatic" ? result.score : undefined,
      finalScore: result.score,
      feedback: result.feedback,
    };
  }

  const totalScore = computeTotalScore(grading);
  const allAutoGraded = laboratory.questions.every((q) => grading[q.id].status !== "pending_review");

  return { grading, totalScore, status: allAutoGraded ? "GRADED" : "SUBMITTED" };
}
