import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";

export async function DELETE(request: NextRequest, { params }: { params: { subjectId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const subject = await prisma.subject.findFirst({
    where: { id: params.subjectId, createdById: auth.session.userId },
    include: { _count: { select: { exams: true } } },
  });
  if (!subject) {
    return NextResponse.json({ error: "Materia no encontrada." }, { status: 404 });
  }
  if (subject._count.exams > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: tiene ${subject._count.exams} examen(es) asociado(s).` },
      { status: 409 }
    );
  }

  await prisma.subject.delete({ where: { id: subject.id } });
  return NextResponse.json({ ok: true });
}
