import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { asIdeConfig, normalizeIdeConfig } from "@/lib/code-runner/ide-config";
import { RunRequestSchema, runIdeQuestion } from "@/lib/code-runner/run-service";

const AdminRunSchema = RunRequestSchema.extend({ config: z.unknown() });

/**
 * Teacher-side runs: import previews (the exam/lab is not saved yet) and
 * re-running a student's answer in the grading views. Staff are trusted to
 * send the question config, but it is re-normalized here so the same file
 * rules apply, and every server-side limit (size, rate, Piston timeouts)
 * still holds.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const parsedBody = AdminRunSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const raw = asIdeConfig(parsedBody.data.config);
  if (!raw) {
    return NextResponse.json({ error: "Configuración de la pregunta inválida." }, { status: 400 });
  }
  const normalized = normalizeIdeConfig(parsedBody.data.questionId, { ...raw, files: raw.starterFiles, run: true });
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.errors[0] }, { status: 400 });
  }

  // Teachers may run files the student created, whatever the template allows.
  const config = { ...normalized.config, allowNewFiles: true, maxFiles: 20, runLimit: undefined };
  return runIdeQuestion({ context: "ADMIN", userId: auth.session.userId }, config, parsedBody.data);
}
