import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStudentSession } from "@/lib/auth/require-student";

export async function GET(request: NextRequest) {
  const auth = await requireStudentSession(request);
  if ("response" in auth) return auth.response;

  const student = await prisma.student.findUnique({ where: { id: auth.session.studentId } });
  if (!student) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({
    student: { ci: student.ci, nombres: student.nombres, apellidos: student.apellidos, correo: student.correo },
  });
}
