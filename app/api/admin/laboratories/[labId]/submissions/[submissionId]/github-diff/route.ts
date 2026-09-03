import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLaboratoryAccess } from "@/lib/auth/require-admin";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import { getLatestGithubAttempt } from "@/lib/laboratory/github-attempts";
import { getCompareDiff, parseRepositoryUrl } from "@/lib/github/github-service";

/** Teacher-facing diff viewer data: the latest GitHub attempt for a question, plus the actual file diff between its two frozen SHAs. */
export async function GET(request: NextRequest, { params }: { params: { labId: string; submissionId: string } }) {
  const auth = await requireLaboratoryAccess(request, params.labId);
  if ("response" in auth) return auth.response;
  const { laboratory } = auth;

  const questionId = request.nextUrl.searchParams.get("questionId");
  if (!questionId) {
    return NextResponse.json({ error: 'Falta el parámetro "questionId".' }, { status: 400 });
  }

  const submission = await prisma.laboratorySubmission.findFirst({
    where: { id: params.submissionId, laboratoryId: laboratory.id },
  });
  if (!submission) {
    return NextResponse.json({ error: "Entrega no encontrada." }, { status: 404 });
  }

  const parsed = parseLaboratory(submission.markdownSnapshot);
  if (!parsed.ok) {
    return NextResponse.json({ error: "No se pudo interpretar el laboratorio de esta entrega." }, { status: 500 });
  }

  const question = parsed.laboratory.questions.find((q) => q.id === questionId);
  if (!question || question.type !== "github-pr") {
    return NextResponse.json({ error: "Esta pregunta no tiene una entrega de GitHub." }, { status: 400 });
  }

  const repository = parsed.laboratory.repositories.find((r) => r.id === question.source);
  const baseRef = repository ? parseRepositoryUrl(repository.url) : null;
  if (!repository || !baseRef) {
    return NextResponse.json({ error: "El repositorio base de esta pregunta ya no está disponible." }, { status: 500 });
  }

  const attempt = await getLatestGithubAttempt(submission.id, question.id);
  if (!attempt) {
    return NextResponse.json({ error: "No hay una entrega de GitHub para esta pregunta." }, { status: 404 });
  }

  try {
    const diff = await getCompareDiff(baseRef.owner, baseRef.repo, attempt.baseCommitSha, attempt.headRepositoryOwner, attempt.submittedCommitSha);
    return NextResponse.json({ attempt, diff });
  } catch (error) {
    return NextResponse.json({ error: `No se pudo obtener el diff de GitHub: ${(error as Error).message}` }, { status: 502 });
  }
}
