import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStudentSession } from "@/lib/auth/require-student";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import { pickIdeConfig } from "@/lib/code-runner/ide-config";
import { RunRequestSchema, runIdeQuestion } from "@/lib/code-runner/run-service";

/**
 * Runs a student's `ide` answer on Piston. The question config comes from the
 * submission's own `markdownSnapshot` (what the student is answering), never
 * from the request — the client only sends files and stdin.
 */
export async function POST(request: NextRequest, { params }: { params: { labId: string } }) {
  const auth = await requireStudentSession(request);
  if ("response" in auth) return auth.response;

  const parsedBody = RunRequestSchema.safeParse(await request.json().catch(() => null));
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

  const parsed = parseLaboratory(submission.markdownSnapshot);
  if (!parsed.ok) {
    return NextResponse.json({ error: "No se pudo interpretar el laboratorio." }, { status: 500 });
  }
  const question = parsed.laboratory.questions.find((q) => q.id === parsedBody.data.questionId);
  if (!question || question.type !== "ide") {
    return NextResponse.json({ error: "Pregunta no encontrada." }, { status: 404 });
  }

  return runIdeQuestion({ context: "LAB", submissionId: submission.id }, pickIdeConfig(question), parsedBody.data);
}
