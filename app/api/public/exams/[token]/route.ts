import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const exam = await prisma.exam.findUnique({ where: { publicToken: params.token } });

  if (!exam || !exam.isPublished) {
    return NextResponse.json({ error: "Examen no encontrado o no disponible." }, { status: 404 });
  }

  return NextResponse.json({
    metadata: {
      title: exam.title,
      career: exam.career,
      academicTerm: exam.academicTerm,
      subject: exam.subject,
      examDate: exam.examDate,
      durationMinutes: exam.durationMinutes,
      instructions: exam.instructions,
      evaluationType: exam.evaluationType,
    },
    settings: {
      trackFocusEvents: exam.trackFocusEvents,
      monitorExternalIps: exam.monitorExternalIps,
    },
  });
}
