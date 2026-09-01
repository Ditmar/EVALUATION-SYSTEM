import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";

export async function GET(request: NextRequest, { params }: { params: { labId: string; submissionId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const laboratory = await prisma.laboratory.findFirst({
    where: { id: params.labId, createdById: auth.session.userId },
  });
  if (!laboratory) {
    return NextResponse.json({ error: "Laboratorio no encontrado." }, { status: 404 });
  }

  const submission = await prisma.laboratorySubmission.findFirst({
    where: { id: params.submissionId, laboratoryId: laboratory.id },
    include: {
      student: { select: { id: true, ci: true, nombres: true, apellidos: true } },
      aiEvaluations: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!submission) {
    return NextResponse.json({ error: "Entrega no encontrada." }, { status: 404 });
  }

  // Grades and rendered content come from the exact source the student
  // answered against, not the (possibly since-edited) current Laboratory row.
  const parsed = parseLaboratory(submission.markdownSnapshot);
  if (!parsed.ok) {
    return NextResponse.json({ error: "No se pudo interpretar el laboratorio de esta entrega." }, { status: 500 });
  }

  return NextResponse.json({ submission, definition: parsed.laboratory });
}
