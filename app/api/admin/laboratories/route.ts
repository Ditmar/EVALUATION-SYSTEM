import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import { resolveLaboratoryRepositorySnapshots, syncLaboratoryRepositories } from "@/lib/laboratory/repository-sync";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  // TEACHER: everything they own (unchanged). ASSISTANT: only laboratories
  // in a subject they've been granted — never their own `createdById` (an
  // assistant never owns a laboratory).
  const where =
    auth.session.role === "ASSISTANT"
      ? {
          subjectId: {
            in: (
              await prisma.subjectAssistantAccess.findMany({
                where: { assistantId: auth.session.userId },
                select: { subjectId: true },
              })
            ).map((g) => g.subjectId),
          },
        }
      : { createdById: auth.session.userId };

  const laboratories = await prisma.laboratory.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      subject: { select: { id: true, name: true } },
      _count: { select: { submissions: true } },
    },
  });

  return NextResponse.json({
    laboratories: laboratories.map((lab) => {
      // Re-parsed on every list read rather than cached, since the source of
      // truth is `markdownSource` — cheap for the handful of labs a teacher owns.
      const parsed = parseLaboratory(lab.markdownSource);
      const questions = parsed.ok ? parsed.laboratory.questions : [];

      return {
        id: lab.id,
        title: lab.title,
        status: lab.status,
        version: lab.version,
        totalPoints: lab.totalPoints,
        durationMinutes: lab.durationMinutes,
        subject: { id: lab.subject.id, name: lab.subject.name },
        questionCount: questions.length,
        automaticCount: questions.filter((q) => q.evaluator === "automatic").length,
        manualCount: questions.filter((q) => q.evaluator === "manual").length,
        aiCount: questions.filter((q) => q.evaluator === "ai").length,
        submissionCount: lab._count.submissions,
        createdAt: lab.createdAt,
      };
    }),
  });
}

const CreateLaboratorySchema = z.object({
  markdownSource: z.string().min(1, "El contenido Markdown es requerido."),
  subjectId: z.string().min(1, "Selecciona una materia."),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;
  if (auth.session.role === "ASSISTANT") {
    return NextResponse.json({ error: "No tienes permiso para crear laboratorios." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = CreateLaboratorySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Datos inválidos.", issues: parsedBody.error.issues }, { status: 400 });
  }

  const parsed = parseLaboratory(parsedBody.data.markdownSource);
  if (!parsed.ok) {
    return NextResponse.json({ error: "El Markdown del laboratorio no es válido.", issues: parsed.errors }, { status: 400 });
  }

  const subject = await prisma.subject.findFirst({
    where: { id: parsedBody.data.subjectId, createdById: auth.session.userId },
  });
  if (!subject) {
    return NextResponse.json({ error: "Materia no encontrada." }, { status: 404 });
  }

  const totalPoints = parsed.laboratory.questions.reduce((sum, q) => sum + q.points, 0);

  try {
    const laboratory = await prisma.laboratory.create({
      data: {
        slug: parsed.laboratory.metadata.id,
        title: parsed.laboratory.metadata.title,
        markdownSource: parsedBody.data.markdownSource,
        version: parsed.laboratory.metadata.version,
        totalPoints,
        durationMinutes: parsed.laboratory.metadata.duration,
        status: parsed.laboratory.metadata.status.toUpperCase() as "DRAFT" | "PUBLISHED" | "ARCHIVED",
        subjectId: subject.id,
        createdById: auth.session.userId,
      },
    });

    await syncLaboratoryRepositories(laboratory.id, parsed.laboratory.repositories);
    if (laboratory.status === "PUBLISHED") {
      try {
        await resolveLaboratoryRepositorySnapshots(laboratory.id);
      } catch (error) {
        return NextResponse.json(
          { error: `El laboratorio se guardó, pero no se pudo congelar el repositorio base: ${(error as Error).message}` },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      {
        laboratory,
        summary: {
          questionCount: parsed.laboratory.questions.length,
          totalPoints,
          automaticCount: parsed.laboratory.questions.filter((q) => q.evaluator === "automatic").length,
          manualCount: parsed.laboratory.questions.filter((q) => q.evaluator === "manual").length,
          aiCount: parsed.laboratory.questions.filter((q) => q.evaluator === "ai").length,
        },
        warnings: parsed.warnings,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: `Ya existe un laboratorio con id "${parsed.laboratory.metadata.id}". Cambia el "id" del frontmatter.` },
        { status: 409 }
      );
    }
    throw error;
  }
}
