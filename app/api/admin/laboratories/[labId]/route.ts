import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { LaboratoryStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminSession, requireLaboratoryAccess } from "@/lib/auth/require-admin";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import { resolveLaboratoryRepositorySnapshots, syncLaboratoryRepositories } from "@/lib/laboratory/repository-sync";

/** Read access: the owning TEACHER, or an ASSISTANT granted this laboratory's subject — see `requireLaboratoryAccess`. */
export async function GET(request: NextRequest, { params }: { params: { labId: string } }) {
  const auth = await requireLaboratoryAccess(request, params.labId);
  if ("response" in auth) return auth.response;
  const { laboratory: lab } = auth;

  const subject = await prisma.subject.findUnique({ where: { id: lab.subjectId }, select: { id: true, name: true } });
  const laboratory = { ...lab, subject };

  const parsed = parseLaboratory(laboratory.markdownSource);
  if (!parsed.ok) {
    // Shouldn't happen (validated at creation/update), but the row could have
    // been edited out-of-band — surface it instead of crashing the page.
    return NextResponse.json({ laboratory, parseErrors: parsed.errors });
  }

  return NextResponse.json({ laboratory, definition: parsed.laboratory, warnings: parsed.warnings });
}

const UpdateSchema = z.union([
  z.object({ markdownSource: z.string().min(1) }),
  z.object({ status: z.enum(["draft", "published", "archived"]) }),
]);

export async function PATCH(request: NextRequest, { params }: { params: { labId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsedBody = UpdateSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const existing = await prisma.laboratory.findFirst({
    where: { id: params.labId, createdById: auth.session.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Laboratorio no encontrado." }, { status: 404 });
  }

  if ("status" in parsedBody.data) {
    const nextStatus = parsedBody.data.status.toUpperCase() as LaboratoryStatus;
    const laboratory = await prisma.laboratory.update({
      where: { id: existing.id },
      data: { status: nextStatus },
    });

    // Every (re-)publish is a fresh reproducibility checkpoint — the base
    // repository's HEAD is re-resolved even if `{{repository}}` itself
    // didn't change, so grading stays stable even if the branch moves later.
    if (nextStatus === "PUBLISHED") {
      try {
        await resolveLaboratoryRepositorySnapshots(laboratory.id);
      } catch (error) {
        return NextResponse.json(
          { error: `El laboratorio se publicó, pero no se pudo congelar el repositorio base: ${(error as Error).message}` },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ laboratory });
  }

  const parsed = parseLaboratory(parsedBody.data.markdownSource);
  if (!parsed.ok) {
    return NextResponse.json({ error: "El Markdown del laboratorio no es válido.", issues: parsed.errors }, { status: 400 });
  }

  if (parsed.laboratory.metadata.id !== existing.slug) {
    return NextResponse.json(
      { error: `El "id" del frontmatter no puede cambiar ("${existing.slug}" → "${parsed.laboratory.metadata.id}"). Crea un nuevo laboratorio si necesitas otro id.` },
      { status: 400 }
    );
  }

  const totalPoints = parsed.laboratory.questions.reduce((sum, q) => sum + q.points, 0);

  const laboratory = await prisma.laboratory.update({
    where: { id: existing.id },
    data: {
      markdownSource: parsedBody.data.markdownSource,
      title: parsed.laboratory.metadata.title,
      version: existing.version + 1,
      totalPoints,
      durationMinutes: parsed.laboratory.metadata.duration,
    },
  });

  // Keeps LaboratoryRepository rows in sync with the markdown's current
  // {{repository}} blocks — nulls a resource's frozen `commitSha` if its
  // url/branch just changed, even on an already-published lab (this route
  // doesn't otherwise gate on status), forcing an explicit republish before
  // new GitHub submissions can be accepted against it.
  await syncLaboratoryRepositories(laboratory.id, parsed.laboratory.repositories);

  return NextResponse.json({ laboratory, warnings: parsed.warnings });
}

export async function DELETE(request: NextRequest, { params }: { params: { labId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const existing = await prisma.laboratory.findFirst({
    where: { id: params.labId, createdById: auth.session.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Laboratorio no encontrado." }, { status: 404 });
  }

  await prisma.laboratory.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
