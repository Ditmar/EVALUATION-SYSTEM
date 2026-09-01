import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";

export async function GET(request: NextRequest, { params }: { params: { labId: string } }) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const laboratory = await prisma.laboratory.findFirst({
    where: { id: params.labId, createdById: auth.session.userId },
  });
  if (!laboratory) {
    return NextResponse.json({ error: "Laboratorio no encontrado." }, { status: 404 });
  }

  const submissions = await prisma.laboratorySubmission.findMany({
    where: { laboratoryId: laboratory.id },
    include: { student: { select: { id: true, ci: true, nombres: true, apellidos: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ submissions });
}
