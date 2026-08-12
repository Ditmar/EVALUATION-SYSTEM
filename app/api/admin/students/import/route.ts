import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { RosterImportSchema } from "@/lib/validation/roster-import-schema";
import { planRosterRow } from "@/lib/roster-import-plan";

interface RowResult {
  ci: string;
  status: "created" | "updated" | "error";
  error?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = RosterImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { entries } = parsed.data;

  // Resolve/create every referenced materia up front, scoped to this teacher.
  const materiaNames = [...new Set(entries.map((e) => e.materia))];
  const subjectIdByName = new Map<string, string>();
  for (const name of materiaNames) {
    const subject = await prisma.subject.upsert({
      where: { createdById_name: { createdById: auth.session.userId, name } },
      create: { name, createdById: auth.session.userId },
      update: {},
    });
    subjectIdByName.set(name, subject.id);
  }

  const results: RowResult[] = [];

  for (const entry of entries) {
    try {
      const existing = await prisma.student.findUnique({
        where: { ci: entry.ci },
        select: { ci: true, passwordHash: true },
      });
      const plan = planRosterRow(existing, entry);

      const student = await prisma.student.upsert({
        where: { ci: entry.ci },
        create: plan.action === "create" ? plan.fields : { ci: entry.ci, ...plan.fields, passwordHash: null },
        update: plan.action === "update" ? plan.fields : {},
      });

      const subjectId = subjectIdByName.get(entry.materia)!;
      await prisma.enrollment.upsert({
        where: { studentId_subjectId: { studentId: student.id, subjectId } },
        create: { studentId: student.id, subjectId },
        update: {},
      });

      results.push({ ci: entry.ci, status: plan.action === "create" ? "created" : "updated" });
    } catch (error) {
      results.push({ ci: entry.ci, status: "error", error: (error as Error).message });
    }
  }

  return NextResponse.json({ results });
}
