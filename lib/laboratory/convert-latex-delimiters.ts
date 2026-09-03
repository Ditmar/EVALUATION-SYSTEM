/**
 * `remark-math` only recognizes the `$...$` / `$$...$$` dollar syntax (there
 * is no delimiter-configuration option), but LaTeX sources — and anyone
 * pasting from a LaTeX-aware editor — write `\(...\)` / `\[...\]` instead.
 * This translates the latter into the former *before* the Markdown parse, so
 * both styles reach `remark-math` as the syntax it actually understands.
 *
 * Only applied to the laboratory statement (trusted, teacher-authored
 * content) — never to a student's free-text answer.
 *
 * Skips fenced code blocks (splits on them first) so a lab that shows LaTeX
 * source *as an example* inside a ``` fence isn't rewritten — that content is
 * meant to display verbatim, not be interpreted as math.
 */
const FENCED_CODE_BLOCK = /(```[\s\S]*?```)/g;

function convertSegment(segment: string): string {
  return segment
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr: string) => `$$${expr}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, expr: string) => `$${expr}$`);
}

export function convertLatexDelimiters(source: string): string {
  return source
    .split(FENCED_CODE_BLOCK)
    .map((segment, index) => (index % 2 === 1 ? segment : convertSegment(segment)))
    .join("");
}
