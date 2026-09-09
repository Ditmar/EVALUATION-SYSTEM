import { prisma } from "@/lib/db";
import { parseArticle } from "./parse-article";
import type { ArticleDefinition } from "./types";

export interface ArticleSummary {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  readingTimeMinutes: number;
  publishedAt: Date | null;
  authorName: string;
  applauseCount: number;
}

/** Shared by the public listing API route and the `/home` server page — the single place that knows how to shape a published article for a card. */
export async function listPublishedArticles(tag?: string | null): Promise<ArticleSummary[]> {
  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED", ...(tag ? { tags: { has: tag } } : {}) },
    orderBy: { publishedAt: "desc" },
    include: {
      author: { select: { name: true, email: true } },
      claps: { select: { count: true } },
    },
  });

  return articles.map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    tags: a.tags,
    readingTimeMinutes: a.readingTimeMinutes,
    publishedAt: a.publishedAt,
    authorName: a.author.name || a.author.email,
    applauseCount: a.claps.reduce((sum, c) => sum + c.count, 0),
  }));
}

export interface ArticleDetail {
  slug: string;
  title: string;
  authorName: string;
  publishedAt: Date | null;
  readingTimeMinutes: number;
  tags: string[];
  applauseCount: number;
  definition: ArticleDefinition;
}

/**
 * Fetches a published article and re-parses its `markdownSource` (the source
 * of truth, same as `Laboratory.markdownSource`) — shared by the public
 * detail API route and the `/home/[slug]` server page. Returns `null` for a
 * missing or non-published article/slug (both a 404, no distinction leaked).
 */
export async function getPublishedArticleBySlug(slug: string): Promise<ArticleDetail | null> {
  const article = await prisma.article.findUnique({
    where: { slug },
    include: { author: { select: { name: true, email: true } }, claps: { select: { count: true } } },
  });
  if (!article || article.status !== "PUBLISHED") return null;

  const parsed = parseArticle(article.markdownSource);
  if (!parsed.ok) return null; // Shouldn't happen (validated at publish time), but don't crash the page on stale data.

  return {
    slug: article.slug,
    title: article.title,
    authorName: article.author.name || article.author.email,
    publishedAt: article.publishedAt,
    readingTimeMinutes: article.readingTimeMinutes,
    tags: article.tags,
    applauseCount: article.claps.reduce((sum, c) => sum + c.count, 0),
    definition: parsed.article,
  };
}
