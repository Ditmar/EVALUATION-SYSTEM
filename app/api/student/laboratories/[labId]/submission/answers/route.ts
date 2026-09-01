import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStudentSession } from "@/lib/auth/require-student";
import { mergeAnswer } from "@/lib/laboratory/submission";
import type { AnswersMap, AnswerValue } from "@/lib/laboratory/types";

const AnswerValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);
const BodySchema = z.object({ questionId: z.string().min(1), value: AnswerValueSchema });

/**
 * Merges one field into the submission's `answers` JSON — see `mergeAnswer`
 * in `lib/laboratory/submission.ts` for why per-field merge (rather than
 * resending the whole answers object) is what makes independent, per-field
 * debounced autosave safe from cross-field races.
 */
export async function PATCH(request: NextRequest, { params }: { params: { labId: string } }) {
  const auth = await requireStudentSession(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsedBody = BodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const submission = await prisma.laboratorySubmission.findFirst({
    where: { laboratoryId: params.labId, studentId: auth.session.studentId },
  });
  if (!submission) {
    return NextResponse.json({ error: "No has iniciado este laboratorio." }, { status: 404 });
  }
  if (submission.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Este laboratorio ya fue enviado." }, { status: 409 });
  }

  const nextAnswers = mergeAnswer(
    submission.answers as AnswersMap | null,
    parsedBody.data.questionId,
    parsedBody.data.value as AnswerValue
  );

  await prisma.laboratorySubmission.update({
    where: { id: submission.id },
    data: { answers: nextAnswers as unknown as Prisma.InputJsonValue },
  });

  return NextResponse.json({ ok: true });
}
