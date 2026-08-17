import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const subjectId = request.nextUrl.searchParams.get("subjectId");

  const enrollments = await prisma.enrollment.findMany({
    where: {
      subject: { createdById: auth.session.userId },
      ...(subjectId ? { subjectId } : {}),
    },
    include: {
      student: { select: { id: true, ci: true, nombres: true, apellidos: true, correo: true, passwordHash: true } },
      subject: { select: { id: true, name: true } },
    },
    orderBy: [{ student: { apellidos: "asc" } }, { student: { nombres: "asc" } }],
  });

  return NextResponse.json({
    students: enrollments.map((e) => ({
      id: e.student.id,
      ci: e.student.ci,
      nombres: e.student.nombres,
      apellidos: e.student.apellidos,
      correo: e.student.correo,
      activated: e.student.passwordHash !== null,
      subjectId: e.subject.id,
      subjectName: e.subject.name,
    })),
  });
}
