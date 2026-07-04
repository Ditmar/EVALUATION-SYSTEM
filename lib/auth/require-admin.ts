import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromRequest, type AdminSessionPayload } from "@/lib/auth/admin-session";

/**
 * Guards /api/admin/* route handlers. Next.js middleware only covers page
 * routes (matcher `/admin/:path*`), not `/api/admin/*` — each admin API route
 * must call this explicitly.
 */
export async function requireAdminSession(
  request: NextRequest
): Promise<{ session: AdminSessionPayload } | { response: NextResponse }> {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return { response: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  }
  return { session };
}
