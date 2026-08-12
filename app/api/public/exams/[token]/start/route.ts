import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStudentSession } from "@/lib/auth/require-student";
import { signAttemptSession, setAttemptCookie } from "@/lib/auth/attempt-session";
import { computeExpiresAt } from "@/lib/time";
import { extractClientIp } from "@/lib/ip-utils";
import { checkPublicRateLimit } from "@/lib/rate-limit-guard";

/**
 * REGISTERED-mode entry point: validates a logged-in student's enrollment,
 * then creates/resumes an `ExamAttempt` exactly like `register/route.ts`
 * does for the anonymous OPEN flow, and hands off to the same
 * `signAttemptSession`/`setAttemptCookie` — everything downstream (the
 * attempt page, answers, submit, grading, CSV export) is unchanged shared code.
 */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const limited = checkPublicRateLimit(request, "start");
  if (limited) return limited;

  const exam = await prisma.exam.findUnique({ where: { publicToken: params.token } });
  if (!exam || !exam.isPublished) {
    return NextResponse.json({ error: "Examen no encontrado o no disponible." }, { status: 404 });
  }
  if (exam.accessMode !== "REGISTERED") {
    return NextResponse.json(
      { error: "Este examen usa el flujo de registro abierto." },
      { status: 400 }
    );
  }

  const auth = await requireStudentSession(request);
  if ("response" in auth) return auth.response;

  const student = await prisma.student.findUnique({ where: { id: auth.session.studentId } });
  if (!student) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!exam.subjectId) {
    return NextResponse.json(
      { error: "Este examen no tiene una materia configurada." },
      { status: 409 }
    );
  }

  const enrolled = await prisma.enrollment.findUnique({
    where: { studentId_subjectId: { studentId: student.id, subjectId: exam.subjectId } },
  });
  if (!enrolled) {
    return NextResponse.json(
      { error: "No estás matriculado en la materia de este examen." },
      { status: 403 }
    );
  }

  const trustProxy = process.env.TRUST_PROXY === "true";
  const observedIp = extractClientIp(request.headers, trustProxy, request.ip ?? null);

  const existing = await prisma.examAttempt.findUnique({
    where: { examId_ci: { examId: exam.id, ci: student.ci } },
  });

  let attemptId: string;

  if (existing) {
    if (existing.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Ya existe un intento finalizado registrado para este examen." },
        { status: 409 }
      );
    }
    attemptId = existing.id;
  } else {
    const startedAt = new Date();
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentId: student.id,
        nombres: student.nombres,
        apellidos: student.apellidos,
        ci: student.ci,
        correo: student.correo ?? "",
        startedAt,
        expiresAt: computeExpiresAt(startedAt, exam.durationMinutes),
        observedIp,
      },
    });
    attemptId = attempt.id;
  }

  const jwt = await signAttemptSession({ examId: exam.id, attemptId });
  const response = NextResponse.json({ redirectUrl: `/exam/${params.token}/attempt` }, { status: 201 });
  setAttemptCookie(response, params.token, jwt);
  return response;
}
