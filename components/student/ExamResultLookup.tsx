"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface Option {
  id: string;
  text: string;
}

interface ResultQuestion {
  order: number;
  statement: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "CODE";
  points: number;
  earnedScore: number;
  isCorrect: boolean | null;
  options: Option[] | null;
  correctAnswer?: string | null;
  correctAnswers?: string[] | null;
  selectedOption: string | null;
  selectedOptions: string[] | null;
  codeAnswer?: string | null;
  teacherComment?: string | null;
}

interface GradedResult {
  status: "graded";
  student: { nombres: string; apellidos: string };
  exam: { title: string; subject: string };
  totalScore: number;
  maxScore: number;
  questions: ResultQuestion[];
}

type LookupResult = GradedResult | { status: "pending" | "in_progress" };

export function ExamResultLookup({ token }: { token: string }) {
  const [ci, setCi] = useState("");
  const [correo, setCorreo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/public/exams/${token}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ci, correo }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "No se pudo consultar el resultado.");
        setResult(null);
        return;
      }

      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  if (result?.status === "graded") {
    return <GradedResultView result={result} onBack={() => setResult(null)} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="card p-6">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">Consultar resultado</h1>
        <p className="text-sm text-slate-500">
          Ingresa los mismos datos que usaste para rendir el examen.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4 p-6">
        <div>
          <label className="label" htmlFor="ci">
            Carnet de identidad
          </label>
          <Input id="ci" required value={ci} onChange={(e) => setCi(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="correo">
            Correo electrónico
          </label>
          <Input
            id="correo"
            type="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result?.status === "pending" && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Tu examen todavía está siendo calificado por el docente. Intenta consultar más tarde.
          </p>
        )}

        {result?.status === "in_progress" && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Tu examen aún está en progreso.
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Consultando..." : "Consultar resultado"}
        </Button>
      </form>
    </div>
  );
}

function GradedResultView({ result, onBack }: { result: GradedResult; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{result.exam.title}</h1>
            <p className="text-sm text-slate-500">
              {result.exam.subject} · {result.student.nombres} {result.student.apellidos}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-slate-900">
              {result.totalScore} / {result.maxScore}
            </p>
            <p className="text-xs text-slate-500">Puntaje final</p>
          </div>
        </div>
      </Card>

      {result.questions.map((q) => (
        <Card key={q.order}>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium text-slate-900">Pregunta {q.order + 1}</p>
            <Badge tone={q.earnedScore >= q.points ? "green" : q.earnedScore > 0 ? "blue" : "red"}>
              {q.earnedScore} / {q.points} pts
            </Badge>
          </div>
          <p className="mb-3 whitespace-pre-wrap text-slate-700">{q.statement}</p>

          {q.type === "SINGLE_CHOICE" && q.options && (
            <ul className="space-y-1 text-sm">
              {q.options.map((opt) => {
                const isCorrectOption = opt.id === q.correctAnswer;
                const isSelected = opt.id === q.selectedOption;
                return (
                  <li
                    key={opt.id}
                    className={`rounded px-2 py-1 ${
                      isCorrectOption ? "bg-emerald-50" : isSelected ? "bg-red-50" : ""
                    }`}
                  >
                    {isSelected && "→ "}
                    {opt.text}
                    {isCorrectOption && <span className="ml-2 text-xs text-emerald-600">(correcta)</span>}
                  </li>
                );
              })}
            </ul>
          )}

          {q.type === "MULTIPLE_CHOICE" && q.options && (
            <ul className="space-y-1 text-sm">
              {q.options.map((opt) => {
                const isCorrectOption = (q.correctAnswers ?? []).includes(opt.id);
                const isSelected = (q.selectedOptions ?? []).includes(opt.id);
                return (
                  <li
                    key={opt.id}
                    className={`rounded px-2 py-1 ${
                      isCorrectOption ? "bg-emerald-50" : isSelected ? "bg-red-50" : ""
                    }`}
                  >
                    {isSelected && "→ "}
                    {opt.text}
                    {isCorrectOption && <span className="ml-2 text-xs text-emerald-600">(correcta)</span>}
                  </li>
                );
              })}
            </ul>
          )}

          {q.type === "CODE" && (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-slate-500">Tu respuesta</p>
                <pre className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">
                  {q.codeAnswer || "(sin respuesta)"}
                </pre>
              </div>
              {q.teacherComment && (
                <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
                  <p className="mb-1 font-medium">Comentario del docente</p>
                  <p className="whitespace-pre-wrap">{q.teacherComment}</p>
                </div>
              )}
            </div>
          )}
        </Card>
      ))}

      <Button variant="secondary" onClick={onBack}>
        Volver
      </Button>
    </div>
  );
}
