import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStudentSession } from "@/lib/auth/require-student";

export async function GET(request: NextRequest) {
  const auth = await requireStudentSession(request);
  if ("response" in auth) return auth.response;

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: auth.session.studentId },
    select: { subjectId: true },
  });
  const subjectIds = enrollments.map((e) => e.subjectId);

  const laboratories = await prisma.laboratory.findMany({
    where: { status: "PUBLISHED", subjectId: { in: subjectIds } },
    orderBy: { createdAt: "desc" },
    include: {
      subject: { select: { id: true, name: true } },
      submissions: {
        where: { studentId: auth.session.studentId },
        select: { id: true, status: true, totalScore: true },
      },
    },
  });

  return NextResponse.json({
    laboratories: laboratories.map((lab) => ({
      id: lab.id,
      title: lab.title,
      subject: { id: lab.subject.id, name: lab.subject.name },
      totalPoints: lab.totalPoints,
      durationMinutes: lab.durationMinutes,
      submission: lab.submissions[0] ?? null,
    })),
  });
}
