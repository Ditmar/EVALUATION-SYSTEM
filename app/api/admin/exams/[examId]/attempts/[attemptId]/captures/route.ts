import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isR2Configured, presignGetUrl } from "@/lib/storage/r2";

const URL_TTL_SECONDS = 60 * 60;

/** Capturas de pantalla de un intento, con URLs firmadas válidas por 1 hora. */
export async function GET(
  request: NextRequest,
  { params }: { params: { examId: string; attemptId: string } }
) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const attempt = await prisma.examAttempt.findFirst({
    where: { id: params.attemptId, examId: params.examId, exam: { createdById: auth.session.userId } },
    select: { id: true, exam: { select: { requireScreenCapture: true } } },
  });
  if (!attempt) {
    return NextResponse.json({ error: "Intento no encontrado." }, { status: 404 });
  }

  const captures = await prisma.screenCapture.findMany({
    where: { attemptId: attempt.id },
    orderBy: { createdAt: "asc" },
  });

  const configured = isR2Configured();
  const items = configured
    ? await Promise.all(
        captures.map(async (c) => ({
          id: c.id,
          createdAt: c.createdAt,
          url: await presignGetUrl(c.storageKey, URL_TTL_SECONDS),
        }))
      )
    : [];

  return NextResponse.json({
    requireScreenCapture: attempt.exam.requireScreenCapture,
    storageConfigured: configured,
    captures: items,
  });
}
