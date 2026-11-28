import { DEFAULT_IDE_HEIGHT, DEFAULT_MAX_FILES, MAX_FILES_CEILING, findDuplicateName, validateFileName } from "./files";
import { languageRuntime, normalizeIdeLanguage } from "./languages";
import { IDE_LANGUAGES, IDE_MODES, type IdeConfig, type IdeFile, type IdeMode } from "./types";

/**
 * Loosely-typed authoring input — what a Markdown placeholder (strings) or an
 * exam JSON question (typed values) provide. Both paths go through
 * `normalizeIdeConfig` so the rules (defaults, entry, file names) are
 * identical in laboratories and exams.
 */
export interface IdeConfigInput {
  language?: string;
  mode?: string;
  entry?: string;
  files?: IdeFile[];
  allowNewFiles?: boolean;
  maxFiles?: number;
  stdin?: string;
  stdinEditable?: boolean;
  run?: boolean;
  runLimit?: number;
  autocomplete?: boolean;
  height?: number;
}

export type IdeConfigResult = { ok: true; config: IdeConfig; warnings: string[] } | { ok: false; errors: string[] };

const PUBLIC_CLASS = /\bpublic\s+(?:final\s+|abstract\s+|sealed\s+|non-sealed\s+)*(?:class|interface|enum|record)\s+([A-Za-z_]\w*)/;

export function normalizeIdeConfig(questionId: string, input: IdeConfigInput): IdeConfigResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const q = `Question "${questionId}"`;

  const language = normalizeIdeLanguage(input.language);
  if (!language) {
    return { ok: false, errors: [`${q} uses type="ide" con language="${input.language ?? ""}" inválido. Lenguajes soportados: ${IDE_LANGUAGES.join(", ")}.`] };
  }
  const runtime = languageRuntime(language);

  const modeRaw = (input.mode ?? "single").trim();
  if (!(IDE_MODES as readonly string[]).includes(modeRaw)) {
    errors.push(`${q} tiene mode="${modeRaw}" inválido. Valores válidos: ${IDE_MODES.join(", ")}.`);
  }
  const mode = modeRaw as IdeMode;

  const entry = input.entry?.trim() || runtime.entry;
  const entryError = validateFileName(entry, { language });
  if (entryError) errors.push(`${q}: ${entryError}`);
  else if (!entry.toLowerCase().endsWith(runtime.sourceExt)) errors.push(`${q}: el archivo principal "${entry}" debe terminar en ${runtime.sourceExt}.`);

  const maxFiles = input.maxFiles ?? DEFAULT_MAX_FILES;
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > MAX_FILES_CEILING) {
    errors.push(`${q} tiene max-files="${input.maxFiles}" inválido: debe ser un entero entre 1 y ${MAX_FILES_CEILING}.`);
  }

  if (input.runLimit !== undefined && (!Number.isInteger(input.runLimit) || input.runLimit < 1)) {
    errors.push(`${q} tiene run-limit="${input.runLimit}" inválido: debe ser un entero mayor a 0.`);
  }

  const height = input.height ?? DEFAULT_IDE_HEIGHT;
  if (!Number.isFinite(height) || height < 160 || height > 1200) {
    errors.push(`${q} tiene height="${input.height}" inválido: debe estar entre 160 y 1200 (px).`);
  }

  let starterFiles: IdeFile[] = (input.files ?? []).map((f) => ({ name: f.name.trim(), content: f.content, ...(f.readonly ? { readonly: true } : {}) }));
  for (const file of starterFiles) {
    const fileError = validateFileName(file.name, { language });
    if (fileError) errors.push(`${q}: ${fileError}`);
  }
  const dup = findDuplicateName(starterFiles.map((f) => f.name));
  if (dup) errors.push(`${q}: el archivo "${dup}" está declarado dos veces.`);

  if (starterFiles.length === 0) {
    starterFiles = [{ name: entry, content: "" }];
  } else {
    const entryFile = starterFiles.find((f) => f.name === entry);
    if (!entryFile) errors.push(`${q}: ningún archivo inicial se llama "${entry}" (el archivo principal).`);
    else if (entryFile.readonly) errors.push(`${q}: el archivo principal "${entry}" no puede ser de solo lectura.`);
  }

  const editableCount = starterFiles.filter((f) => !f.readonly).length;
  if (mode === "single" && editableCount > 1) {
    errors.push(`${q} usa mode="single" pero declara ${editableCount} archivos editables; use mode="multi" o marque los demás como readonly="true".`);
  }
  if (Number.isInteger(maxFiles) && starterFiles.length > maxFiles) {
    errors.push(`${q} declara ${starterFiles.length} archivos pero max-files es ${maxFiles}.`);
  }

  if (language === "java") {
    for (const file of starterFiles) {
      const publicName = file.content.match(PUBLIC_CLASS)?.[1];
      if (publicName && `${publicName}.java` !== file.name) {
        warnings.push(`${q}: "${file.name}" declara "public ... ${publicName}"; en Java el archivo debería llamarse "${publicName}.java".`);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    warnings,
    config: {
      language,
      mode,
      entry,
      starterFiles,
      allowNewFiles: input.allowNewFiles ?? mode === "multi",
      maxFiles,
      stdin: input.stdin ?? "",
      stdinEditable: input.stdinEditable ?? true,
      runEnabled: input.run ?? true,
      runLimit: input.runLimit,
      autocomplete: input.autocomplete ?? false,
      height,
    },
  };
}

/** Narrow runtime check for configs read back from the DB (`Question.ideConfig` is untyped JSON). */
export function asIdeConfig(value: unknown): IdeConfig | null {
  if (typeof value !== "object" || value === null) return null;
  const c = value as Partial<IdeConfig>;
  if (!c.language || !(IDE_LANGUAGES as readonly string[]).includes(c.language) || typeof c.entry !== "string" || !Array.isArray(c.starterFiles)) {
    return null;
  }
  return c as IdeConfig;
}

/** Picks just the IdeConfig fields out of a question object (lab `IdeQuestion` or similar). */
export function pickIdeConfig(source: IdeConfig): IdeConfig {
  const { language, mode, entry, starterFiles, allowNewFiles, maxFiles, stdin, stdinEditable, runEnabled, runLimit, autocomplete, height } = source;
  return { language, mode, entry, starterFiles, allowNewFiles, maxFiles, stdin, stdinEditable, runEnabled, runLimit, autocomplete, height };
}
