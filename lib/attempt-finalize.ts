import { prisma } from "@/lib/db";
import { computeTotalScore } from "@/lib/grading/totals";
import type { AttemptStatus } from "@prisma/client";

/**
 * Finalizes an attempt (SUBMITTED, EXPIRED, or LOCKED): aggregates whatever
 * answers exist into totals and stamps submittedAt. Shared by the student
 * submit endpoint, the auto-submit/lock penalty path, and the admin lazy
 * expiration pass, so all three finalize consistently.
 */
export async function finalizeAttempt(attemptId: string, status: Extract<AttemptStatus, "SUBMITTED" | "EXPIRED" | "LOCKED">) {
  const answers = await prisma.answer.findMany({ where: { attemptId } });
  const totals = computeTotalScore(answers);

  return prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      status,
      submittedAt: new Date(),
      totalAutoScore: totals.totalAutoScore,
      totalManualScore: totals.totalManualScore,
      totalScore: totals.totalScore,
    },
  });
}
