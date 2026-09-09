import { NextRequest, NextResponse } from "next/server";
import { getPublishedArticleBySlug } from "@/lib/blog/queries";

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  const article = await getPublishedArticleBySlug(params.slug);
  if (!article) {
    return NextResponse.json({ error: "Artículo no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ article });
}
