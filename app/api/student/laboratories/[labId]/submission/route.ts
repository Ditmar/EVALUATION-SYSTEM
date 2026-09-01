import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStudentSession } from "@/lib/auth/require-student";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import { toStudentLaboratory } from "@/lib/laboratory/strip-answer-key";
import { evaluate } from "@/lib/laboratory/evaluation/engine";
import { computeTotalScore } from "@/lib/laboratory/submission";
import type { AnswersMap, GradingMap } from "@/lib/laboratory/types";

async function requireEnrolledPublishedLab(labId: string, studentId: string) {
  const laboratory = await prisma.laboratory.findFirst({ where: { id: labId, status: "PUBLISHED" } });
  if (!laboratory) return { error: "Laboratorio no encontrado." as const };

  const enrolled = await prisma.enrollment.findUnique({
    where: { studentId_subjectId: { studentId, subjectId: laboratory.subjectId } },
  });
  if (!enrolled) return { error: "No estás matriculado en la materia de este laboratorio." as const };

  return { laboratory };
}

/**
 * GET creates the submission on first call (snapshotting the Laboratory's
 * current `markdownSource`+`version` so later teacher edits can't retroactively
 * change what this student is graded against) and returns the current state
 * on every subsequent call — this doubles as both "start" and "resume".
 */
export async function GET(request: NextRequest, { params }: { params: { labId: string } }) {
  const auth = await requireStudentSession(request);
  if ("response" in auth) return auth.response;

  const result = await requireEnrolledPublishedLab(params.labId, auth.session.studentId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  const { laboratory } = result;

  let submission = await prisma.laboratorySubmission.findUnique({
    where: { laboratoryId_studentId: { laboratoryId: laboratory.id, studentId: auth.session.studentId } },
  });

  if (!submission) {
    submission = await prisma.laboratorySubmission.create({
      data: {
        laboratoryId: laboratory.id,
        studentId: auth.session.studentId,
        laboratoryVersion: laboratory.version,
        markdownSnapshot: laboratory.markdownSource,
      },
    });
  }

  const parsed = parseLaboratory(submission.markdownSnapshot);
  if (!parsed.ok) {
    return NextResponse.json({ error: "No se pudo interpretar el laboratorio." }, { status: 500 });
  }

  return NextResponse.json({
    laboratory: toStudentLaboratory(parsed.laboratory),
    submissionId: submission.id,
    status: submission.status,
    answers: submission.answers,
    totalScore: submission.totalScore,
  });
}

/** Marks the submission SUBMITTED and computes whatever the engine can score automatically. */
export async function POST(request: NextRequest, { params }: { params: { labId: string } }) {
  const auth = await requireStudentSession(request);
  if ("response" in auth) return auth.response;

  const submission = await prisma.laboratorySubmission.findFirst({
    where: { laboratoryId: params.labId, studentId: auth.session.studentId },
  });
  if (!submission) {
    return NextResponse.json({ error: "No has iniciado este laboratorio." }, { status: 404 });
  }
  if (submission.status !== "IN_PROGRESS") {
    return NextResponse.json({ submission });
  }

  const parsed = parseLaboratory(submission.markdownSnapshot);
  if (!parsed.ok) {
    return NextResponse.json({ error: "No se pudo interpretar el laboratorio." }, { status: 500 });
  }

  const answers = (submission.answers as AnswersMap | null) ?? {};
  const grading: GradingMap = {};
  for (const question of parsed.laboratory.questions) {
    const result = evaluate(question, answers[question.id]);
    grading[question.id] = {
      evaluator: result.evaluator,
      status: result.status,
      autoScore: result.evaluator === "automatic" ? result.score : undefined,
      finalScore: result.score,
      feedback: result.feedback,
    };
  }

  const totalScore = computeTotalScore(grading);
  const allAutoGraded = parsed.laboratory.questions.every((q) => grading[q.id].status !== "pending_review");

  const updated = await prisma.laboratorySubmission.update({
    where: { id: submission.id },
    data: {
      status: allAutoGraded ? "GRADED" : "SUBMITTED",
      grading: grading as unknown as Prisma.InputJsonValue,
      totalScore,
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({ submission: updated });
}
