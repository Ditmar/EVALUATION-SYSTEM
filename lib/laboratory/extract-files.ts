import type { IdeFile } from "@/lib/code-runner/types";
import { parsePlaceholderAttributes } from "./parse-placeholder";
import type { LaboratoryParseError } from "./types";

const FILES_BLOCK = /\{\{files\s+for="([^"]*)"\s*\}\}([\s\S]*?)\{\{\/files\}\}/g;
/** A fenced code block: opening fence + info string, body, matching closing fence. */
// The body group is lazily optional (`??`): an empty file must close at the
// very next fence, not swallow the following file's block.
const FENCE = /^([ \t]*)(`{3,}|~{3,})([^\n]*)\n(?:([\s\S]*?)\n)??[ \t]*\2[ \t]*$/gm;

export interface StarterFilesDeclaration {
  for: string;
  files: IdeFile[];
}

/**
 * Pulls every `{{files for="..."}}...{{/files}}` block (starter files of an
 * `ide` question) out of the raw Markdown before parsing — same approach as
 * `extractRubrics`: these are question configuration, not prose. Runs first
 * so that code inside the files (which may contain `{{`/`}}`) is never seen
 * by the other extractors or by the `{{answer}}` matcher.
 *
 * Each fenced block inside is one file; its info string carries
 * `file="Name.ext"` and optionally `readonly="true"`:
 *
 *     ```java file="Main.java"
 *     public class Main { ... }
 *     ```
 */
export function extractStarterFiles(source: string): {
  source: string;
  declarations: StarterFilesDeclaration[];
  errors: LaboratoryParseError[];
} {
  const declarations: StarterFilesDeclaration[] = [];
  const errors: LaboratoryParseError[] = [];
  const seen = new Set<string>();

  const stripped = source.replace(FILES_BLOCK, (_match, forRaw: string, body: string) => {
    const forId = forRaw.trim();
    if (!forId) {
      errors.push({ message: 'Se encontró un bloque "files" sin atributo "for".' });
      return "";
    }
    if (seen.has(forId)) {
      errors.push({ questionId: forId, message: `Hay más de un bloque {{files for="${forId}"}}.` });
      return "";
    }
    seen.add(forId);

    const files: IdeFile[] = [];
    for (const fence of body.matchAll(FENCE)) {
      const [, indent, , info, content = ""] = fence;
      const attrs = parsePlaceholderAttributes(info);
      const name = attrs.file?.trim();
      if (!name) {
        errors.push({ questionId: forId, message: `Un bloque de código dentro de {{files for="${forId}"}} no define file="Nombre.ext".` });
        continue;
      }
      // Undo the fence's own indentation (e.g. when nested in a list).
      const dedented = indent ? content.replace(new RegExp(`^${indent}`, "gm"), "") : content;
      files.push({ name, content: dedented, ...(attrs.readonly?.trim().toLowerCase() === "true" ? { readonly: true } : {}) });
    }

    if (files.length === 0) {
      errors.push({ questionId: forId, message: `El bloque {{files for="${forId}"}} no contiene ningún archivo (bloques \`\`\` con file="...").` });
    }
    declarations.push({ for: forId, files });
    return "";
  });

  return { source: stripped, declarations, errors };
}
