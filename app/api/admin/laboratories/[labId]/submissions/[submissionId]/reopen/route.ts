import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";

/**
 * Sends a SUBMITTED/GRADED submission back to IN_PROGRESS so the student can
 * fix and resend it (e.g. a botched pull request) — every student-facing
 * write endpoint (`submission/answers`, `github/submit`, `submission` POST)
 * already gates on `status === "IN_PROGRESS"`, so flipping it back is enough
 * to reopen the whole submission. `submittedAt` is cleared to match; grading
 * and totalScore are left as-is since resubmitting recomputes them anyway.
 */
export async function POST(request: NextRequest, { params }: { params: { labId: string; submissionId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const laboratory = await prisma.laboratory.findFirst({
    where: { id: params.labId, createdById: auth.session.userId },
  });
  if (!laboratory) {
    return NextResponse.json({ error: "Laboratorio no encontrado." }, { status: 404 });
  }

  const submission = await prisma.laboratorySubmission.findFirst({
    where: { id: params.submissionId, laboratoryId: laboratory.id },
  });
  if (!submission) {
    return NextResponse.json({ error: "Entrega no encontrada." }, { status: 404 });
  }

  if (submission.status === "IN_PROGRESS") {
    return NextResponse.json({ submission });
  }

  const updated = await prisma.laboratorySubmission.update({
    where: { id: submission.id },
    data: { status: "IN_PROGRESS", submittedAt: null },
  });

  return NextResponse.json({ submission: updated });
}
