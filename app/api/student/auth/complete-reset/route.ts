import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { StudentCompleteResetSchema } from "@/lib/validation/student-auth-schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { normalizeTemporaryPassword } from "@/lib/auth/temporary-password";
import { issueStudentSession, setStudentSessionCookies } from "@/lib/auth/student-session";
import { checkPublicRateLimit } from "@/lib/rate-limit-guard";

const GENERIC_ERROR = "Carnet de identidad o contraseña temporal incorrectos.";

/**
 * Consume la contraseña temporal generada por el docente: la verifica de
 * nuevo, guarda la contraseña nueva, apaga `mustChangePassword` (la temporal
 * deja de servir) y abre sesión.
 */
export async function POST(request: NextRequest) {
  const limited = checkPublicRateLimit(request, "student-complete-reset");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = StudentCompleteResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { ci, temporaryPassword, newPassword } = parsed.data;

  const student = await prisma.student.findUnique({ where: { ci } });
  if (!student || !student.passwordHash || !student.mustChangePassword) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const normalizedTemp = normalizeTemporaryPassword(temporaryPassword);
  const valid = await verifyPassword(normalizedTemp, student.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  if (normalizeTemporaryPassword(newPassword) === normalizedTemp) {
    return NextResponse.json(
      { error: "La nueva contraseña no puede ser igual a la temporal." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(newPassword);
  // Condicionado al hash temporal vigente: si dos envíos llegan a la vez,
  // solo el primero consume la contraseña temporal.
  const consumed = await prisma.student.updateMany({
    where: { id: student.id, mustChangePassword: true, passwordHash: student.passwordHash },
    data: { passwordHash, mustChangePassword: false },
  });
  if (consumed.count === 0) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const tokens = await issueStudentSession(student.id);
  const response = NextResponse.json({
    student: { ci: student.ci, nombres: student.nombres, apellidos: student.apellidos },
  });
  setStudentSessionCookies(response, tokens);
  return response;
}
