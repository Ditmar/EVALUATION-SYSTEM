import type { AnswerValue, AnswersMap, GradingMap } from "./types";

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
