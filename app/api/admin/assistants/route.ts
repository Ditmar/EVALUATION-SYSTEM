import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { hashPassword } from "@/lib/auth/password";

/** Lists the ASSISTANT accounts this TEACHER created, with the subjects each can review. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;
  if (auth.session.role !== "TEACHER") {
    return NextResponse.json({ error: "No tienes permiso para ver esta página." }, { status: 403 });
  }

  const assistants = await prisma.user.findMany({
    where: { createdById: auth.session.userId, role: "ASSISTANT" },
    orderBy: { createdAt: "desc" },
    include: { subjectAccess: { include: { subject: { select: { id: true, name: true } } } } },
  });

  return NextResponse.json({
    assistants: assistants.map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      active: a.active,
      createdAt: a.createdAt,
      subjects: a.subjectAccess.map((g) => g.subject),
    })),
  });
}

const CreateAssistantSchema = z.object({
  email: z.string().email("Correo inválido."),
  name: z.string().trim().min(1).optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  subjectIds: z.array(z.string().min(1)).min(1, "Selecciona al menos una materia."),
});

/** Creates an ASSISTANT account scoped to a set of the caller's own subjects. Never lets an ASSISTANT create another one. */
export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;
  if (auth.session.role !== "TEACHER") {
    return NextResponse.json({ error: "No tienes permiso para crear ayudantes." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateAssistantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const { email, name, password, subjectIds } = parsed.data;

  const ownedSubjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds }, createdById: auth.session.userId },
    select: { id: true },
  });
  if (ownedSubjects.length !== new Set(subjectIds).size) {
    return NextResponse.json({ error: "Una o más materias seleccionadas no existen." }, { status: 400 });
  }

  try {
    const passwordHash = await hashPassword(password);
    const assistant = await prisma.user.create({
      data: {
        email,
        name: name ?? null,
        passwordHash,
        role: "ASSISTANT",
        createdById: auth.session.userId,
        subjectAccess: { create: subjectIds.map((subjectId) => ({ subjectId })) },
      },
      include: { subjectAccess: { include: { subject: { select: { id: true, name: true } } } } },
    });

    return NextResponse.json(
      {
        assistant: {
          id: assistant.id,
          email: assistant.email,
          name: assistant.name,
          active: assistant.active,
          createdAt: assistant.createdAt,
          subjects: assistant.subjectAccess.map((g) => g.subject),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
    }
    throw error;
  }
}
