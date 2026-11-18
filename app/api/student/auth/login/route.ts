import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { StudentLoginSchema } from "@/lib/validation/student-auth-schema";
import { verifyPassword } from "@/lib/auth/password";
import { normalizeTemporaryPassword } from "@/lib/auth/temporary-password";
import { issueStudentSession, setStudentSessionCookies } from "@/lib/auth/student-session";
import { checkPublicRateLimit } from "@/lib/rate-limit-guard";

const GENERIC_ERROR = "Carnet de identidad o contraseña incorrectos.";

export async function POST(request: NextRequest) {
  const limited = checkPublicRateLimit(request, "student-login");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = StudentLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const { ci, password } = parsed.data;

  const student = await prisma.student.findUnique({ where: { ci } });
  if (!student || !student.passwordHash) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const candidate = student.mustChangePassword ? normalizeTemporaryPassword(password) : password;
  const valid = await verifyPassword(candidate, student.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  // Contraseña temporal (reseteada por el docente): no se abre sesión, el
  // cliente debe pedir una contraseña nueva vía /api/student/auth/complete-reset.
  if (student.mustChangePassword) {
    return NextResponse.json({ mustChangePassword: true });
  }

  const tokens = await issueStudentSession(student.id);
  const response = NextResponse.json({
    student: { ci: student.ci, nombres: student.nombres, apellidos: student.apellidos },
  });
  setStudentSessionCookies(response, tokens);
  return response;
}
