import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { extractRubrics } from "./extract-rubrics";
import { parsePlaceholder, parsePlaceholderAttributes } from "./parse-placeholder";
import { checkPointsTotal, validateRubricReferences } from "./validation";
import type {
  LaboratoryMetadata,
  LaboratoryNode,
  LaboratoryParseError,
  LaboratoryParseResult,
  LaboratoryParseWarning,
  LaboratoryStatus,
  QuestionDefinition,
} from "./types";

const ANSWER_PLACEHOLDER = /\{\{answer([\s\S]*?)\}\}/g;
const STATUSES: LaboratoryStatus[] = ["draft", "published", "archived"];

/** Loose shape for the mdast nodes we read off `unified`/`remark-gfm` — see module note below. */
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

interface WalkContext {
  errors: LaboratoryParseError[];
  /** id -> raw string attributes, first occurrence only. */
  rawPlaceholders: Map<string, Record<string, string>>;
  /** ids in document order, for building `questions[]` deterministically. */
  order: string[];
  duplicateIds: string[];
}

function splitTextNode(value: string, ctx: WalkContext): LaboratoryNode[] {
  const out: LaboratoryNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(ANSWER_PLACEHOLDER)) {
    const [full, attrString] = match;
    const index = match.index ?? 0;

    if (index > lastIndex) {
      out.push({ type: "text", value: value.slice(lastIndex, index) });
    }

    const attrs = parsePlaceholderAttributes(attrString);
    const id = attrs.id?.trim();
    if (!id) {
      ctx.errors.push({ message: 'Se encontró un placeholder "answer" sin atributo "id" obligatorio.' });
    } else {
      if (ctx.rawPlaceholders.has(id)) {
        ctx.duplicateIds.push(id);
      } else {
        ctx.rawPlaceholders.set(id, attrs);
        ctx.order.push(id);
      }
      out.push({ type: "labAnswer", questionId: id });
    }

    lastIndex = index + full.length;
  }

  if (lastIndex < value.length) {
    out.push({ type: "text", value: value.slice(lastIndex) });
  }

  return out;
}

/**
 * Converts a whitelisted set of mdast node kinds into our own `LaboratoryNode`
 * shape. Anything outside the whitelist is a parse error, not a silent drop —
 * see `types.ts` for why the AST is intentionally not an mdast passthrough.
 * Typed loosely against the input (mdast's own TS surface for GFM node kinds
 * depends on ambient module augmentation that varies across versions); the
 * output of this function is what carries our real type guarantees.
 */
function convertNode(node: MdastLikeNode, ctx: WalkContext): LaboratoryNode | null {
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

function convertChildren(children: MdastLikeNode[] | undefined, ctx: WalkContext): LaboratoryNode[] {
  if (!children) return [];
  const out: LaboratoryNode[] = [];
  for (const child of children) {
    if (child.type === "text") {
      out.push(...splitTextNode(child.value ?? "", ctx));
      continue;
    }
    const converted = convertNode(child, ctx);
    if (converted) out.push(converted);
  }
  return out;
}

function collectPlainText(nodes: LaboratoryNode[]): string {
  let out = "";
  for (const node of nodes) {
    if (node.type === "text" || node.type === "inlineCode") {
      out += node.value;
    } else if (node.type === "strong" || node.type === "emphasis" || node.type === "link") {
      out += collectPlainText(node.children);
    }
  }
  return out.trim();
}

function collectAnswerIds(nodes: LaboratoryNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.type === "labAnswer") {
      ids.push(node.questionId);
    } else if ("children" in node) {
      ids.push(...collectAnswerIds(node.children));
    }
  }
  return ids;
}

/**
 * Best-effort prompt context for the AI evaluator: whatever plain-text
 * paragraph immediately precedes a question, at the top level of the
 * document (deliberately not descending into lists/tables/blockquotes —
 * a placeholder nested that deeply just gets no context, which is an
 * acceptable MVP limitation, not a broken feature).
 */
function assignQuestionContext(content: LaboratoryNode[], questions: QuestionDefinition[]): void {
  const byId = new Map(questions.map((q) => [q.id, q]));
  let lastProse: string | undefined;

  for (const node of content) {
    if (node.type !== "paragraph") continue;

    const answerIds = collectAnswerIds(node.children);
    if (answerIds.length === 0) {
      const text = collectPlainText(node.children);
      if (text) lastProse = text;
      continue;
    }

    if (lastProse) {
      for (const id of answerIds) {
        const question = byId.get(id);
        if (question && !question.context) question.context = lastProse;
      }
    }
  }
}

function parseMetadata(data: Record<string, unknown>): { metadata: LaboratoryMetadata } | { errors: LaboratoryParseError[] } {
  const errors: LaboratoryParseError[] = [];

  const id = typeof data.id === "string" ? data.id.trim() : "";
  if (!id) errors.push({ message: 'El frontmatter debe definir "id".' });

  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) errors.push({ message: 'El frontmatter debe definir "title".' });

  let status: LaboratoryStatus = "draft";
  if (data.status !== undefined) {
    if (typeof data.status === "string" && (STATUSES as string[]).includes(data.status)) {
      status = data.status as LaboratoryStatus;
    } else {
      errors.push({ message: `"status" del frontmatter es inválido: "${String(data.status)}". Valores válidos: ${STATUSES.join(", ")}.` });
    }
  }

  const version = typeof data.version === "number" ? data.version : 1;
  const duration = typeof data.duration === "number" ? data.duration : undefined;
  const points = typeof data.points === "number" ? data.points : undefined;
  const subject = typeof data.subject === "string" ? data.subject : undefined;

  if (points !== undefined && points < 0) {
    errors.push({ message: '"points" del frontmatter debe ser mayor o igual a 0.' });
  }

  if (errors.length > 0) return { errors };

  return { metadata: { id, title, subject, version, duration, points, status } };
}

/**
 * Parses a Laboratory Markdown Specification v0.1 document into a typed
 * `LaboratoryDefinition`. Pure function: no filesystem, DB, or React
 * involved — this is the ONLY place in the system that reads raw Markdown.
 */
export function parseLaboratory(markdownSource: string): LaboratoryParseResult {
  const errors: LaboratoryParseError[] = [];
  const warnings: LaboratoryParseWarning[] = [];

  const { data, content } = matter(markdownSource);

  const metadataResult = parseMetadata(data as Record<string, unknown>);
  if ("errors" in metadataResult) {
    return { ok: false, errors: metadataResult.errors };
  }
  const { metadata } = metadataResult;

  const { source: body, rubrics } = extractRubrics(content);

  const tree = unified().use(remarkParse).use(remarkGfm).parse(body) as unknown as { children: MdastLikeNode[] };

  const ctx: WalkContext = { errors: [], rawPlaceholders: new Map(), order: [], duplicateIds: [] };
  const contentNodes = convertChildren(tree.children, ctx);
  errors.push(...ctx.errors);

  for (const id of ctx.duplicateIds) {
    errors.push({ questionId: id, message: `Duplicate question id: "${id}".` });
  }

  const questions: QuestionDefinition[] = [];
  for (const id of ctx.order) {
    const attrs = ctx.rawPlaceholders.get(id)!;
    const result = parsePlaceholder(attrs);
    if ("errors" in result) {
      errors.push(...result.errors);
    } else {
      questions.push(result.question);
    }
  }

  errors.push(...validateRubricReferences(rubrics, questions));

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  assignQuestionContext(contentNodes, questions);

  warnings.push(...checkPointsTotal(questions, metadata));

  return {
    ok: true,
    laboratory: { metadata, content: contentNodes, questions, rubrics },
    warnings,
  };
}
