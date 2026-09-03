import { NextRequest, NextResponse } from "next/server";
import type { Laboratory, Role } from "@prisma/client";
import { getAdminSessionFromRequest } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db";

export interface AdminAuthSession {
  userId: string;
  email: string;
  role: Role;
}

/**
 * Guards /api/admin/* route handlers. Next.js middleware only covers page
 * routes (matcher `/admin/:path*`), not `/api/admin/*` — each admin API route
 * must call this explicitly.
 *
 * `role` and `active` are re-checked against the DB on every call, never
 * trusted from the session cookie (which only carries `{userId, email}` and
 * can be up to 8h old) — this is what makes deactivating an ASSISTANT
 * account (or flipping its role/grants) take effect on its very next
 * request instead of waiting out the session.
 */
export async function requireAdminSession(
  request: NextRequest
): Promise<{ session: AdminAuthSession } | { response: NextResponse }> {
  const tokenSession = await getAdminSessionFromRequest(request);
  if (!tokenSession) {
    return { response: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenSession.userId },
    select: { id: true, email: true, role: true, active: true },
  });
  if (!user || !user.active) {
    return { response: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  }

  return { session: { userId: user.id, email: user.email, role: user.role } };
}

/**
 * Guards the laboratory-review surface (submissions list/detail, grade,
 * ai-evaluate, reopen, close, github-diff, and the laboratory GET itself).
 * Grants access when either:
 * - the caller is the `TEACHER` who owns the laboratory (today's only path,
 *   unchanged), or
 * - the caller is an `ASSISTANT` with a `SubjectAssistantAccess` grant for
 *   the laboratory's subject.
 *
 * Editing/publishing/archiving/deleting a laboratory, and everything outside
 * this surface (Subjects, Students, Exams), stays exclusively
 * `laboratory.createdById === userId` — this helper is never used there.
 *
 * Returns the already-fetched `laboratory` row so callers don't need a
 * second query. Responds 404 (not 403) on a denied grant, matching every
 * other admin route's "don't reveal whether it exists" behavior for
 * resources the caller doesn't own.
 */
export async function requireLaboratoryAccess(
  request: NextRequest,
  labId: string
): Promise<{ session: AdminAuthSession; laboratory: Laboratory } | { response: NextResponse }> {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth;

  const laboratory = await prisma.laboratory.findUnique({ where: { id: labId } });
  const notFound = { response: NextResponse.json({ error: "Laboratorio no encontrado." }, { status: 404 }) };
  if (!laboratory) return notFound;

  if (laboratory.createdById === auth.session.userId) {
    return { session: auth.session, laboratory };
  }

  if (auth.session.role === "ASSISTANT") {
    const grant = await prisma.subjectAssistantAccess.findUnique({
      where: { subjectId_assistantId: { subjectId: laboratory.subjectId, assistantId: auth.session.userId } },
    });
    if (grant) return { session: auth.session, laboratory };
  }

  return notFound;
}
