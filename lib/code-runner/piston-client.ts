import { codeRunLimits } from "./files";
import { buildJavaLauncher } from "./java-launcher";
import { buildTypeScriptLauncher } from "./ts-launcher";
import { COMPILE_ERROR_EXIT, extractCompileOutput } from "./launcher-protocol";
import { languageRuntime } from "./languages";
import type { IdeFile, IdeLanguage, RunResult, RunStatus } from "./types";

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function pistonSettings() {
  return {
    url: (process.env.PISTON_URL ?? "http://localhost:2000").replace(/\/+$/, ""),
    authToken: process.env.PISTON_AUTH_TOKEN?.trim() || undefined,
    runTimeoutMs: intEnv("CODE_RUN_TIMEOUT_MS", 3000),
    compileTimeoutMs: intEnv("CODE_COMPILE_TIMEOUT_MS", 10000),
    memoryMb: intEnv("CODE_RUN_MEMORY_MB", 256),
  };
}

interface PistonStage {
  stdout?: string;
  stderr?: string;
  output?: string;
  code?: number | null;
  signal?: string | null;
  /** Newer Piston builds: "TO" (timeout), "SG" (signal), "RE", "XX"... */
  status?: string | null;
  message?: string | null;
  wall_time?: number;
  memory?: number;
}

interface PistonExecuteResponse {
  language: string;
  version: string;
  run: PistonStage;
  compile?: PistonStage;
  message?: string;
}

export interface ExecuteInput {
  language: IdeLanguage;
  /** Entry first — see `resolveRunFiles`. */
  files: IdeFile[];
  stdin: string;
}

export class PistonUnavailableError extends Error {}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

function clean(text: string | undefined, maxBytes: number): { text: string; truncated: boolean } {
  const stripped = (text ?? "").replace(ANSI, "");
  const bytes = new TextEncoder().encode(stripped);
  if (bytes.length <= maxBytes) return { text: stripped, truncated: false };
  // Cut on a byte boundary, then drop a possibly-split trailing character.
  return { text: new TextDecoder().decode(bytes.slice(0, maxBytes)).replace(/�$/, ""), truncated: true };
}

/** Java and TypeScript compile inside the run stage (see the launchers), so their budget covers that too. */
function runTimeoutFor(language: IdeLanguage): number {
  const { runTimeoutMs, compileTimeoutMs } = pistonSettings();
  return language === "python" ? runTimeoutMs : runTimeoutMs + Math.min(compileTimeoutMs, 7000);
}

/** What actually gets sent to Piston for each language. */
function pistonFiles(language: IdeLanguage, files: IdeFile[]): IdeFile[] {
  switch (language) {
    case "java":
      return [buildJavaLauncher(files), ...files];
    case "typescript":
      return [buildTypeScriptLauncher(files)];
    case "python":
      return files;
  }
}

function classify(stage: PistonStage, timeoutMs: number, durationMs: number, memoryLimitBytes: number): RunStatus {
  if (stage.status === "TO") return "timeout";
  // The OOM killer shows up as exit 137 ("Killed") with memory at the cgroup limit.
  const nearMemoryLimit = typeof stage.memory === "number" && stage.memory >= memoryLimitBytes * 0.95;
  if ((stage.code === 137 || stage.signal === "SIGKILL") && nearMemoryLimit) return "memory";
  if (stage.signal === "SIGKILL") {
    if (stage.message && /memory/i.test(stage.message)) return "memory";
    if (stage.message && /time/i.test(stage.message)) return "timeout";
    // Older Piston builds don't say why; a kill near the deadline is a timeout.
    return durationMs >= timeoutMs * 0.9 ? "timeout" : "memory";
  }
  if (stage.code !== 0 && stage.code !== undefined && stage.code !== null) return "runtime_error";
  if (stage.signal) return "runtime_error";
  return "ok";
}

/** javac 15's errors for newer syntax are cryptic ("symbol: class record"); say why. */
function withJavaHints(language: IdeLanguage, output: string): string {
  if (language !== "java") return output;
  if (/records are a preview feature|symbol:\s+class record\b/.test(output)) {
    return `${output}
Nota: el entorno usa Java 15, donde "record" no está disponible. Use una clase con atributos y getters.
`;
  }
  return output;
}

