import type { ArticleNode, ArticleParseError } from "./types";

/** Loose shape for the mdast nodes read off `unified`/`remark-gfm`/`remark-math` — see `lib/laboratory/mdast-convert.ts` for the sibling copy used by laboratories. */
interface MdastLikeNode {
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

/**
 * Converts a whitelisted set of mdast node kinds into our own `ArticleNode`
 * shape — same policy as `lib/laboratory/mdast-convert.ts`, plus `delete`
 * (strikethrough, harmless in article prose unlike a lab statement).
 */
function convertNode(node: MdastLikeNode, errors: ArticleParseError[]): ArticleNode | null {
  switch (node.type) {
    case "heading": {
      const depth = node.depth === 1 || node.depth === 2 || node.depth === 3 || node.depth === 4 || node.depth === 5 || node.depth === 6 ? node.depth : 1;
      return { type: "heading", depth, children: convertChildren(node.children, errors) };
    }
    case "paragraph":
      return { type: "paragraph", children: convertChildren(node.children, errors) };
    case "strong":
      return { type: "strong", children: convertChildren(node.children, errors) };
    case "emphasis":
      return { type: "emphasis", children: convertChildren(node.children, errors) };
    case "delete":
      return { type: "delete", children: convertChildren(node.children, errors) };
    case "inlineCode":
      return { type: "inlineCode", value: node.value ?? "" };
    case "code":
      return { type: "code", lang: node.lang ?? null, value: node.value ?? "" };
    case "list":
      return { type: "list", ordered: Boolean(node.ordered), children: convertChildren(node.children, errors) };
    case "listItem":
      return { type: "listItem", children: convertChildren(node.children, errors) };
    case "table":
      return {
        type: "table",
        align: (node.align ?? []).map((a) => (a === "left" || a === "right" || a === "center" ? a : null)),
        children: convertChildren(node.children, errors),
      };
    case "tableRow":
      return { type: "tableRow", children: convertChildren(node.children, errors) };
    case "tableCell":
      return { type: "tableCell", children: convertChildren(node.children, errors) };
    case "image":
      return { type: "image", url: node.url ?? "", alt: node.alt ?? null, title: node.title ?? null };
    case "thematicBreak":
      return { type: "thematicBreak" };
    case "blockquote":
      return { type: "blockquote", children: convertChildren(node.children, errors) };
    case "link":
      return { type: "link", url: node.url ?? "", children: convertChildren(node.children, errors) };
    case "break":
      return { type: "break" };
    case "math":
      return { type: "math", value: node.value ?? "" };
    case "inlineMath":
      return { type: "inlineMath", value: node.value ?? "" };
    default:
      errors.push({ message: `Elemento Markdown no soportado en un artículo: "${node.type}".` });
      return null;
  }
}

export function convertChildren(children: MdastLikeNode[] | undefined, errors: ArticleParseError[]): ArticleNode[] {
  if (!children) return [];
  const out: ArticleNode[] = [];
  for (const child of children) {
    if (child.type === "text") {
      out.push({ type: "text", value: child.value ?? "" });
      continue;
    }
    const converted = convertNode(child, errors);
    if (converted) out.push(converted);
  }
  return out;
}
