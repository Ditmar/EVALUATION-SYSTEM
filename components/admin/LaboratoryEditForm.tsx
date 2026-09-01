"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import type { LaboratoryDefinition, LaboratoryParseWarning } from "@/lib/laboratory/types";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { Card } from "@/components/ui/Card";
import { LaboratoryPreview } from "@/components/admin/LaboratoryPreview";

interface Props {
  labId: string;
  initialMarkdown: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export function LaboratoryEditForm({ labId, initialMarkdown, status }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState(initialMarkdown);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ laboratory: LaboratoryDefinition; warnings: LaboratoryParseWarning[] } | null>(null);
  const [saving, setSaving] = useState(false);

  function handleValidate() {
    setErrors([]);
    setPreview(null);

    const result = parseLaboratory(raw);
    if (!result.ok) {
      setErrors(result.errors.map((e) => e.message));
      return;
    }

    setPreview({ laboratory: result.laboratory, warnings: result.warnings });
  }

  // Show a preview immediately on load — this is an edit, not a blank slate.
  useEffect(() => {
    handleValidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRaw(text);
    setErrors([]);
    setPreview(null);
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    setErrors([]);

    try {
      const res = await fetch(`/api/admin/laboratories/${labId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdownSource: raw }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrors([data.error ?? "No se pudo guardar el laboratorio.", ...(data.issues ?? []).map((i: { message: string }) => i.message)]);
        return;
      }

      router.push(`/admin/laboratories/${labId}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {status === "PUBLISHED" && (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-800">
          Este laboratorio está publicado. Los estudiantes que ya empezaron conservan la versión que respondieron
          (<code>markdownSnapshot</code>); guardar aquí solo afecta a nuevas entregas a partir de ahora, y sube la versión del
          laboratorio.
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-slate-900">Markdown del laboratorio</h2>
            <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => fileInputRef.current?.click()}>
              Subir .md
            </button>
            <input ref={fileInputRef} type="file" accept=".md,text/markdown" className="hidden" onChange={handleFileUpload} />
          </div>
          <TextArea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={22}
            className="font-mono text-xs"
            placeholder="Pega o sube aquí el Markdown del laboratorio..."
          />
          {errors.length > 0 && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <p className="mb-1 font-medium">Se encontraron errores:</p>
              <ul className="list-inside list-disc space-y-1">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={handleValidate} type="button" disabled={!raw.trim()}>
              Validar y previsualizar
            </Button>
            <Button onClick={handleSave} disabled={!preview || saving} type="button">
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
            <Button variant="secondary" onClick={() => router.push(`/admin/laboratories/${labId}`)} type="button">
              Cancelar
            </Button>
          </div>
        </Card>

        <div>
          {preview ? (
            <LaboratoryPreview laboratory={preview.laboratory} warnings={preview.warnings} />
          ) : (
            <Card className="text-sm text-slate-500">La vista previa aparecerá aquí después de validar el Markdown.</Card>
          )}
        </div>
      </div>
    </div>
  );
}