/**
 * Runs code on our own Piston instance. Everything about *how* it runs —
 * runtime version, limits, entry order — is decided here from server config;
 * callers only pass validated files and stdin.
 */
export async function executeOnPiston(input: ExecuteInput): Promise<RunResult> {
  const settings = pistonSettings();
  const runtime = languageRuntime(input.language);
  const { maxOutputBytes } = codeRunLimits();
  const runTimeout = runTimeoutFor(input.language);
  const memoryBytes = settings.memoryMb * 1024 * 1024;

  const files = pistonFiles(input.language, input.files);

  const body = {
    language: runtime.piston,
    version: runtime.version,
    files: files.map((f) => ({ name: f.name, content: f.content })),
    stdin: input.stdin,
    args: [],
    compile_timeout: settings.compileTimeoutMs,
    run_timeout: runTimeout,
    compile_memory_limit: memoryBytes,
    run_memory_limit: memoryBytes,
  };

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(`${settings.url}/api/v2/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.authToken ? { Authorization: `Bearer ${settings.authToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(settings.compileTimeoutMs + runTimeout + 15_000),
    });
  } catch (error) {
    throw new PistonUnavailableError(`Piston no respondió: ${(error as Error).message}`);
  }
  const durationMs = Date.now() - started;

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new PistonUnavailableError(`Piston respondió ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as PistonExecuteResponse;
  if (!data.run) {
    throw new PistonUnavailableError(`Respuesta inesperada de Piston: ${data.message ?? "sin etapa run"}`);
  }

  const result: RunResult = {
    status: "ok",
    language: input.language,
    version: data.version ?? runtime.version,
    stdout: "",
    stderr: "",
    exitCode: data.run.code ?? null,
    signal: data.run.signal ?? null,
    durationMs,
    truncated: false,
  };

  // Piston's own compile stage (only compiles our TypeScript launcher): failing here is a launcher bug or a timeout.
  if (data.compile && data.compile.code !== 0) {
    const compileOut = clean(data.compile.output ?? `${data.compile.stdout ?? ""}${data.compile.stderr ?? ""}`, maxOutputBytes);
    const compileKilled = data.compile.signal === "SIGKILL" || data.compile.status === "TO";
    return {
      ...result,
      status: compileKilled ? "timeout" : "compile_error",
      compile: { output: compileOut.text, code: data.compile.code ?? null },
      exitCode: data.compile.code ?? null,
      signal: data.compile.signal ?? null,
      truncated: compileOut.truncated,
    };
  }

  let rawStderr = data.run.stderr ?? "";
  let launcherCompile: string | null = null;
  if (input.language !== "python" && data.run.code === COMPILE_ERROR_EXIT) {
    const split = extractCompileOutput(rawStderr);
    if (split) {
      launcherCompile = split.compile;
      rawStderr = split.rest;
    }
  }

  const stdout = clean(data.run.stdout, maxOutputBytes);
  const stderr = clean(rawStderr, maxOutputBytes);
  result.stdout = stdout.text;
  result.stderr = stderr.text;
  result.truncated = stdout.truncated || stderr.truncated;

  if (launcherCompile !== null) {
    const compileOut = clean(withJavaHints(input.language, launcherCompile), maxOutputBytes);
    return { ...result, status: "compile_error", compile: { output: compileOut.text, code: 1 }, exitCode: 1, truncated: compileOut.truncated };
  }

  result.status = classify(data.run, runTimeout, durationMs, memoryBytes);
  return result;
}

export interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}

export async function listPistonRuntimes(): Promise<PistonRuntime[]> {
  const settings = pistonSettings();
  const response = await fetch(`${settings.url}/api/v2/runtimes`, {
    headers: settings.authToken ? { Authorization: `Bearer ${settings.authToken}` } : {},
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!response.ok) throw new PistonUnavailableError(`Piston respondió ${response.status}`);
  return (await response.json()) as PistonRuntime[];
}
