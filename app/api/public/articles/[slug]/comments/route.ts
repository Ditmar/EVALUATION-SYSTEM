import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCommenter } from "@/lib/blog/require-commenter";
import { checkPublicRateLimit } from "@/lib/rate-limit-guard";

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  const article = await prisma.article.findUnique({ where: { slug: params.slug }, select: { id: true } });
  if (!article) {
    return NextResponse.json({ error: "Artículo no encontrado." }, { status: 404 });
  }

  const comments = await prisma.articleComment.findMany({
    where: { articleId: article.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, authorName: true, authorType: true, createdAt: true },
  });

  return NextResponse.json({ comments });
}

const CommentSchema = z.object({
  content: z.string().trim().min(1, "El comentario no puede estar vacío.").max(2000, "El comentario es demasiado largo."),
});

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const rateLimited = checkPublicRateLimit(request, "blog-comment");
  if (rateLimited) return rateLimited;

  const commenterAuth = await requireCommenter(request);
  if ("response" in commenterAuth) return commenterAuth.response;

  const body = await request.json().catch(() => null);
  const parsedBody = CommentSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const article = await prisma.article.findUnique({ where: { slug: params.slug }, select: { id: true, status: true } });
  if (!article || article.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Artículo no encontrado." }, { status: 404 });
  }

  const { commenter } = commenterAuth;
  const comment = await prisma.articleComment.create({
    data: {
      articleId: article.id,
      content: parsedBody.data.content,
      authorType: commenter.authorType,
      authorName: commenter.authorName,
      studentId: commenter.studentId,
      userId: commenter.userId,
    },
    select: { id: true, content: true, authorName: true, authorType: true, createdAt: true },
  });

  return NextResponse.json({ comment }, { status: 201 });
}
