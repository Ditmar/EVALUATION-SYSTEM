import { NextRequest, NextResponse } from "next/server";
import { listPublishedArticles } from "@/lib/blog/queries";

/** Public blog listing (`/home`): published articles only, newest first, optionally filtered by tag. */
export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get("tag");
  const articles = await listPublishedArticles(tag);
  return NextResponse.json({ articles });
}
