import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { buildResultsCsv, type ResultsCsvRow } from "@/lib/csv";
import { computeTotalScore } from "@/lib/grading/totals";

export async function GET(request: NextRequest, { params }: { params: { examId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const exam = await prisma.exam.findFirst({
    where: { id: params.examId, createdById: auth.session.userId },
  });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  const attempts = await prisma.examAttempt.findMany({
    where: { examId: exam.id },
    include: { answers: true },
    orderBy: { apellidos: "asc" },
  });

  const rows: ResultsCsvRow[] = attempts.map((a) => {
    const totals = computeTotalScore(a.answers);
    return {
      nombres: a.nombres,
      apellidos: a.apellidos,
      ci: a.ci,
      correo: a.correo,
      status: a.status,
      observedIp: a.observedIp,
      penaltyCount: a.penaltyCount,
      totalAutoScore: a.totalScore !== null ? a.totalAutoScore : totals.totalAutoScore,
      totalManualScore: a.totalScore !== null ? a.totalManualScore : totals.totalManualScore,
      totalScore: a.totalScore !== null ? a.totalScore : totals.totalScore,
      startedAt: a.startedAt.toISOString(),
      submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
    };
  });

  const csv = buildResultsCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="resultados-${exam.publicToken}.csv"`,
    },
  });
}
