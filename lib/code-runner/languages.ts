import type { IdeLanguage } from "./types";

export interface LanguageRuntime {
  /** Piston package name. */
  piston: string;
  /** Pinned Piston package version — same submission, same result all semester. */
  version: string;
  /** Default `entry` file name. */
  entry: string;
  /** Source extension for this language. */
  sourceExt: string;
  /** Human-readable command shown in the console header (informative only). */
  command: (entry: string) => string;
  /** CodeMirror language id for `components/CodeEditor.tsx`. */
  editorLanguage: string;
}

function env(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

/**
 * The single source of truth for which languages the IDE supports and which
 * Piston runtime each one maps to. Adding a language = one entry here + the
 * package installed in Piston (docker/piston-install.sh) + a grammar in
 * CodeEditor. Read lazily (function, not constant) so env overrides apply in
 * tests and after a config change without a rebuild.
 */
export function languageRuntime(language: IdeLanguage): LanguageRuntime {
  switch (language) {
    case "python":
      return {
        piston: "python",
        version: env("PISTON_PYTHON_VERSION", "3.12.0"),
        entry: "main.py",
        sourceExt: ".py",
        command: (entry) => `python ${entry}`,
        editorLanguage: "python",
      };
    case "java":
      return {
        piston: "java",
        version: env("PISTON_JAVA_VERSION", "15.0.2"),
        entry: "Main.java",
        sourceExt: ".java",
        command: () => "javac *.java && java Main",
        editorLanguage: "java",
      };
    case "typescript":
      return {
        piston: "typescript",
        version: env("PISTON_TYPESCRIPT_VERSION", "5.0.3"),
        entry: "main.ts",
        sourceExt: ".ts",
        command: (entry) => `tsc && node ${entry.replace(/\.ts$/, ".js")}`,
        editorLanguage: "typescript",
      };
  }
}

/** Aliases accepted in authoring (`language="py"`). */
export function normalizeIdeLanguage(raw: string | undefined): IdeLanguage | null {
  switch (raw?.trim().toLowerCase()) {
    case "python":
    case "py":
      return "python";
    case "java":
      return "java";
    case "typescript":
    case "ts":
      return "typescript";
    default:
      return null;
  }
}

/** Data files a program may read besides its sources. */
export const DATA_FILE_EXTENSIONS = [".txt", ".csv", ".json"] as const;
