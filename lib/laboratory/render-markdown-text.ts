import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { convertChildren, type MdastLikeNode } from "./mdast-convert";
import type { LaboratoryNode, LaboratoryParseError } from "./types";

/**
 * Renders a plain string of student-written Markdown (a `textarea` answer,
 * never a full laboratory document — no frontmatter, no `{{answer}}`/
 * `{{repository}}`/`{{rubric}}` placeholders) into the same `LaboratoryNode[]`
 * shape the full parser produces, for the live "Vista previa" toggle and the
 * teacher's read-only view of a submitted answer.
 *
 * Reuses the exact same safe, whitelisted mdast conversion as the laboratory
 * parser — no `dangerouslySetInnerHTML` anywhere in this pipeline, so
 * rendering arbitrary student-typed Markdown carries no XSS risk. Unsupported
 * constructs (rare in free-form prose) are silently dropped rather than
 * blocking the preview — this is a live editing aid, not a document that
 * needs to fail loudly on error.
 */
export function renderMarkdownText(source: string): LaboratoryNode[] {
  if (!source.trim()) return [];

  const tree = unified().use(remarkParse).use(remarkGfm).parse(source) as unknown as { children: MdastLikeNode[] };
  const errors: LaboratoryParseError[] = [];

  return convertChildren(tree.children, { errors, convertText: (value) => [{ type: "text", value }] });
}
