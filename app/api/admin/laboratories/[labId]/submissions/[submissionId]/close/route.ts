import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import { finalizeSubmission } from "@/lib/laboratory/submission";
import type { AnswersMap } from "@/lib/laboratory/types";

/**
 * The admin-side counterpart to `reopen`: closes a submission the admin had
 * reopened without waiting for the student to click "Enviar laboratorio"
 * themselves. Runs the exact same auto-grading pass as that student action
 * (`finalizeSubmission`), so a submission the admin closes ends up in
 * whichever status (SUBMITTED/GRADED) the student's own submit would have
 * produced.
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

  if (submission.status !== "IN_PROGRESS") {
    return NextResponse.json({ submission });
  }

  const parsed = parseLaboratory(submission.markdownSnapshot);
  if (!parsed.ok) {
    return NextResponse.json({ error: "No se pudo interpretar el laboratorio de esta entrega." }, { status: 500 });
  }

  const { grading, totalScore, status } = finalizeSubmission(parsed.laboratory, submission.answers as AnswersMap | null);

  const updated = await prisma.laboratorySubmission.update({
    where: { id: submission.id },
    data: {
      status,
      grading: grading as unknown as Prisma.InputJsonValue,
      totalScore,
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({ submission: updated });
}
