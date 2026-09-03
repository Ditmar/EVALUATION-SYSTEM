import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";

const UpdateAssistantSchema = z
  .object({
    active: z.boolean().optional(),
    subjectIds: z.array(z.string().min(1)).optional(),
  })
  .refine((data) => data.active !== undefined || data.subjectIds !== undefined, {
    message: "No hay cambios que aplicar.",
  });

/** An assistant is only ever managed by the TEACHER who created it — never by another teacher, and never by itself. */
async function requireOwnedAssistant(userId: string, assistantId: string) {
  return prisma.user.findFirst({ where: { id: assistantId, createdById: userId, role: "ASSISTANT" } });
}

export async function PATCH(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;
  if (auth.session.role !== "TEACHER") {
    return NextResponse.json({ error: "No tienes permiso para modificar ayudantes." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateAssistantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const assistant = await requireOwnedAssistant(auth.session.userId, params.assistantId);
  if (!assistant) {
    return NextResponse.json({ error: "Ayudante no encontrado." }, { status: 404 });
  }

  if (parsed.data.subjectIds) {
    const ownedSubjects = await prisma.subject.findMany({
      where: { id: { in: parsed.data.subjectIds }, createdById: auth.session.userId },
      select: { id: true },
    });
    if (ownedSubjects.length !== new Set(parsed.data.subjectIds).size) {
      return NextResponse.json({ error: "Una o más materias seleccionadas no existen." }, { status: 400 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.active !== undefined) {
      await tx.user.update({ where: { id: assistant.id }, data: { active: parsed.data.active } });
    }
    if (parsed.data.subjectIds) {
      // Full replace: simpler and safer than diffing add/remove sets, and this
      // is an infrequent admin action, not a hot path.
      await tx.subjectAssistantAccess.deleteMany({ where: { assistantId: assistant.id } });
      await tx.subjectAssistantAccess.createMany({
        data: parsed.data.subjectIds.map((subjectId) => ({ subjectId, assistantId: assistant.id })),
      });
    }
    return tx.user.findUniqueOrThrow({
      where: { id: assistant.id },
      include: { subjectAccess: { include: { subject: { select: { id: true, name: true } } } } },
    });
  });

  return NextResponse.json({
    assistant: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      active: updated.active,
      createdAt: updated.createdAt,
      subjects: updated.subjectAccess.map((g) => g.subject),
    },
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;
  if (auth.session.role !== "TEACHER") {
    return NextResponse.json({ error: "No tienes permiso para eliminar ayudantes." }, { status: 403 });
  }

  const assistant = await requireOwnedAssistant(auth.session.userId, params.assistantId);
  if (!assistant) {
    return NextResponse.json({ error: "Ayudante no encontrado." }, { status: 404 });
  }

  await prisma.user.delete({ where: { id: assistant.id } });
  return NextResponse.json({ ok: true });
}
