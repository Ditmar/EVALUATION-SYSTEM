import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { ScreenCaptureIntervalSchema } from "@/lib/validation/exam-schema";

export async function GET(request: NextRequest, { params }: { params: { examId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const exam = await prisma.exam.findFirst({
    where: { id: params.examId, createdById: auth.session.userId },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ exam });
}

const PatchSchema = z
  .object({
    isPublished: z.boolean().optional(),
    accessMode: z.enum(["OPEN", "REGISTERED"]).optional(),
    requireScreenCapture: z.boolean().optional(),
    screenCaptureIntervalMinutes: ScreenCaptureIntervalSchema.optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Debe incluir al menos un campo a actualizar.",
  });

export async function PATCH(request: NextRequest, { params }: { params: { examId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const existing = await prisma.exam.findFirst({
    where: { id: params.examId, createdById: auth.session.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  const { isPublished, accessMode, requireScreenCapture, screenCaptureIntervalMinutes } = parsed.data;

  const exam = await prisma.exam.update({
    where: { id: params.examId },
    data: {
      ...(isPublished !== undefined && {
        isPublished,
        publishedAt: isPublished ? existing.publishedAt ?? new Date() : existing.publishedAt,
        closedAt: !isPublished ? new Date() : null,
      }),
      ...(accessMode !== undefined && { accessMode }),
      ...(requireScreenCapture !== undefined && { requireScreenCapture }),
      ...(screenCaptureIntervalMinutes !== undefined && { screenCaptureIntervalMinutes }),
    },
  });

  return NextResponse.json({ exam });
}
