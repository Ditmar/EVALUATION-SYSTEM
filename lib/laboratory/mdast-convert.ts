import type { LaboratoryNode, LaboratoryParseError } from "./types";

/** Loose shape for the mdast nodes read off `unified`/`remark-gfm` — see module note below. */
export interface MdastLikeNode {
  type: string;
  children?: MdastLikeNode[];
  value?: string;
  depth?: number;
  ordered?: boolean | null;
  align?: Array<string | null>;
  url?: string;
  alt?: string | null;
  title?: string | null;
  lang?: string | null;
}

export interface MdastConvertContext {
  errors: LaboratoryParseError[];
  /**
   * Converts one raw mdast `text` node's value into zero or more
   * `LaboratoryNode`s — the seam where `{{answer}}` placeholder-splitting
   * happens for a full laboratory document (see `parse-laboratory.ts`), or
   * doesn't for a plain free-text preview (see `render-markdown-text.ts`).
   */
  convertText: (value: string) => LaboratoryNode[];
}

/**
 * Converts a whitelisted set of mdast node kinds into our own `LaboratoryNode`
 * shape. Anything outside the whitelist is a parse error, not a silent drop —
 * see `types.ts` for why the AST is intentionally not an mdast passthrough.
 * Typed loosely against the input (mdast's own TS surface for GFM node kinds
 * depends on ambient module augmentation that varies across versions); the
 * output of this function is what carries our real type guarantees.
 */
export function convertNode(node: MdastLikeNode, ctx: MdastConvertContext): LaboratoryNode | null {
  switch (node.type) {
    case "heading": {
      const depth = node.depth === 1 || node.depth === 2 || node.depth === 3 || node.depth === 4 || node.depth === 5 || node.depth === 6 ? node.depth : 1;
      return { type: "heading", depth, children: convertChildren(node.children, ctx) };
    }
    case "paragraph":
      return { type: "paragraph", children: convertChildren(node.children, ctx) };
    case "strong":
      return { type: "strong", children: convertChildren(node.children, ctx) };
    case "emphasis":
      return { type: "emphasis", children: convertChildren(node.children, ctx) };
    case "inlineCode":
      return { type: "inlineCode", value: node.value ?? "" };
    case "code":
      return { type: "code", lang: node.lang ?? null, value: node.value ?? "" };
    case "list":
      return { type: "list", ordered: Boolean(node.ordered), children: convertChildren(node.children, ctx) };
    case "listItem":
      return { type: "listItem", children: convertChildren(node.children, ctx) };
    case "table":
      return {
        type: "table",
        align: (node.align ?? []).map((a) => (a === "left" || a === "right" || a === "center" ? a : null)),
        children: convertChildren(node.children, ctx),
      };
    case "tableRow":
      return { type: "tableRow", children: convertChildren(node.children, ctx) };
    case "tableCell":
      return { type: "tableCell", children: convertChildren(node.children, ctx) };
    case "image":
      return { type: "image", url: node.url ?? "", alt: node.alt ?? null, title: node.title ?? null };
    case "thematicBreak":
      return { type: "thematicBreak" };
    case "blockquote":
      return { type: "blockquote", children: convertChildren(node.children, ctx) };
    case "link":
      return { type: "link", url: node.url ?? "", children: convertChildren(node.children, ctx) };
    case "break":
      return { type: "break" };
    default:
      ctx.errors.push({ message: `Elemento Markdown no soportado en un laboratorio: "${node.type}".` });
      return null;
  }
}

export function convertChildren(children: MdastLikeNode[] | undefined, ctx: MdastConvertContext): LaboratoryNode[] {
  if (!children) return [];
  const out: LaboratoryNode[] = [];
  for (const child of children) {
    if (child.type === "text") {
      out.push(...ctx.convertText(child.value ?? ""));
      continue;
    }
    const converted = convertNode(child, ctx);
    if (converted) out.push(converted);
  }
  return out;
}
