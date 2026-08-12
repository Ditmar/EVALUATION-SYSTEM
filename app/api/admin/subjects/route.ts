import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const subjects = await prisma.subject.findMany({
    where: { createdById: auth.session.userId },
    orderBy: { name: "asc" },
    include: { _count: { select: { exams: true, enrollments: true } } },
  });

  return NextResponse.json({
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      examCount: s._count.exams,
      studentCount: s._count.enrollments,
      createdAt: s.createdAt,
    })),
  });
}

const CreateSubjectSchema = z.object({ name: z.string().trim().min(1, "El nombre es requerido") });

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = CreateSubjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "El nombre de la materia es requerido." }, { status: 400 });
  }

  try {
    const subject = await prisma.subject.create({
      data: { name: parsed.data.name, createdById: auth.session.userId },
    });
    return NextResponse.json({ subject }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe una materia con ese nombre." }, { status: 409 });
    }
    throw error;
  }
}
