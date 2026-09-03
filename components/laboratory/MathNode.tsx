"use client";

import katex from "katex";

/**
 * The one deliberate exception to "no `dangerouslySetInnerHTML` anywhere in
 * this pipeline" (see `render-markdown-text.ts`): KaTeX's output is glyph
 * layout markup (nested spans with precise positioning) that can't
 * reasonably be reconstructed as plain React elements — every KaTeX-based
 * integration renders its HTML output directly. Scoped narrowly:
 * `trust: false` (KaTeX's default) rejects the handful of commands that can
 * touch the page (`\href`, `\includegraphics`, ...), and `math`/`inlineMath`
 * nodes only ever come from `parse-laboratory.ts` — the laboratory
 * *statement*, authored by the teacher — never from a student's free-text
 * answer (`render-markdown-text.ts` doesn't load `remark-math`), so this
 * never runs on untrusted input.
 */
function renderKatex(value: string, displayMode: boolean): string {
  try {
    return katex.renderToString(value, { throwOnError: false, trust: false, displayMode, strict: "warn" });
  } catch (error) {
    return `<span class="text-red-600">${(error as Error).message}</span>`;
  }
}

export function MathBlock({ value }: { value: string }) {
  return <div className="katex-block overflow-x-auto py-1" dangerouslySetInnerHTML={{ __html: renderKatex(value, true) }} />;
}

export function MathInline({ value }: { value: string }) {
  return <span dangerouslySetInnerHTML={{ __html: renderKatex(value, false) }} />;
}
