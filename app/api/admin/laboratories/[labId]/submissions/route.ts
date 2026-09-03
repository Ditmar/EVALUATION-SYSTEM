import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLaboratoryAccess } from "@/lib/auth/require-admin";

export async function GET(request: NextRequest, { params }: { params: { labId: string } }) {
  const auth = await requireLaboratoryAccess(request, params.labId);
  if ("response" in auth) return auth.response;
  const { laboratory } = auth;

  const submissions = await prisma.laboratorySubmission.findMany({
    where: { laboratoryId: laboratory.id },
    include: { student: { select: { id: true, ci: true, nombres: true, apellidos: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ submissions });
}
