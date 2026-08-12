import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { StudentActivateSchema } from "@/lib/validation/student-auth-schema";
import { hashPassword } from "@/lib/auth/password";
import { issueStudentSession, setStudentSessionCookies } from "@/lib/auth/student-session";
import { checkPublicRateLimit } from "@/lib/rate-limit-guard";

export async function POST(request: NextRequest) {
  const limited = checkPublicRateLimit(request, "student-activate");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = StudentActivateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { ci, password } = parsed.data;

  const student = await prisma.student.findUnique({ where: { ci } });
  if (!student) {
    return NextResponse.json(
      { error: "No encontramos tu carnet de identidad. Contacta a tu docente." },
      { status: 404 }
    );
  }
  if (student.passwordHash !== null) {
    return NextResponse.json(
      { error: "Esta cuenta ya fue activada. Inicia sesión." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  await prisma.student.update({ where: { id: student.id }, data: { passwordHash } });

  const tokens = await issueStudentSession(student.id);
  const response = NextResponse.json({
    student: { ci: student.ci, nombres: student.nombres, apellidos: student.apellidos },
  });
  setStudentSessionCookies(response, tokens);
  return response;
}
