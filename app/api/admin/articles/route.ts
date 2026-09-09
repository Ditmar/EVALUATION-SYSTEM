import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { parseArticle } from "@/lib/blog/parse-article";

/** Articles, like Subjects/Exams, are a TEACHER-only surface — an ASSISTANT never authors blog content. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;
  if (auth.session.role === "ASSISTANT") {
    return NextResponse.json({ error: "No tienes permiso para ver artículos." }, { status: 403 });
  }

  const articles = await prisma.article.findMany({
    where: { authorId: auth.session.userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { comments: true, claps: true } } },
  });

  return NextResponse.json({
    articles: articles.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      status: a.status,
      tags: a.tags,
      readingTimeMinutes: a.readingTimeMinutes,
      publishedAt: a.publishedAt,
      createdAt: a.createdAt,
      commentCount: a._count.comments,
    })),
  });
}

const CreateArticleSchema = z.object({
  markdownSource: z.string().min(1, "El contenido Markdown es requerido."),
  slug: z
    .string()
    .min(1, "El slug es requerido.")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "El slug solo puede tener minúsculas, números y guiones."),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;
  if (auth.session.role === "ASSISTANT") {
    return NextResponse.json({ error: "No tienes permiso para crear artículos." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = CreateArticleSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Datos inválidos.", issues: parsedBody.error.issues }, { status: 400 });
  }

  const parsed = parseArticle(parsedBody.data.markdownSource);
  if (!parsed.ok) {
    return NextResponse.json({ error: "El Markdown del artículo no es válido.", issues: parsed.errors }, { status: 400 });
  }

  try {
    const article = await prisma.article.create({
      data: {
        slug: parsedBody.data.slug,
        title: parsed.article.frontmatter.title,
        excerpt: parsed.article.frontmatter.excerpt,
        tags: parsed.article.frontmatter.tags,
        markdownSource: parsedBody.data.markdownSource,
        readingTimeMinutes: parsed.article.readingTimeMinutes,
        authorId: auth.session.userId,
      },
    });

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: `Ya existe un artículo con el slug "${parsedBody.data.slug}".` }, { status: 409 });
    }
    throw error;
  }
}
