import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLaboratoryAccess } from "@/lib/auth/require-admin";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";

export async function GET(request: NextRequest, { params }: { params: { labId: string; submissionId: string } }) {
  const auth = await requireLaboratoryAccess(request, params.labId);
  if ("response" in auth) return auth.response;
  const { laboratory } = auth;

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
