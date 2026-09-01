import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { STUDENT_ACCESS_COOKIE } from "@/lib/constants";
import { getStudentSessionFromRequest, verifyStudentAccessToken, type StudentAccessPayload } from "@/lib/auth/student-session";

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

/**
 * Server-side check for the initial load of a `/student/*` Server Component
 * page (reads cookies via `next/headers` instead of a `NextRequest`). Unlike
 * `/admin/*`, there is no middleware guarding `/student/*` — the 15-minute
 * access token means a page opened after being idle can be legitimately
 * expired without the student having "logged out"; pages should redirect to
 * `/student/login` on a null result here, then rely on `studentFetch`
 * (`lib/client/student-fetch.ts`) for silent refresh during the session.
 */
export async function getStudentSessionForPage(): Promise<StudentAccessPayload | null> {
  const token = cookies().get(STUDENT_ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyStudentAccessToken(token);
}
