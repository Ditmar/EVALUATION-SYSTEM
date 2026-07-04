import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { computeTotalScore } from "@/lib/grading/totals";
import { computePredominantIp, isDifferentFromPredominant } from "@/lib/ip-utils";
import { finalizeAttempt } from "@/lib/attempt-finalize";

export async function GET(request: NextRequest, { params }: { params: { examId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const exam = await prisma.exam.findFirst({
    where: { id: params.examId, createdById: auth.session.userId },
  });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  // Lazy expiration: any IN_PROGRESS attempt past its deadline gets finalized here.
  const overdue = await prisma.examAttempt.findMany({
    where: { examId: exam.id, status: "IN_PROGRESS", expiresAt: { lte: new Date() } },
    select: { id: true },
  });

  for (const attempt of overdue) {
    await finalizeAttempt(attempt.id, "EXPIRED");
  }

  const attempts = await prisma.examAttempt.findMany({
    where: { examId: exam.id },
    include: { answers: true, _count: { select: { activityEvents: { where: { isPenalty: true } } } } },
    orderBy: { startedAt: "desc" },
  });

  const liveAttempts = attempts.filter((a) => a.status === "IN_PROGRESS");
  const finishedAttempts = attempts.filter((a) => a.status !== "IN_PROGRESS");

  const { predominantIp } = computePredominantIp(liveAttempts.map((a) => a.observedIp));

  const live = liveAttempts.map((a) => ({
    id: a.id,
    nombres: a.nombres,
    apellidos: a.apellidos,
    ci: a.ci,
    correo: a.correo,
    startedAt: a.startedAt,
    expiresAt: a.expiresAt,
    observedIp: a.observedIp,
    penaltyCount: a.penaltyCount,
    differentIp: exam.monitorExternalIps && exam.differentIpPolicy !== "OFF"
      ? isDifferentFromPredominant(a.observedIp, predominantIp)
      : false,
  }));

  const finished = finishedAttempts.map((a) => {
    const totals = computeTotalScore(a.answers);
    return {
      id: a.id,
      nombres: a.nombres,
      apellidos: a.apellidos,
      ci: a.ci,
      correo: a.correo,
      status: a.status,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      observedIp: a.observedIp,
      penaltyCount: a.penaltyCount,
      totalAutoScore: a.totalScore !== null ? a.totalAutoScore : totals.totalAutoScore,
      totalManualScore: a.totalScore !== null ? a.totalManualScore : totals.totalManualScore,
      totalScore: a.totalScore !== null ? a.totalScore : totals.totalScore,
      pendingReview: a.answers.some((ans) => ans.autoScore === null && ans.manualScore === null),
    };
  });

  return NextResponse.json({
    live,
    finished,
    predominantIp: exam.monitorExternalIps && exam.differentIpPolicy !== "OFF" ? predominantIp : null,
    monitorExternalIps: exam.monitorExternalIps,
    differentIpPolicy: exam.differentIpPolicy,
  });
}
