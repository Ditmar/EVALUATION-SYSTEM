"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ExamImportSchema, type ExamImportInput } from "@/lib/validation/exam-schema";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { ExamPreview } from "@/components/admin/ExamPreview";

interface Subject {
  id: string;
  name: string;
}

const EXAMPLE_JSON = `{
  "metadata": {
    "title": "Primer Parcial de Programación II",
    "career": "Ingeniería de Sistemas",
    "academicTerm": "Gestión 2026",
    "subject": "Programación II",
    "examDate": "2026-07-10",
    "durationMinutes": 90,
    "instructions": "Lea cuidadosamente cada pregunta antes de responder.",
    "evaluationType": "Examen parcial"
  },
  "settings": {
    "maxPenalties": 3,
    "onMaxPenalties": "auto_submit",
    "trackFocusEvents": true,
    "monitorExternalIps": true,
    "differentIpPolicy": "warn_only",
    "allowAiCodeEvaluation": true
  },
  "questions": [
    {
      "id": "q1",
      "type": "single_choice",
      "statement": "¿Cuál es la complejidad temporal de una búsqueda binaria?",
      "points": 10,
      "options": [
        { "id": "a", "text": "O(n)" },
        { "id": "b", "text": "O(log n)" },
        { "id": "c", "text": "O(n²)" },
        { "id": "d", "text": "O(1)" }
      ],
      "correctAnswer": "b"
    },
    {
      "id": "q2",
      "type": "multiple_choice",
      "statement": "Seleccione las estructuras de datos lineales.",
      "points": 15,
      "options": [
        { "id": "a", "text": "Pila" },
        { "id": "b", "text": "Cola" },
        { "id": "c", "text": "Árbol binario" },
        { "id": "d", "text": "Lista enlazada" }
      ],
      "correctAnswers": ["a", "b", "d"]
    },
    {
      "id": "q3",
      "type": "code",
      "statement": "Implemente una función recursiva para calcular el factorial de un número.",
      "points": 25,
      "language": "javascript",
      "expectedSolution": "function factorial(n) { ... }",
      "rubric": "Debe usar recursividad, manejar el caso base y devolver el valor correcto.",
      "enableAiEvaluation": true
    },
    {
      "id": "q4",
      "type": "code",
      "statement": "Explique con sus palabras la diferencia entre una pila (stack) y una cola (queue), dando un ejemplo de uso de cada una.",
      "points": 10,
      "language": "markdown",
      "expectedSolution": "Una pila es LIFO (último en entrar, primero en salir)... Una cola es FIFO (primero en entrar, primero en salir)...",
      "rubric": "El campo \\"language\\" de una pregunta de tipo \\"code\\" no está limitado a lenguajes de programación (acepta cualquier texto, ej. \\"javascript\\", \\"python\\", \\"bash\\", \\"markdown\\") — úsalo para respuestas escritas/teóricas largas cuando una opción múltiple no alcance.",
      "enableAiEvaluation": true
    }
  ]
}`;

export function ExamImportForm() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<ExamImportInput | null>(null);
  const [saving, setSaving] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [accessMode, setAccessMode] = useState<"OPEN" | "REGISTERED">("OPEN");

  useEffect(() => {
    fetch("/api/admin/subjects")
      .then((res) => res.json())
      .then((data) => setSubjects(data.subjects ?? []));
  }, []);

  async function handleCreateSubject() {
    if (!newSubjectName.trim()) return;
    setCreatingSubject(true);
    try {
      const res = await fetch("/api/admin/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSubjectName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors([data.error ?? "No se pudo crear la materia."]);
        return;
      }
      setSubjects((prev) => [...prev, data.subject]);
      setSubjectId(data.subject.id);
      setNewSubjectName("");
    } finally {
      setCreatingSubject(false);
    }
  }

  function handleValidate() {
    setErrors([]);
    setPreview(null);

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      setErrors([`El texto no es un JSON válido: ${(e as Error).message}`]);
      return;
    }

    const parsed = ExamImportSchema.safeParse(json);
    if (!parsed.success) {
      setErrors(formatZodIssues(parsed.error));
      return;
    }

    setPreview(parsed.data);
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    setErrors([]);

    try {
      const res = await fetch("/api/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...preview, subjectId, accessMode }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrors([data.error ?? "No se pudo guardar el examen."]);
        return;
      }

      router.push(`/admin/exams/${data.exam.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 font-medium text-slate-900">Materia y modo de acceso</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Materia</label>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Selecciona una materia...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <div className="mt-2 flex gap-2">
              <input
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="+ crear materia nueva"
                className="input flex-1 text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleCreateSubject}
                disabled={creatingSubject || !newSubjectName.trim()}
              >
                {creatingSubject ? "..." : "Crear"}
              </Button>
            </div>
          </div>
          <div>
            <label className="label">Modo de acceso</label>
            <Select value={accessMode} onChange={(e) => setAccessMode(e.target.value as "OPEN" | "REGISTERED")}>
              <option value="OPEN">Abierto (enlace público, sin registro)</option>
              <option value="REGISTERED">Registrado (solo estudiantes matriculados en la materia)</option>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-slate-900">Pegar JSON del examen</h2>
          <button
            type="button"
            className="text-xs text-brand-600 hover:underline"
            onClick={() => setRaw(EXAMPLE_JSON)}
          >
            Cargar ejemplo
          </button>
        </div>
        <TextArea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={20}
          className="font-mono text-xs"
          placeholder="Pega aquí el JSON del examen..."
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
          <Button onClick={handleSave} disabled={!preview || !subjectId || saving} type="button">
            {saving ? "Guardando..." : "Guardar examen"}
          </Button>
        </div>
      </Card>

      <div>
        {preview ? (
          <ExamPreview exam={preview} />
        ) : (
          <Card className="text-sm text-slate-500">
            La vista previa aparecerá aquí después de validar el JSON.
          </Card>
        )}
      </div>
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
