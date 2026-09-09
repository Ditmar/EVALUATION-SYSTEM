import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkPublicRateLimit } from "@/lib/rate-limit-guard";

const MAX_CLAPS_PER_VISITOR = 50;

/** Current visitor's own clap count for this article — lets the button re-render as "clapped" after a page refresh. */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const clapperId = request.nextUrl.searchParams.get("clapperId");
  if (!clapperId) {
    return NextResponse.json({ error: "Falta clapperId." }, { status: 400 });
  }

  const article = await prisma.article.findUnique({ where: { slug: params.slug }, select: { id: true } });
  if (!article) {
    return NextResponse.json({ error: "Artículo no encontrado." }, { status: 404 });
  }

  const clap = await prisma.articleClap.findUnique({
    where: { articleId_clapperId: { articleId: article.id, clapperId } },
    select: { count: true },
  });

  return NextResponse.json({ byYou: clap?.count ?? 0 });
}

const ApplauseSchema = z.object({
  clapperId: z.string().min(1).max(100),
  amount: z.number().int().min(1).max(20),
});

/** Increments the visitor's own clap count, capped at `MAX_CLAPS_PER_VISITOR` server-side regardless of what `amount` claims. */
export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const rateLimited = checkPublicRateLimit(request, "blog-applause");
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const parsedBody = ApplauseSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const article = await prisma.article.findUnique({ where: { slug: params.slug }, select: { id: true, status: true } });
  if (!article || article.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Artículo no encontrado." }, { status: 404 });
  }

  const existing = await prisma.articleClap.findUnique({
    where: { articleId_clapperId: { articleId: article.id, clapperId: parsedBody.data.clapperId } },
  });
  const nextCount = Math.min(MAX_CLAPS_PER_VISITOR, (existing?.count ?? 0) + parsedBody.data.amount);

  await prisma.articleClap.upsert({
    where: { articleId_clapperId: { articleId: article.id, clapperId: parsedBody.data.clapperId } },
    create: { articleId: article.id, clapperId: parsedBody.data.clapperId, count: nextCount },
    update: { count: nextCount },
  });

  const total = await prisma.articleClap.aggregate({ where: { articleId: article.id }, _sum: { count: true } });

  return NextResponse.json({ total: total._sum.count ?? 0, byYou: nextCount });
}
