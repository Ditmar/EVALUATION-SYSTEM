import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Exam, ExamAttempt, Answer, Question } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkPublicRateLimit } from "@/lib/rate-limit-guard";
import { getStudentSessionFromRequest } from "@/lib/auth/student-session";
import { formatFilesAsText } from "@/lib/code-runner/files";
import { isIdeAnswerValue } from "@/lib/code-runner/types";

const ResultLookupSchema = z.object({
  ci: z.string().trim().min(3, "El carnet de identidad no es válido"),
  correo: z.string().trim().email("El correo electrónico no es válido"),
});

const NOT_FOUND_MESSAGE = "No se encontró un intento con esos datos para este examen.";

/** CODE_IDE answers show every file (`// ===== Main.java =====` sections). */
function codeAnswerText(answer: Answer | null): string | null {
  if (!answer) return null;
  const files = answer.codeFiles;
  return isIdeAnswerValue(files) ? formatFilesAsText(files.files) : answer.codeAnswer ?? null;
}

function buildResultResponse(
  exam: Exam & { questions: Question[] },
  attempt: ExamAttempt & { answers: Answer[] }
) {
  if (attempt.status === "IN_PROGRESS") {
    return NextResponse.json({ status: "in_progress" });
  }

  const answersByQuestionId = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const isFullyGraded = exam.questions
    .filter((q) => q.type === "CODE" || q.type === "CODE_IDE")
    .every((q) => {
      const answer = answersByQuestionId.get(q.id);
      return !answer || answer.gradedAt !== null;
    });

  if (!isFullyGraded) {
    return NextResponse.json({ status: "pending" });
  }

  const maxScore = exam.questions.reduce((sum, q) => sum + q.points, 0);

  const questions = exam.questions.map((q) => {
    const answer = answersByQuestionId.get(q.id) ?? null;
    const earnedScore = answer?.manualScore ?? answer?.autoScore ?? 0;

    return {
      order: q.order,
      statement: q.statement,
      type: q.type,
      points: q.points,
      earnedScore,
      isCorrect: answer?.isCorrect ?? null,
      options: q.options,
      correctAnswer: q.type === "SINGLE_CHOICE" ? q.correctAnswer : undefined,
      correctAnswers: q.type === "MULTIPLE_CHOICE" ? q.correctAnswers : undefined,
      selectedOption: answer?.selectedOption ?? null,
      selectedOptions: answer?.selectedOptions ?? null,
      codeAnswer: q.type === "CODE" || q.type === "CODE_IDE" ? codeAnswerText(answer) : undefined,
      teacherComment: q.type === "CODE" || q.type === "CODE_IDE" ? answer?.teacherComment ?? null : undefined,
    };
  });

  return NextResponse.json({
    status: "graded",
    student: { nombres: attempt.nombres, apellidos: attempt.apellidos },
    exam: { title: exam.title, subject: exam.subject },
    totalScore: attempt.totalScore ?? 0,
    maxScore,
    questions,
  });
}

/**
 * Session-based lookup for REGISTERED-mode students: the roster import never

 * collects a correo, so their ExamAttempt.correo is always empty and the
 * CI+correo form below can never match for them. A logged-in student instead
 * looks up their own attempt by ci from their session, no correo needed.
 */
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const session = await getStudentSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const exam = await prisma.exam.findUnique({
    where: { publicToken: params.token },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  const student = await prisma.student.findUnique({ where: { id: session.studentId } });
  if (!student) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const attempt = await prisma.examAttempt.findUnique({
    where: { examId_ci: { examId: exam.id, ci: student.ci } },
    include: { answers: true },
  });
  if (!attempt) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  return buildResultResponse(exam, attempt);
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const limited = checkPublicRateLimit(request, "result");
  if (limited) return limited;

  const exam = await prisma.exam.findUnique({
    where: { publicToken: params.token },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ResultLookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const attempt = await prisma.examAttempt.findUnique({
    where: { examId_ci: { examId: exam.id, ci: parsed.data.ci } },
    include: { answers: true },
  });

  if (!attempt || attempt.correo.trim().toLowerCase() !== parsed.data.correo.toLowerCase()) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  return buildResultResponse(exam, attempt);
}
