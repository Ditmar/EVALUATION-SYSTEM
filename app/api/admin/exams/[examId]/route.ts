import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";

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

const PatchSchema = z.object({
  isPublished: z.boolean(),
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

  const exam = await prisma.exam.update({
    where: { id: params.examId },
    data: {
      isPublished: parsed.data.isPublished,
      publishedAt: parsed.data.isPublished ? existing.publishedAt ?? new Date() : existing.publishedAt,
      closedAt: !parsed.data.isPublished ? new Date() : null,
    },
  });

  return NextResponse.json({ exam });
}
