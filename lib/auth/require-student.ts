import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest, type StudentAccessPayload } from "@/lib/auth/student-session";

/**
 * Guards student-facing API routes. Mirrors `requireAdminSession` in
 * `lib/auth/require-admin.ts`.
 */
export async function requireStudentSession(
  request: NextRequest
): Promise<{ session: StudentAccessPayload } | { response: NextResponse }> {
  const session = await getStudentSessionFromRequest(request);
  if (!session) {
    return { response: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  }
  return { session };
}
