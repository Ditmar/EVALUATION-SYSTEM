import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { StudentRegistrationSchema } from "@/lib/validation/student-schema";
import { computeExpiresAt } from "@/lib/time";
import { signAttemptSession } from "@/lib/auth/attempt-session";
import { setAttemptCookie } from "@/lib/auth/attempt-session";
import { extractClientIp } from "@/lib/ip-utils";
import { checkPublicRateLimit } from "@/lib/rate-limit-guard";

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const limited = checkPublicRateLimit(request, "register");
  if (limited) return limited;

  const exam = await prisma.exam.findUnique({ where: { publicToken: params.token } });
  if (!exam || !exam.isPublished) {
    return NextResponse.json({ error: "Examen no encontrado o no disponible." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = StudentRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { nombres, apellidos, ci, correo } = parsed.data;

  const trustProxy = process.env.TRUST_PROXY === "true";
  const observedIp = extractClientIp(request.headers, trustProxy, request.ip ?? null);

  // Resume: if this CI already has an attempt for this exam, hand back that
  // attempt instead of erroring, so a student who legitimately fills the form
  // again (e.g. lost their cookie) doesn't get blocked outright as long as
  // their exam is still in progress. If it belongs to someone else's browser
  // and is already finished, we still refuse a second run.
  const existing = await prisma.examAttempt.findUnique({
    where: { examId_ci: { examId: exam.id, ci } },
  });

  let attemptId: string;

  if (existing) {
    if (existing.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Ya existe un intento finalizado registrado con este número de carnet para este examen." },
        { status: 409 }
      );
    }
    attemptId = existing.id;
  } else {
    const startedAt = new Date();
    try {
      const attempt = await prisma.examAttempt.create({
        data: {
          examId: exam.id,
          nombres,
          apellidos,
          ci,
          correo,
          startedAt,
          expiresAt: computeExpiresAt(startedAt, exam.durationMinutes),
          observedIp,
        },
      });
      attemptId = attempt.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json(
          { error: "Ya existe un intento registrado con este número de carnet para este examen." },
          { status: 409 }
        );
      }
      throw error;
    }
  }

  const jwt = await signAttemptSession({ examId: exam.id, attemptId });
  const response = NextResponse.json({ redirectUrl: `/exam/${params.token}/attempt` }, { status: 201 });
  setAttemptCookie(response, params.token, jwt);
  return response;
}
