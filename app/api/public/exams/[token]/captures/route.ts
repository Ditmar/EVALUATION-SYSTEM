import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAttemptSessionFromRequest } from "@/lib/auth/attempt-session";
import { checkRateLimitByKey } from "@/lib/rate-limit-guard";
import { remainingMs } from "@/lib/time";
import { isR2Configured, putObject } from "@/lib/storage/r2";

const MAX_CAPTURE_BYTES = 1024 * 1024; // 1 MB; una captura JPEG típica pesa ~50-150 KB

/** JPEG empieza con FF D8 FF: evita que se suba cualquier archivo como "captura". */
function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * Recibe una captura de pantalla (JPEG en el cuerpo) del intento en curso y
 * la guarda en R2. Solo para exámenes con `requireScreenCapture`.
 */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const exam = await prisma.exam.findUnique({ where: { publicToken: params.token } });
  if (!exam) {
    return NextResponse.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  const session = await getAttemptSessionFromRequest(request, params.token, exam.id);
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const limited = checkRateLimitByKey(`attempt:${session.attemptId}`, "captures");
  if (limited) return limited;

  if (!exam.requireScreenCapture) {
    return NextResponse.json({ error: "Este examen no requiere captura de pantalla." }, { status: 400 });
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: "El almacenamiento de capturas no está configurado." }, { status: 503 });
  }

  const attempt = await prisma.examAttempt.findUnique({ where: { id: session.attemptId } });
  if (!attempt || attempt.status !== "IN_PROGRESS" || remainingMs(attempt.expiresAt) <= 0) {
    return NextResponse.json({ error: "El intento ya no está en curso." }, { status: 409 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_CAPTURE_BYTES) {
    return NextResponse.json({ error: "Captura demasiado grande." }, { status: 413 });
  }

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.length === 0 || body.length > MAX_CAPTURE_BYTES || !isJpeg(body)) {
    return NextResponse.json({ error: "Captura inválida." }, { status: 400 });
  }

  const storageKey = `exams/${exam.id}/${attempt.id}/${Date.now()}.jpg`;
  try {
    await putObject(storageKey, body, "image/jpeg");
  } catch (error) {
    console.error("[captures] Error subiendo a R2:", error);
    return NextResponse.json({ error: "No se pudo guardar la captura." }, { status: 502 });
  }

  await prisma.screenCapture.create({
    data: { attemptId: attempt.id, storageKey, sizeBytes: body.length },
  });

  return NextResponse.json({ ok: true });
}
