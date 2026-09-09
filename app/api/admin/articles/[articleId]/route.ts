import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ArticleStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { parseArticle } from "@/lib/blog/parse-article";

async function findOwnArticle(articleId: string, userId: string) {
  return prisma.article.findFirst({ where: { id: articleId, authorId: userId } });
}

export async function GET(request: NextRequest, { params }: { params: { articleId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const article = await findOwnArticle(params.articleId, auth.session.userId);
  if (!article) {
    return NextResponse.json({ error: "Artículo no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ article });
}

const UpdateSchema = z.union([
  z.object({
    markdownSource: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  }),
  z.object({ status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) }),
]);

export async function PATCH(request: NextRequest, { params }: { params: { articleId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;
  if (auth.session.role === "ASSISTANT") {
    return NextResponse.json({ error: "No tienes permiso para editar artículos." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = UpdateSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const existing = await findOwnArticle(params.articleId, auth.session.userId);
  if (!existing) {
    return NextResponse.json({ error: "Artículo no encontrado." }, { status: 404 });
  }

  if ("status" in parsedBody.data) {
    const nextStatus = parsedBody.data.status as ArticleStatus;
    const article = await prisma.article.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        // Only stamped the first time it goes live — a republish after
        // unpublishing/archiving keeps its original `publishedAt`.
        publishedAt: nextStatus === "PUBLISHED" && !existing.publishedAt ? new Date() : existing.publishedAt,
      },
    });
    return NextResponse.json({ article });
  }

  const parsed = parseArticle(parsedBody.data.markdownSource);
  if (!parsed.ok) {
    return NextResponse.json({ error: "El Markdown del artículo no es válido.", issues: parsed.errors }, { status: 400 });
  }

  try {
    const article = await prisma.article.update({
      where: { id: existing.id },
      data: {
        slug: parsedBody.data.slug,
        title: parsed.article.frontmatter.title,
        excerpt: parsed.article.frontmatter.excerpt,
        tags: parsed.article.frontmatter.tags,
        markdownSource: parsedBody.data.markdownSource,
        readingTimeMinutes: parsed.article.readingTimeMinutes,
      },
    });
    return NextResponse.json({ article });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: `Ya existe un artículo con el slug "${parsedBody.data.slug}".` }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { articleId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;
  if (auth.session.role === "ASSISTANT") {
    return NextResponse.json({ error: "No tienes permiso para eliminar artículos." }, { status: 403 });
  }

  const existing = await findOwnArticle(params.articleId, auth.session.userId);
  if (!existing) {
    return NextResponse.json({ error: "Artículo no encontrado." }, { status: 404 });
  }

  await prisma.article.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
