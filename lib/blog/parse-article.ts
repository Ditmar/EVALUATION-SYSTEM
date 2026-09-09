import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { convertLatexDelimiters } from "@/lib/laboratory/convert-latex-delimiters";
import { convertChildren } from "./article-node";
import { estimateReadingTimeMinutes } from "./reading-time";
import { slugify } from "./slugify";
import type { ArticleFrontmatter, ArticleHeading, ArticleNode, ArticleParseError, ArticleParseResult } from "./types";

function parseFrontmatter(data: Record<string, unknown>): { frontmatter: ArticleFrontmatter } | { errors: ArticleParseError[] } {
  const errors: ArticleParseError[] = [];

  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) errors.push({ message: 'El frontmatter debe definir "title".' });

  const excerpt = typeof data.excerpt === "string" ? data.excerpt.trim() : "";
  if (!excerpt) errors.push({ message: 'El frontmatter debe definir "excerpt".' });

  let tags: string[] = [];
  if (data.tags !== undefined) {
    if (Array.isArray(data.tags) && data.tags.every((t) => typeof t === "string")) {
      tags = (data.tags as string[]).map((t) => t.trim()).filter(Boolean);
    } else {
      errors.push({ message: '"tags" del frontmatter debe ser una lista de strings, ej. tags: [algoritmos, grafos].' });
    }
  }

  if (errors.length > 0) return { errors };
  return { frontmatter: { title, excerpt, tags } };
}

/** Extracts `##`/`###` headings for the table-of-contents sidebar, deduping ids the way GitHub/Medium do (`-2`, `-3`, ...). */
function collectHeadings(content: ArticleNode[]): ArticleHeading[] {
  const headings: ArticleHeading[] = [];
  const seen = new Map<string, number>();

  function plainText(nodes: ArticleNode[]): string {
    let out = "";
    for (const node of nodes) {
      if (node.type === "text" || node.type === "inlineCode") out += node.value;
      else if ("children" in node) out += plainText(node.children);
    }
    return out.trim();
  }

  for (const node of content) {
    if (node.type !== "heading" || (node.depth !== 2 && node.depth !== 3)) continue;
    const text = plainText(node.children);
    if (!text) continue;

    const base = slugify(text) || "seccion";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;

    headings.push({ depth: node.depth, id, text });
  }

  return headings;
}

/**
 * Parses an Article Markdown Specification v0.1 document into a typed
 * `ArticleDefinition`. Pure function: no filesystem, DB, or React involved —
 * this is the ONLY place in the system that reads raw article Markdown.
 */
export function parseArticle(markdownSource: string): ArticleParseResult {
  const { data, content: body } = matter(markdownSource);

  const frontmatterResult = parseFrontmatter(data as Record<string, unknown>);
  if ("errors" in frontmatterResult) {
    return { ok: false, errors: frontmatterResult.errors };
  }

  const errors: ArticleParseError[] = [];
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .parse(convertLatexDelimiters(body)) as unknown as { children: Parameters<typeof convertChildren>[0] };

  const content = convertChildren(tree.children, errors);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const headings = collectHeadings(content);
  const readingTimeMinutes = estimateReadingTimeMinutes(content);

  return {
    ok: true,
    article: { frontmatter: frontmatterResult.frontmatter, content, headings, readingTimeMinutes },
  };
}
