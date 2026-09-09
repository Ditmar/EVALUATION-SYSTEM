import type { ArticleNode } from "./types";

const WORDS_PER_MINUTE = 200;

/** Plain-text word count across every node except code blocks (code isn't "read" at prose speed). */
function collectWords(nodes: ArticleNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "text" || node.type === "inlineCode") {
      count += node.value.split(/\s+/).filter(Boolean).length;
    } else if (node.type === "code" || node.type === "image" || node.type === "thematicBreak" || node.type === "break") {
      continue;
    } else if ("children" in node) {
      count += collectWords(node.children);
    }
  }
  return count;
}

/** Estimated reading time in whole minutes, at ~200 words/minute, minimum 1. */
export function estimateReadingTimeMinutes(content: ArticleNode[]): number {
  const words = collectWords(content);
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
