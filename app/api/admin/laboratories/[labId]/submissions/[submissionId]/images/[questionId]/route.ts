import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLaboratoryAccess } from "@/lib/auth/require-admin";
import { imageStoragePrefix } from "@/lib/laboratory/image-upload";
import { getReadUrl, isR2Configured } from "@/lib/storage/r2";
import type { AnswersMap } from "@/lib/laboratory/types";

/** Redirects the grading view to a student's uploaded image for one `image` question. */
export async function GET(
  request: NextRequest,
  { params }: { params: { labId: string; submissionId: string; questionId: string } }
) {
  const auth = await requireLaboratoryAccess(request, params.labId);
  if ("response" in auth) return auth.response;

  if (!isR2Configured()) {
    return NextResponse.json({ error: "El almacenamiento de imágenes no está configurado." }, { status: 503 });
  }

  const submission = await prisma.laboratorySubmission.findFirst({
    where: { id: params.submissionId, laboratoryId: auth.laboratory.id },
    select: { id: true, answers: true },
  });
  if (!submission) {
    return NextResponse.json({ error: "Entrega no encontrada." }, { status: 404 });
  }

  // Only keys under this submission's own prefix are served — see imageStoragePrefix.
  const value = (submission.answers as AnswersMap | null)?.[params.questionId];
  const prefix = imageStoragePrefix(params.labId, submission.id, params.questionId);
  if (typeof value !== "string" || !value.startsWith(prefix)) {
    return NextResponse.json({ error: "Sin imagen." }, { status: 404 });
  }

  const response = NextResponse.redirect(await getReadUrl(value), 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
