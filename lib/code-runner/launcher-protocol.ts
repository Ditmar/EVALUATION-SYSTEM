/**
 * Shared contract between the generated launchers (java-launcher.ts,
 * ts-launcher.ts) and piston-client.ts: a launcher that compiles the
 * student's files itself prints the compiler diagnostics between these
 * markers on stderr and exits with this code, so the client can report a
 * compile error instead of a runtime one.
 */
export const COMPILE_ERROR_EXIT = 97;
export const COMPILE_BEGIN = "<<<IDE_COMPILE_BEGIN>>>";
export const COMPILE_END = "<<<IDE_COMPILE_END>>>";

/** Splits launcher-wrapped compile diagnostics out of stderr. */
export function extractCompileOutput(stderr: string): { compile: string; rest: string } | null {
  const start = stderr.indexOf(COMPILE_BEGIN);
  const end = stderr.indexOf(COMPILE_END);
  if (start === -1 || end === -1 || end < start) return null;
  return {
    compile: stderr.slice(start + COMPILE_BEGIN.length, end),
    rest: stderr.slice(0, start) + stderr.slice(end + COMPILE_END.length),
  };
}

/** A JS/Java string literal for embedding generated values in launcher source. */
export function quoted(s: string): string {
  return JSON.stringify(s);
}
