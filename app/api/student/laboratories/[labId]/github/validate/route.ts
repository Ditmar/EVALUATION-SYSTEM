import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireStudentSession } from "@/lib/auth/require-student";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import { validatePullRequestSubmission } from "@/lib/laboratory/github-submission";

const BodySchema = z.object({ questionId: z.string().min(1), pullRequestUrl: z.string().min(1) });

/**
 * Validates a pasted PR URL against GitHub and reports a checklist-style
 * summary — persists nothing. `submit` (the sibling route) re-runs this
 * exact same pipeline from scratch before actually freezing an attempt, so
 * nothing shown here is ever trusted later.
 */
export async function POST(request: NextRequest, { params }: { params: { labId: string } }) {
  const auth = await requireStudentSession(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsedBody = BodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const submission = await prisma.laboratorySubmission.findFirst({
    where: { laboratoryId: params.labId, studentId: auth.session.studentId },
  });
  if (!submission) {
    return NextResponse.json({ error: "No has iniciado este laboratorio." }, { status: 404 });
  }
  if (submission.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Este laboratorio ya fue enviado." }, { status: 409 });
  }

  const parsed = parseLaboratory(submission.markdownSnapshot);
  if (!parsed.ok) {
    return NextResponse.json({ error: "No se pudo interpretar el laboratorio." }, { status: 500 });
  }

  try {
    const { pullRequest } = await validatePullRequestSubmission(parsed.laboratory, parsedBody.data.questionId, parsedBody.data.pullRequestUrl);

    return NextResponse.json({
      valid: true,
      pullRequest: {
        number: pullRequest.number,
        state: pullRequest.state,
        repository: `${pullRequest.head.owner}/${pullRequest.head.repo}`,
        branch: pullRequest.head.branch,
        headSha: pullRequest.head.sha,
      },
      changes: {
        commits: pullRequest.commits,
        files: pullRequest.changedFiles,
        additions: pullRequest.additions,
        deletions: pullRequest.deletions,
      },
    });
  } catch (error) {
    // Every failure here is an expected "this PR isn't valid" outcome (bad
    // url, not found, wrong base repo, merged/closed) — not a server fault.
    return NextResponse.json({ valid: false, error: (error as Error).message });
  }
}
