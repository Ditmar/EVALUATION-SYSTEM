"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import { RosterImportSchema, type RosterEntryInput } from "@/lib/validation/roster-import-schema";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const EXAMPLE_JSON = `[
  { "ci": "1234566", "nombres": "Davinia Irlanda", "apellidos": "Castro Loredo", "materia": "Programación II" },
  { "ci": "7654321", "nombres": "Juan", "apellidos": "Pérez Gómez", "materia": "Programación II" }
]`;

interface RowResult {
  ci: string;
  status: "created" | "updated" | "error";
  error?: string;
}

export function StudentImportForm() {
  const [raw, setRaw] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<RosterEntryInput[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleValidate() {
    setErrors([]);
    setPreview(null);
    setResults(null);

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      setErrors([`El texto no es un JSON válido: ${(e as Error).message}`]);
      return;
    }

    // Accept either a bare array of entries or the full `{entries: [...]}` shape.
    const normalized = Array.isArray(json) ? { entries: json } : json;

    const parsed = RosterImportSchema.safeParse(normalized);
    if (!parsed.success) {
      setErrors(formatZodIssues(parsed.error));
      return;
    }

    setPreview(parsed.data.entries);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRaw(text);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    setErrors([]);
    try {
      const res = await fetch("/api/admin/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: preview }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors([data.error ?? "No se pudo importar el roster."]);
        return;
      }
      setResults(data.results ?? []);
      setPreview(null);
      setRaw("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-slate-900">Pegar o subir JSON de estudiantes</h2>
          <div className="flex items-center gap-3 text-xs">
            <button type="button" className="text-brand-600 hover:underline" onClick={() => setRaw(EXAMPLE_JSON)}>
              Cargar ejemplo
            </button>
            <button type="button" className="text-brand-600 hover:underline" onClick={() => fileInputRef.current?.click()}>
              Subir archivo .json
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileUpload} />
          </div>
        </div>
        <TextArea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={16}
          className="font-mono text-xs"
          placeholder='[{"ci": "...", "nombres": "...", "apellidos": "...", "materia": "..."}]'
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
          <Button variant="secondary" onClick={handleValidate} type="button">
            Validar y previsualizar
          </Button>
          <Button onClick={handleSave} disabled={!preview || saving} type="button">
            {saving ? "Importando..." : "Importar estudiantes"}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {preview && (
          <Card>
            <h3 className="mb-2 font-medium text-slate-900">Vista previa ({preview.length})</h3>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 pr-3">CI</th>
                    <th className="py-1 pr-3">Nombres</th>
                    <th className="py-1 pr-3">Apellidos</th>
                    <th className="py-1 pr-3">Materia</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1 pr-3">{r.ci}</td>
                      <td className="py-1 pr-3">{r.nombres}</td>
                      <td className="py-1 pr-3">{r.apellidos}</td>
                      <td className="py-1 pr-3">{r.materia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {results && (
          <Card>
            <h3 className="mb-2 font-medium text-slate-900">Resultado de la importación</h3>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 pr-3">CI</th>
                    <th className="py-1 pr-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1 pr-3">{r.ci}</td>
                      <td className="py-1 pr-3">
                        <Badge tone={r.status === "error" ? "red" : r.status === "created" ? "green" : "blue"}>
                          {r.status === "created" ? "Creado" : r.status === "updated" ? "Actualizado" : `Error: ${r.error}`}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {!preview && !results && (
          <Card className="text-sm text-slate-500">La vista previa aparecerá aquí después de validar el JSON.</Card>
        )}
      </div>
    </div>
  );
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
