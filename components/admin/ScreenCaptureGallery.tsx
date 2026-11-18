"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

interface Capture {
  id: string;
  createdAt: string;
  url: string;
}

interface CapturesResponse {
  requireScreenCapture: boolean;
  storageConfigured: boolean;
  captures: Capture[];
}

export function ScreenCaptureGallery({ examId, attemptId }: { examId: string; attemptId: string }) {
  const [data, setData] = useState<CapturesResponse | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/admin/exams/${examId}/attempts/${attemptId}/captures`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [examId, attemptId]);

  useEffect(() => {
    if (openIndex === null || !data) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : Math.min(i + 1, data!.captures.length - 1)));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, data]);

  if (!data) {
    return null;
  }
  // Solo se muestra en exámenes con captura activada o si quedaron capturas de antes.
  if (!data.requireScreenCapture && data.captures.length === 0) return null;

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("es-BO");
  const current = openIndex !== null ? data.captures[openIndex] : null;

  return (
    <Card>
      <h3 className="mb-1 font-medium text-slate-900">Capturas de pantalla ({data.captures.length})</h3>
      <p className="mb-3 text-xs text-slate-500">
        Capturas periódicas mientras el estudiante compartía la pantalla. Los huecos en la secuencia indican que dejó
        de compartir o perdió conexión.
      </p>

      {!data.storageConfigured ? (
        <p className="text-sm text-amber-700">
          El almacenamiento R2 no está configurado en el servidor (variables R2_*), por eso no se pueden mostrar.
        </p>
      ) : data.captures.length === 0 ? (
        <p className="text-sm text-slate-500">No hay capturas para este intento.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.captures.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group overflow-hidden rounded-lg border border-slate-200 text-left hover:border-brand-500"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.url} alt={`Captura ${formatTime(c.createdAt)}`} loading="lazy" className="aspect-video w-full bg-slate-100 object-cover" />
              <span className="block px-2 py-1 text-xs text-slate-500 group-hover:text-brand-600">{formatTime(c.createdAt)}</span>
            </button>
          ))}
        </div>
      )}

      {current && openIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 p-4"
          onClick={() => setOpenIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={`Captura ${formatTime(current.createdAt)}`}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="mt-3 flex items-center gap-4 text-sm text-white" onClick={(e) => e.stopPropagation()}>
            <button type="button" disabled={openIndex === 0} onClick={() => setOpenIndex(openIndex - 1)} className="rounded px-3 py-1 hover:bg-white/10 disabled:opacity-30">
              ← Anterior
            </button>
            <span>
              {formatTime(current.createdAt)} · {openIndex + 1} de {data.captures.length}
            </span>
            <button
              type="button"
              disabled={openIndex === data.captures.length - 1}
              onClick={() => setOpenIndex(openIndex + 1)}
              className="rounded px-3 py-1 hover:bg-white/10 disabled:opacity-30"
            >
              Siguiente →
            </button>
            <button type="button" onClick={() => setOpenIndex(null)} className="rounded px-3 py-1 hover:bg-white/10">
              Cerrar ✕
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
