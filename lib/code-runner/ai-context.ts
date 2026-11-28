import { formatFilesAsText } from "./files";
import type { CodeRunSummary } from "./run-service";
import type { IdeAnswerValue, IdeConfig } from "./types";

const MAX_OUTPUT_FOR_AI = 2000;

function head(text: string): string {
  return text.length > MAX_OUTPUT_FOR_AI ? `${text.slice(0, MAX_OUTPUT_FOR_AI)}\n… (truncado)` : text;
}

/**
 * The "student answer" text the AI grader sees for an `ide` question: every
 * file (read-only ones marked as given), plus the student's run history as
 * evidence. The prompt wording makes clear output is evidence, not proof.
 */
export function buildIdeAnswerTextForAi(config: IdeConfig, value: IdeAnswerValue | undefined, runs: CodeRunSummary | null): string {
  const files = value?.files ?? [];
  if (files.every((f) => !f.content.trim())) return "";

  const parts = [
    `Archivo principal: ${config.entry}`,
    formatFilesAsText(files),
  ];

  const readonlyFiles = config.starterFiles.filter((f) => f.readonly);
  if (readonlyFiles.length > 0) {
    parts.push(`Archivos provistos por el docente (no los escribió el estudiante): ${readonlyFiles.map((f) => f.name).join(", ")}`);
  }

  if (value?.stdin) parts.push(`Entrada (stdin) usada por el estudiante:\n${head(value.stdin)}`);

  if (runs && runs.total > 0 && runs.last) {
    const counts = Object.entries(runs.byStatus).map(([s, n]) => `${s}: ${n}`).join(", ");
    parts.push(
      [
        `Ejecuciones del estudiante: ${runs.total} (${counts}). Úsalas como evidencia del proceso, no como prueba de corrección.`,
        `Última ejecución: estado=${runs.last.status}, exit=${runs.last.exitCode ?? "-"}, ${runs.last.durationMs} ms`,
        runs.last.compileOut ? `Salida de compilación:\n${head(runs.last.compileOut)}` : "",
        `stdout:\n${head(runs.last.stdout) || "(vacío)"}`,
        runs.last.stderr ? `stderr:\n${head(runs.last.stderr)}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  } else {
    parts.push("El estudiante no ejecutó su código ninguna vez.");
  }

  return parts.join("\n\n");
}
