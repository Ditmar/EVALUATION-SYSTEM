import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { hashPassword } from "@/lib/auth/password";
import { generateTemporaryPassword } from "@/lib/auth/temporary-password";

/**
 * Genera una contraseña temporal de un solo uso para el estudiante y se la
 * devuelve al docente (una sola vez, no se guarda en claro). La contraseña
 * anterior deja de funcionar y se cierran todas sus sesiones activas; en el
 * próximo login el estudiante debe crear una contraseña nueva.
 *
 * Solo el TEACHER dueño de alguna materia donde el estudiante está
 * matriculado puede resetearla.
 */
export async function POST(request: NextRequest, { params }: { params: { studentId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const notFound = NextResponse.json({ error: "Estudiante no encontrado." }, { status: 404 });
  if (auth.session.role !== "TEACHER") return notFound;

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: params.studentId, subject: { createdById: auth.session.userId } },
    select: { id: true },
  });
  if (!enrollment) return notFound;

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await prisma.$transaction([
    prisma.student.update({
      where: { id: params.studentId },
      data: { passwordHash, mustChangePassword: true },
    }),
    prisma.studentRefreshToken.updateMany({
      where: { studentId: params.studentId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ temporaryPassword });
}
