import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStudentSession } from "@/lib/auth/require-student";
import { checkRateLimitByKey } from "@/lib/rate-limit-guard";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import { mergeAnswer } from "@/lib/laboratory/submission";
import {
  IMAGE_FORMAT_INFO,
  detectImageFormat,
  imageFormatNotAllowedMessage,
  imageStoragePrefix,
  imageTooLargeMessage,
  megabytesToBytes,
} from "@/lib/laboratory/image-upload";
import { deleteObject, getReadUrl, isR2Configured, putObject } from "@/lib/storage/r2";
import type { AnswersMap, ImageQuestion } from "@/lib/laboratory/types";

type Params = { params: { labId: string; questionId: string } };

async function loadContext(request: NextRequest, { labId, questionId }: Params["params"]) {
  const auth = await requireStudentSession(request);
  if ("response" in auth) return { response: auth.response };

  const submission = await prisma.laboratorySubmission.findFirst({
    where: { laboratoryId: labId, studentId: auth.session.studentId },
  });
  if (!submission) {
    return { response: NextResponse.json({ error: "No has iniciado este laboratorio." }, { status: 404 }) };
  }

  const parsed = parseLaboratory(submission.markdownSnapshot);
  if (!parsed.ok) {
    return { response: NextResponse.json({ error: "No se pudo interpretar el laboratorio." }, { status: 500 }) };
  }
  const question = parsed.laboratory.questions.find((q) => q.id === questionId);
  if (!question || question.type !== "image") {
    return { response: NextResponse.json({ error: "Pregunta de imagen no encontrada." }, { status: 404 }) };
  }

  const prefix = imageStoragePrefix(labId, submission.id, questionId);
  return { studentId: auth.session.studentId, submission, question: question as ImageQuestion, prefix };
}

function storedKey(answers: unknown, questionId: string, prefix: string): string | null {
  const value = (answers as AnswersMap | null)?.[questionId];
  return typeof value === "string" && value.startsWith(prefix) ? value : null;
}

async function deleteQuietly(key: string | null) {
  if (!key) return;
  try {
    await deleteObject(key);
  } catch (error) {
    console.error("[lab-images] No se pudo borrar la imagen anterior de R2:", error);
  }
}

/** Redirects to the stored image (CDN or short-lived signed URL). */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = await loadContext(request, params);
  if ("response" in ctx) return ctx.response;
  if (!isR2Configured()) {
    return NextResponse.json({ error: "El almacenamiento de imágenes no está configurado." }, { status: 503 });
  }

  const key = storedKey(ctx.submission.answers, params.questionId, ctx.prefix);
  if (!key) return NextResponse.json({ error: "Sin imagen." }, { status: 404 });

  const response = NextResponse.redirect(await getReadUrl(key), 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * Uploads the image (raw bytes in the body) for one `image` question and
 * stores its R2 key as the answer. Size and format are enforced here from the
 * submission's own snapshot — the browser check is only a convenience.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const ctx = await loadContext(request, params);
  if ("response" in ctx) return ctx.response;
  const { submission, question, prefix } = ctx;

  const limited = checkRateLimitByKey(`student:${ctx.studentId}`, "lab-images");
  if (limited) return limited;

  if (submission.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Este laboratorio ya fue enviado." }, { status: 409 });
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: "El almacenamiento de imágenes no está configurado." }, { status: 503 });
  }

  const maxBytes = megabytesToBytes(question.maxSizeMb);
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxBytes) {
    return NextResponse.json({ error: imageTooLargeMessage(declaredLength, question.maxSizeMb) }, { status: 413 });
  }

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.length === 0) {
    return NextResponse.json({ error: "El archivo está vacío." }, { status: 400 });
  }
  if (body.length > maxBytes) {
    return NextResponse.json({ error: imageTooLargeMessage(body.length, question.maxSizeMb) }, { status: 413 });
  }

  const format = detectImageFormat(body);
  if (!format || !question.formats.includes(format)) {
    return NextResponse.json({ error: imageFormatNotAllowedMessage(question.formats) }, { status: 415 });
  }

  // Random suffix: with a public CDN in front of the bucket, the key is the
  // only thing protecting the file, so it must not be guessable.
  const key = `${prefix}${Date.now()}-${randomUUID()}.${IMAGE_FORMAT_INFO[format].extensions[0]}`;
  try {
    await putObject(key, body, IMAGE_FORMAT_INFO[format].mime);
  } catch (error) {
    console.error("[lab-images] Error subiendo a R2:", error);
    return NextResponse.json({ error: "No se pudo guardar la imagen. Inténtalo de nuevo." }, { status: 502 });
  }

  // Re-read right before writing: the upload can take seconds, and other
  // fields may have been autosaved meanwhile — merging onto the copy read at
  // the start would silently revert them.
  const fresh = await prisma.laboratorySubmission.findUnique({ where: { id: submission.id } });
  if (!fresh || fresh.status !== "IN_PROGRESS") {
    await deleteQuietly(key);
    return NextResponse.json({ error: "Este laboratorio ya fue enviado." }, { status: 409 });
  }
  const previousKey = storedKey(fresh.answers, params.questionId, prefix);

  await prisma.laboratorySubmission.update({
    where: { id: submission.id },
    data: { answers: mergeAnswer(fresh.answers as AnswersMap | null, params.questionId, key) as unknown as Prisma.InputJsonValue },
  });

  if (previousKey && previousKey !== key) await deleteQuietly(previousKey);

  return NextResponse.json({ value: key, sizeBytes: body.length });
}

/** Removes the image answer (and its object in R2). */
export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = await loadContext(request, params);
  if ("response" in ctx) return ctx.response;
  const { submission, prefix } = ctx;

  if (submission.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Este laboratorio ya fue enviado." }, { status: 409 });
  }

  const answers = { ...((submission.answers as AnswersMap | null) ?? {}) };
  const previousKey = storedKey(answers, params.questionId, prefix);
  delete answers[params.questionId];

  await prisma.laboratorySubmission.update({
    where: { id: submission.id },
    data: { answers: answers as unknown as Prisma.InputJsonValue },
  });

  if (isR2Configured()) await deleteQuietly(previousKey);

  return NextResponse.json({ ok: true });
}
