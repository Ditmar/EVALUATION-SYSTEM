import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { ExamImportSchema } from "@/lib/validation/exam-schema";
import { generatePublicToken } from "@/lib/tokens";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const exams = await prisma.exam.findMany({
    where: { createdById: auth.session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: true, attempts: true } },
    },
  });

  return NextResponse.json({
    exams: exams.map((exam) => ({
      id: exam.id,
      title: exam.title,
      subject: exam.subject,
      academicTerm: exam.academicTerm,
      examDate: exam.examDate,
      isPublished: exam.isPublished,
      publicToken: exam.publicToken,
      questionCount: exam._count.questions,
      attemptCount: exam._count.attempts,
      createdAt: exam.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "El cuerpo debe ser un JSON válido." }, { status: 400 });
  }

  const parsed = ExamImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "El JSON del examen no es válido.", issues: parsed.error.issues }, { status: 400 });
  }

  const { metadata, settings, questions } = parsed.data;

  const exam = await prisma.exam.create({
    data: {
      title: metadata.title,
      career: metadata.career,
      academicTerm: metadata.academicTerm,
      subject: metadata.subject,
      examDate: new Date(`${metadata.examDate}T00:00:00.000Z`),
      durationMinutes: metadata.durationMinutes,
      instructions: metadata.instructions,
      evaluationType: metadata.evaluationType,
      maxPenalties: settings.maxPenalties,
      onMaxPenalties: settings.onMaxPenalties.toUpperCase() as "AUTO_SUBMIT" | "WARN_ONLY" | "LOCK_EXAM",
      trackFocusEvents: settings.trackFocusEvents,
      monitorExternalIps: settings.monitorExternalIps,
      differentIpPolicy: settings.differentIpPolicy.toUpperCase() as "OFF" | "WARN_ONLY" | "BLOCK",
      allowAiCodeEvaluation: settings.allowAiCodeEvaluation,
      publicToken: generatePublicToken(),
      createdById: auth.session.userId,
      questions: {
        create: questions.map((q, index) => ({
          externalId: q.id,
          type: q.type.toUpperCase() as "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "CODE",
          statement: q.statement,
          points: q.points,
          order: index,
          options: "options" in q ? q.options : undefined,
          correctAnswer: "correctAnswer" in q ? q.correctAnswer : undefined,
          correctAnswers: "correctAnswers" in q ? q.correctAnswers : undefined,
          language: "language" in q ? q.language : undefined,
          expectedSolution: "expectedSolution" in q ? q.expectedSolution : undefined,
          rubric: "rubric" in q ? q.rubric : undefined,
          enableAiEvaluation: "enableAiEvaluation" in q ? q.enableAiEvaluation : false,
        })),
      },
    },
    include: { questions: true },
  });

  return NextResponse.json({ exam }, { status: 201 });
}
