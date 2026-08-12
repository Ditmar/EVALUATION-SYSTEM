import { NextRequest, NextResponse } from "next/server";
import { STUDENT_REFRESH_COOKIE } from "@/lib/constants";
import { clearStudentSessionCookies, revokeStudentSessionFamily, verifyStudentRefreshToken } from "@/lib/auth/student-session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(STUDENT_REFRESH_COOKIE)?.value;
  const payload = token ? await verifyStudentRefreshToken(token) : null;
  if (payload) {
    await revokeStudentSessionFamily(payload.familyId);
  }

  const response = NextResponse.json({ ok: true });
  clearStudentSessionCookies(response);
  return response;
}
