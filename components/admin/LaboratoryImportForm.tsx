"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import type { LaboratoryDefinition, LaboratoryParseWarning } from "@/lib/laboratory/types";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { LaboratoryPreview } from "@/components/admin/LaboratoryPreview";

interface Subject {
  id: string;
  name: string;
}

const EXAMPLE_MARKDOWN = `---
id: graph-dijkstra-01
title: Laboratorio de Dijkstra
subject: Investigacion Operativa II
version: 1
duration: 120
points: 30
status: draft
---

# Laboratorio de Dijkstra

## Objetivo

Comprender el funcionamiento del algoritmo de Dijkstra aplicado a una red urbana.

---

## Actividad 1

Ejecute Dijkstra desde el nodo indicado.

Ingrese la distancia obtenida:

{{answer
  id="distance"
  type="number"
  points="5"
  expected="1854.3"
  tolerance="0.5"
  evaluator="automatic"
}}

---

## Actividad 2

¿El camino obtenido coincide con el que elegiría visualmente?

{{answer
  id="visual-path"
  type="single-choice"
  options="Sí|No"
  points="5"
  evaluator="manual"
}}

---

## Actividad 3

Explique por qué Dijkstra encuentra el camino mínimo.

{{answer
  id="dijkstra-analysis"
  type="textarea"
  points="10"
  evaluator="ai"
  placeholder="Explique el comportamiento observado..."
}}

{{rubric for="dijkstra-analysis"}}
La respuesta debe mencionar:

- pesos de las aristas;
- distancia acumulada;
- selección del nodo con menor distancia;
- actualización de vecinos;
- camino mínimo.
{{/rubric}}

---

## Actividad 4

Implemente una función que ejecute Dijkstra.

{{answer
  id="dijkstra-code"
  type="code"
  language="java"
  points="10"
  evaluator="manual"
}}
`;

export function LaboratoryImportForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ laboratory: LaboratoryDefinition; warnings: LaboratoryParseWarning[] } | null>(null);
  const [saving, setSaving] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");

  useEffect(() => {
    fetch("/api/admin/subjects")
      .then((res) => res.json())
      .then((data) => setSubjects(data.subjects ?? []));
  }, []);

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
      const res = await fetch("/api/admin/laboratories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdownSource: raw, subjectId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrors([data.error ?? "No se pudo guardar el laboratorio.", ...(data.issues ?? []).map((i: { message: string }) => i.message)]);
        return;
      }

      router.push(`/admin/laboratories/${data.laboratory.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 font-medium text-slate-900">Materia</h2>
        <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Selecciona una materia...</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <p className="mt-2 text-xs text-slate-500">
          Solo los estudiantes matriculados en esta materia podrán ver y responder el laboratorio.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-slate-900">Markdown del laboratorio</h2>
            <div className="flex gap-3 text-xs">
              <button type="button" className="text-brand-600 hover:underline" onClick={() => fileInputRef.current?.click()}>
                Subir .md
              </button>
              <button type="button" className="text-brand-600 hover:underline" onClick={() => setRaw(EXAMPLE_MARKDOWN)}>
                Cargar ejemplo
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".md,text/markdown" className="hidden" onChange={handleFileUpload} />
          </div>
          <TextArea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={20}
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
            <Button onClick={handleSave} disabled={!preview || !subjectId || saving} type="button">
              {saving ? "Guardando..." : "Guardar borrador"}
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
