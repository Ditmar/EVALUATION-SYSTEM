export type StatementSegment =
  | { type: "text"; content: string }
  | { type: "code"; content: string; language: string };

const CODE_FENCE = /```(\w*)\n?([\s\S]*?)```/g;

/**
 * Splits a question statement into plain-text and fenced-code segments, so
 * questions authored with markdown-style ```lang ... ``` blocks can render
 * the code with syntax highlighting instead of as plain text.
 */
export function parseStatement(statement: string): StatementSegment[] {
  const segments: StatementSegment[] = [];
  let lastIndex = 0;

  for (const match of statement.matchAll(CODE_FENCE)) {
    const [full, language, code] = match;
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({ type: "text", content: statement.slice(lastIndex, index) });
    }
    segments.push({ type: "code", content: code.replace(/\n$/, ""), language: language || "javascript" });
    lastIndex = index + full.length;
  }

  if (lastIndex < statement.length) {
    segments.push({ type: "text", content: statement.slice(lastIndex) });
  }

  return segments.filter((s) => s.content.trim().length > 0 || s.type === "code");
}
