import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STUDENT_REFRESH_COOKIE } from "@/lib/constants";
import {
  clearStudentSessionCookies,
  rotateStudentSession,
  revokeStudentSessionFamily,
  setStudentSessionCookies,
  verifyStudentRefreshToken,
} from "@/lib/auth/student-session";
import { evaluateRefreshRotation } from "@/lib/auth/student-refresh-rotation";
import { checkPublicRateLimit } from "@/lib/rate-limit-guard";

export async function POST(request: NextRequest) {
  const limited = checkPublicRateLimit(request, "student-refresh");
  if (limited) return limited;

  const token = request.cookies.get(STUDENT_REFRESH_COOKIE)?.value;
  const payload = token ? await verifyStudentRefreshToken(token) : null;

  if (!payload) {
    const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
    clearStudentSessionCookies(response);
    return response;
  }

  const row = await prisma.studentRefreshToken.findUnique({ where: { id: payload.jti } });
  const decision = evaluateRefreshRotation(row, new Date());

  if (decision.action === "reuse-detected") {
    await revokeStudentSessionFamily(decision.familyId);
    const response = NextResponse.json(
      { error: "Se detectó un uso inválido de la sesión. Vuelve a iniciar sesión." },
      { status: 401 }
    );
    clearStudentSessionCookies(response);
    return response;
  }

  if (decision.action === "not-found" || decision.action === "expired") {
    const response = NextResponse.json({ error: "Sesión expirada." }, { status: 401 });
    clearStudentSessionCookies(response);
    return response;
  }

  // decision.action === "rotate" — defense in depth: the row backing this jti
  // must belong to the same student the JWT claims.
  if (decision.studentId !== payload.studentId) {
    const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
    clearStudentSessionCookies(response);
    return response;
  }

  const tokens = await rotateStudentSession(decision.studentId, decision.familyId, payload.jti);
  const response = NextResponse.json({ ok: true });
  setStudentSessionCookies(response, tokens);
  return response;
}
