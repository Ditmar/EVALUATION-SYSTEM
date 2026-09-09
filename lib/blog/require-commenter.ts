import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStudentSession } from "@/lib/auth/require-student";
import { requireAdminSession } from "@/lib/auth/require-admin";

export interface Commenter {
  authorType: "STUDENT" | "STAFF";
  authorName: string;
  studentId?: string;
  userId?: string;
}

/**
 * Guards `POST /api/public/articles/[slug]/comments`. Comments are open to
 * any authenticated `Student` or staff `User` (`TEACHER` or `ASSISTANT`) —
 * tries the student session first (the more common commenter), then falls
 * back to the admin session, since a request can only ever legitimately
 * carry one of the two cookies.
 */
export async function requireCommenter(request: NextRequest): Promise<{ commenter: Commenter } | { response: NextResponse }> {
  const studentAuth = await requireStudentSession(request);
  if ("session" in studentAuth) {
    const student = await prisma.student.findUnique({
      where: { id: studentAuth.session.studentId },
      select: { nombres: true, apellidos: true },
    });
    if (student) {
      return {
        commenter: {
          authorType: "STUDENT",
          authorName: `${student.nombres} ${student.apellidos}`.trim(),
          studentId: studentAuth.session.studentId,
        },
      };
    }
  }

  const adminAuth = await requireAdminSession(request);
  if ("session" in adminAuth) {
    const user = await prisma.user.findUnique({ where: { id: adminAuth.session.userId }, select: { name: true } });
    return {
      commenter: {
        authorType: "STAFF",
        authorName: user?.name || adminAuth.session.email,
        userId: adminAuth.session.userId,
      },
    };
  }

  return { response: NextResponse.json({ error: "Debes iniciar sesión como estudiante o docente para comentar." }, { status: 401 }) };
}
