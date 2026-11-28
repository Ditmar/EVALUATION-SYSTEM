import { DATA_FILE_EXTENSIONS, languageRuntime } from "./languages";
import type { IdeAnswerValue, IdeConfig, IdeFile } from "./types";

/** No paths, no `..`, no hidden files: Piston writes these straight to disk. */
const FILE_NAME = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/;

/** Hard ceiling regardless of what an author writes in `max-files`. */
export const MAX_FILES_CEILING = 20;
export const DEFAULT_MAX_FILES = 10;
export const DEFAULT_IDE_HEIGHT = 360;

function kb(name: string, fallbackKb: number): number {
  const n = Number(process.env[name]);
  return (Number.isFinite(n) && n > 0 ? n : fallbackKb) * 1024;
}

export function codeRunLimits() {
  return {
    maxFileBytes: kb("CODE_RUN_MAX_FILE_KB", 64),
    maxTotalBytes: kb("CODE_RUN_MAX_TOTAL_KB", 256),
    maxStdinBytes: kb("CODE_RUN_MAX_STDIN_KB", 16),
    maxOutputBytes: kb("CODE_RUN_MAX_OUTPUT_KB", 64),
  };
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/** Returns an error message (Spanish, shown to authors and students) or null if the name is valid. */
export function validateFileName(name: string, config: Pick<IdeConfig, "language">): string | null {
  if (!FILE_NAME.test(name) || name.includes("..")) {
    return `Nombre de archivo inválido: "${name}". Use letras, números, "_", "-" y "." (sin carpetas).`;
  }
  const ext = extensionOf(name);
  const { sourceExt } = languageRuntime(config.language);
  if (ext !== sourceExt && !(DATA_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
    return `El archivo "${name}" debe tener extensión ${sourceExt} (o ${DATA_FILE_EXTENSIONS.join(", ")} para datos).`;
  }
  return null;
}

/** Duplicate check ignoring case — two files differing only in case would collide on some filesystems. */
export function findDuplicateName(names: string[]): string | null {
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) return name;
    seen.add(key);
  }
  return null;
}

/** The editable starter files — what a student starts with (and what "Restaurar plantilla" restores). */
export function initialAnswerFiles(config: IdeConfig): IdeAnswerValue["files"] {
  return config.starterFiles.filter((f) => !f.readonly).map(({ name, content }) => ({ name, content }));
}

export type ResolvedFiles = { ok: true; files: IdeFile[] } | { ok: false; error: string };

/**
 * Validates the editable files a student sent (on autosave or run) against
 * the question's config and merges them with the teacher's read-only files,
 * which are always taken from the config — never from the client. The
 * returned list has the `entry` file first (Piston executes the first file).
 */
export function resolveRunFiles(config: IdeConfig, submitted: IdeAnswerValue["files"]): ResolvedFiles {
  const limits = codeRunLimits();
  const readonlyFiles = config.starterFiles.filter((f) => f.readonly);
  const readonlyNames = new Set(readonlyFiles.map((f) => f.name.toLowerCase()));

  const editable = submitted.filter((f) => !readonlyNames.has(f.name.toLowerCase()));

  for (const file of editable) {
    const error = validateFileName(file.name, config);
    if (error) return { ok: false, error };
    if (byteLength(file.content) > limits.maxFileBytes) {
      return { ok: false, error: `El archivo "${file.name}" supera el tamaño máximo (${limits.maxFileBytes / 1024} KB).` };
    }
  }

  const dup = findDuplicateName(editable.map((f) => f.name));
  if (dup) return { ok: false, error: `Hay dos archivos con el nombre "${dup}".` };

  if (!config.allowNewFiles) {
    const allowed = new Set(initialAnswerFiles(config).map((f) => f.name));
    const extra = editable.find((f) => !allowed.has(f.name));
    if (extra) return { ok: false, error: `Esta pregunta no permite crear archivos nuevos ("${extra.name}").` };
  }

  const all: IdeFile[] = [...editable, ...readonlyFiles];
  const maxFiles = Math.min(config.maxFiles, MAX_FILES_CEILING);
  if (all.length > maxFiles) {
    return { ok: false, error: `Se permiten como máximo ${maxFiles} archivos.` };
  }

  const total = all.reduce((sum, f) => sum + byteLength(f.content), 0);
  if (total > limits.maxTotalBytes) {
    return { ok: false, error: `El total de archivos supera el máximo (${limits.maxTotalBytes / 1024} KB).` };
  }

  const entryIndex = all.findIndex((f) => f.name === config.entry);
  if (entryIndex === -1) {
    return { ok: false, error: `Falta el archivo principal "${config.entry}".` };
  }
  const [entry] = all.splice(entryIndex, 1);
  return { ok: true, files: [entry, ...all] };
}

/** stdin to use for a run: the student's if editable, else the question's default. */
export function resolveStdin(config: IdeConfig, submitted: string | undefined): { ok: true; stdin: string } | { ok: false; error: string } {
  const stdin = config.stdinEditable ? submitted ?? config.stdin : config.stdin;
  if (byteLength(stdin) > codeRunLimits().maxStdinBytes) {
    return { ok: false, error: `La entrada (stdin) supera el máximo (${codeRunLimits().maxStdinBytes / 1024} KB).` };
  }
  return { ok: true, stdin };
}

/** `// ===== Main.java =====` sections — the AI prompt / CSV view of a multi-file answer. */
export function formatFilesAsText(files: { name: string; content: string }[]): string {
  if (files.length === 1) return files[0].content;
  return files.map((f) => `// ===== ${f.name} =====\n${f.content}`).join("\n\n");
}

/** Content of the entry file — stored in the exam's legacy `codeAnswer` column. */
export function entryContent(config: IdeConfig, value: IdeAnswerValue | undefined): string {
  return value?.files.find((f) => f.name === config.entry)?.content ?? "";
}
