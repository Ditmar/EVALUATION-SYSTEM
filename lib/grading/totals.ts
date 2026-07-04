export interface ScorableAnswer {
  autoScore: number | null;
  manualScore: number | null;
}

/**
 * Aggregates a total score from a set of answers. For each answer, a manual
 * score (if present, e.g. reviewed code answers) takes precedence over the
 * auto-computed score; otherwise falls back to autoScore; otherwise 0
 * (pending manual review, not yet contributing to the visible total).
 */
export function computeTotalScore(answers: ScorableAnswer[]): {
  totalAutoScore: number;
  totalManualScore: number;
  totalScore: number;
} {
  let totalAutoScore = 0;
  let totalManualScore = 0;
  let totalScore = 0;

  for (const answer of answers) {
    totalAutoScore += answer.autoScore ?? 0;
    totalManualScore += answer.manualScore ?? 0;
    totalScore += answer.manualScore ?? answer.autoScore ?? 0;
  }

  return { totalAutoScore, totalManualScore, totalScore };
}
