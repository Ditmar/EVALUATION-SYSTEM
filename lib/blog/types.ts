/**
 * Article Markdown Specification v0.1 — intermediate representation.
 *
 * Mirrors `lib/laboratory/types.ts`'s `LaboratoryNode`: nothing outside
 * `lib/blog/parse-article.ts` (and its helpers) should ever need to look at
 * raw Markdown text again.
 */

export interface ArticleFrontmatter {
  title: string;
  excerpt: string;
  tags: string[];
}

/**
 * Whitelisted set of renderable node kinds — same policy as `LaboratoryNode`:
 * anything outside this list is a parse error, never a silently-dropped or
 * best-effort-rendered node. Adds `delete` (strikethrough) over the
 * laboratory node set, since article prose has no reason to forbid it the
 * way an exam/lab statement does.
 */
export type ArticleNode =
  | { type: "heading"; depth: 1 | 2 | 3 | 4 | 5 | 6; children: ArticleNode[] }
  | { type: "paragraph"; children: ArticleNode[] }
  | { type: "text"; value: string }
  | { type: "strong"; children: ArticleNode[] }
  | { type: "emphasis"; children: ArticleNode[] }
  | { type: "delete"; children: ArticleNode[] }
  | { type: "inlineCode"; value: string }
  | { type: "code"; lang: string | null; value: string }
  | { type: "list"; ordered: boolean; children: ArticleNode[] }
  | { type: "listItem"; children: ArticleNode[] }
  | { type: "table"; align: Array<"left" | "right" | "center" | null>; children: ArticleNode[] }
  | { type: "tableRow"; children: ArticleNode[] }
  | { type: "tableCell"; children: ArticleNode[] }
  | { type: "image"; url: string; alt: string | null; title: string | null }
  | { type: "thematicBreak" }
  | { type: "blockquote"; children: ArticleNode[] }
  | { type: "link"; url: string; children: ArticleNode[] }
  | { type: "break" }
  | { type: "math"; value: string }
  | { type: "inlineMath"; value: string };

/** One `##`/`###` heading, extracted for the table-of-contents sidebar. */
export interface ArticleHeading {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface ArticleDefinition {
  frontmatter: ArticleFrontmatter;
  content: ArticleNode[];
  headings: ArticleHeading[];
  readingTimeMinutes: number;
}

export interface ArticleParseError {
  message: string;
}

export type ArticleParseResult =
  | { ok: true; article: ArticleDefinition }
  | { ok: false; errors: ArticleParseError[] };
