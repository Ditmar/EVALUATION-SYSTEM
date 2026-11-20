"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { studentFetch } from "@/lib/client/student-fetch";
import {
  formatFileSize,
  imageAcceptAttribute,
  imageFormatFromMime,
  imageFormatNotAllowedMessage,
  imageFormatsLabel,
  imageTooLargeMessage,
  megabytesToBytes,
} from "@/lib/laboratory/image-upload";
import type { AnswerComponentProps } from "./types";

/**
 * Upload control for `type="image"`. The upload itself persists the answer on
 * the server (POST .../images/:questionId), so `onChange` here only mirrors
 * the stored key into the parent's state — `LaboratoryAttempt` doesn't run
 * its generic autosave for this type.
 *
 * The image is shown through `imageUrl` when the parent passes one (the
 * teacher's grading view), otherwise through the student's own endpoint.
 * Without `labId` and `imageUrl` (the admin import preview) it renders a
 * static, non-interactive placeholder.
 */
export function ImageAnswer({ question: rawQuestion, value, onChange, disabled, labId, imageUrl }: AnswerComponentProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  const [retries, setRetries] = useState(0);

  if (rawQuestion.type !== "image") return null;
  // A const binding keeps the narrowed type inside the handlers below.
  const question = rawQuestion;

  const key = typeof value === "string" && value.length > 0 ? value : null;
  const studentEndpoint = labId ? `/api/student/laboratories/${labId}/submission/images/${encodeURIComponent(question.id)}` : null;
  const viewBase = imageUrl ?? studentEndpoint;
  // The key changes on every upload, so it doubles as a cache-buster.
  const src = key && viewBase ? `${viewBase}?v=${encodeURIComponent(key.slice(-48))}&r=${retries}` : null;
  const limitsText = `Formatos: ${imageFormatsLabel(question.formats)} · Tamaño máximo: ${formatFileSize(megabytesToBytes(question.maxSizeMb))}`;
  const interactive = !disabled && studentEndpoint !== null;

  async function handleFile(file: File) {
    setError(null);

    const format = imageFormatFromMime(file.type);
    if (!format || !question.formats.includes(format)) {
      setError(imageFormatNotAllowedMessage(question.formats));
      return;
    }
    if (file.size > megabytesToBytes(question.maxSizeMb)) {
      setError(imageTooLargeMessage(file.size, question.maxSizeMb));
      return;
    }

    setBusy("uploading");
    try {
      const res = await studentFetch(studentEndpoint!, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo subir la imagen.");
        return;
      }
      onChange(data.value);
    } catch {
      setError("No se pudo subir la imagen. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy("removing");
    try {
      const res = await studentFetch(studentEndpoint!, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo quitar la imagen.");
        return;
      }
      onChange("");
    } finally {
      setBusy(null);
    }
  }

  // The student access token is short-lived and an <img> request can't
  // refresh it; on a failed load, refresh through studentFetch and retry once.
  function handleImageError() {
    if (retries > 0 || imageUrl || !studentEndpoint) return;
    studentFetch(studentEndpoint, { redirect: "manual" })
      .catch(() => undefined)
      .finally(() => setRetries(1));
  }

  return (
    <div className="space-y-2">
      {src ? (
        <a href={src} target="_blank" rel="noreferrer" className="block w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Imagen enviada"
            onError={handleImageError}
            className="max-h-96 max-w-full rounded-lg border border-slate-200 object-contain"
          />
        </a>
      ) : (
        <div
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm ${
            interactive ? "cursor-pointer border-slate-300 hover:border-brand-400 hover:bg-slate-50" : "border-slate-200 text-slate-400"
          }`}
          onClick={() => interactive && !busy && inputRef.current?.click()}
          onDragOver={(e) => interactive && e.preventDefault()}
          onDrop={(e) => {
            if (!interactive || busy) return;
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          {busy === "uploading" ? (
            <span className="flex items-center gap-2 text-slate-600">
              <Spinner /> Subiendo imagen...
            </span>
          ) : (
            <span className="font-medium text-slate-600">
              {interactive ? (question.placeholder ?? "Haz clic o arrastra una imagen aquí") : "Sin imagen enviada"}
            </span>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500">{limitsText}</p>

      {interactive && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={imageAcceptAttribute(question.formats)}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // allow re-selecting the same file after an error
              if (file) handleFile(file);
            }}
          />
          {key && (
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => inputRef.current?.click()}>
                {busy === "uploading" ? "Subiendo..." : "Reemplazar imagen"}
              </Button>
              <Button type="button" variant="danger" disabled={busy !== null} onClick={handleRemove}>
                {busy === "removing" ? "Quitando..." : "Quitar"}
              </Button>
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
