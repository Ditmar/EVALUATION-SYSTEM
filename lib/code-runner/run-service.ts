import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { RateLimiter } from "@/lib/rate-limit";
import { resolveRunFiles, resolveStdin, MAX_FILES_CEILING } from "./files";
import { executeOnPiston, PistonUnavailableError } from "./piston-client";
import type { IdeConfig, RunResult } from "./types";

/**
 * The client may send only these: files and stdin. Language, version,
 * limits and entry always come from the question (see `resolveRunFiles`).
 */
export const RunRequestSchema = z.object({
  questionId: z.string().min(1).max(200),
  files: z
    .array(z.object({ name: z.string().min(1).max(64), content: z.string().max(1024 * 1024) }))
    .min(1)
    .max(MAX_FILES_CEILING),
  stdin: z.string().max(1024 * 1024).optional(),
});
export type RunRequest = z.infer<typeof RunRequestSchema>;

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Per attempt/submission — never per IP (a whole classroom shares one NAT). */
const runRateLimiter = new RateLimiter(intEnv("CODE_RUN_RATE_PER_MIN", 10), 60_000);

/**
 * In-memory concurrency gate for the whole app process — same single-
 * container assumption as `RateLimiter`. Piston has its own job queue, but
 * this keeps one busy classroom from piling up requests that would only
 * time out on our side anyway.
 */
class Semaphore {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(private readonly max: number) {}

  async acquire(timeoutMs: number): Promise<boolean> {
    if (this.active < this.max) {
      this.active++;
      return true;
    }
    return new Promise<boolean>((resolve) => {
      const grant = () => {
        clearTimeout(timer);
        this.active++;
        resolve(true);
      };
      const timer = setTimeout(() => {
        this.queue = this.queue.filter((g) => g !== grant);
        resolve(false);
      }, timeoutMs);
      this.queue.push(grant);
    });
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

const runSemaphore = new Semaphore(intEnv("CODE_RUN_MAX_CONCURRENCY", 4));

export type RunOwner =
  | { context: "EXAM"; attemptId: string }
  | { context: "LAB"; submissionId: string }
  | { context: "ADMIN"; userId: string };

function ownerKey(owner: RunOwner): string {
  switch (owner.context) {
    case "EXAM":
      return `attempt:${owner.attemptId}`;
    case "LAB":
      return `submission:${owner.submissionId}`;
    case "ADMIN":
      return `admin:${owner.userId}`;
  }
}

function ownerWhere(owner: RunOwner, questionId: string) {
  if (owner.context === "EXAM") return { attemptId: owner.attemptId, questionId };
  if (owner.context === "LAB") return { submissionId: owner.submissionId, questionId };
  return null;
}

function hashFiles(files: { name: string; content: string }[], stdin: string): string {
  const h = createHash("sha256");
  for (const f of files) h.update(f.name).update("\0").update(f.content).update("\0");
  h.update(stdin);
  return h.digest("hex");
}

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Everything a `/run` route does after authenticating and loading the
 * question: limits, Piston call, history. Routes only differ in how they
 * find the owner and the `IdeConfig`.
 */
export async function runIdeQuestion(owner: RunOwner, config: IdeConfig, request: RunRequest): Promise<NextResponse> {
  if (!config.runEnabled && owner.context !== "ADMIN") {
    return error(403, "Esta pregunta no permite ejecutar código.");
  }

  const files = resolveRunFiles(config, request.files);
  if (!files.ok) return error(400, files.error);
  const stdin = resolveStdin(config, request.stdin);
  if (!stdin.ok) return error(400, stdin.error);

  if (!runRateLimiter.check(ownerKey(owner)).allowed) {
    return error(429, "Demasiadas ejecuciones seguidas. Espere unos segundos e intente de nuevo.");
  }

  const where = ownerWhere(owner, request.questionId);
  let runsUsed: number | undefined;
  if (where && config.runLimit !== undefined) {
    runsUsed = await prisma.codeRun.count({ where: { ...where, status: { not: "unavailable" } } });
    if (runsUsed >= config.runLimit) {
      return error(429, `Alcanzó el máximo de ${config.runLimit} ejecuciones para esta pregunta.`);
    }
  }

  if (!(await runSemaphore.acquire(10_000))) {
    return error(503, "El servidor de ejecución está ocupado. Intente de nuevo en unos segundos.");
  }

  let result: RunResult;
  try {
    result = await executeOnPiston({ language: config.language, files: files.files, stdin: stdin.stdin });
  } catch (e) {
    if (e instanceof PistonUnavailableError) {
      console.error("[code-runner]", e.message);
      return error(503, "El servidor de ejecución no está disponible. Avise al docente.");
    }
    throw e;
  } finally {
    runSemaphore.release();
  }

  await prisma.codeRun.create({
    data: {
      context: owner.context,
      attemptId: owner.context === "EXAM" ? owner.attemptId : null,
      submissionId: owner.context === "LAB" ? owner.submissionId : null,
      userId: owner.context === "ADMIN" ? owner.userId : null,
      questionId: request.questionId,
      language: result.language,
      version: result.version,
      filesHash: hashFiles(files.files, stdin.stdin),
      status: result.status,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      compileOut: result.compile?.output ?? null,
      durationMs: result.durationMs,
    },
  });

  if (runsUsed !== undefined) {
    result.runsUsed = runsUsed + 1;
    result.runsLimit = config.runLimit;
  }
  return NextResponse.json(result);
}

export interface CodeRunSummary {
  total: number;
  byStatus: Record<string, number>;
  last: { status: string; exitCode: number | null; stdout: string; stderr: string; compileOut: string | null; durationMs: number; createdAt: Date } | null;
}

/** For the grading views and the AI prompt. */
export async function summarizeRuns(where: { attemptId: string } | { submissionId: string }, questionId: string): Promise<CodeRunSummary> {
  const runs = await prisma.codeRun.findMany({
    where: { ...where, questionId },
    orderBy: { createdAt: "desc" },
    select: { status: true, exitCode: true, stdout: true, stderr: true, compileOut: true, durationMs: true, createdAt: true },
  });
  const byStatus: Record<string, number> = {};
  for (const r of runs) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  return { total: runs.length, byStatus, last: runs[0] ?? null };
}

/** Run counts per question, for showing "ejecuciones N/M" when a page loads. */
export async function countRunsByQuestion(where: { attemptId: string } | { submissionId: string }): Promise<Record<string, number>> {
  const rows = await prisma.codeRun.groupBy({
    by: ["questionId"],
    where: { ...where, status: { not: "unavailable" } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.questionId, r._count._all]));
}
