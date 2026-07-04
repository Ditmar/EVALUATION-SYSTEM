"use client";

import { useState } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";

interface AiEvaluation {
  id: string;
  suggestedScore: number;
  feedback: string;
  model: string;
  createdAt: string;
}

interface Props {
  examId: string;
  attemptId: string;
  questionId: string;
  answerId: string | null;
  language: string;
  studentCode: string;
  expectedSolution: string | null;
  rubric: string | null;
  maxPoints: number;
  manualScore: number | null;
  teacherComment: string | null;
  enableAiEvaluation: boolean;
  aiEvaluations: AiEvaluation[];
  onGraded: (
    questionId: string,
    answer: { id: string; manualScore: number; teacherComment: string | null }
  ) => void;
}

export function CodeAnswerGrader({
  examId,
  attemptId,
  questionId,
  answerId,
  language,
  studentCode,
  expectedSolution,
  rubric,
  maxPoints,
  manualScore,
  teacherComment,
  enableAiEvaluation,
  aiEvaluations: initialAiEvaluations,
  onGraded,
}: Props) {
  const { showToast } = useToast();
  const [score, setScore] = useState(manualScore?.toString() ?? "");
  const [comment, setComment] = useState(teacherComment ?? "");
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [aiEvaluations, setAiEvaluations] = useState(initialAiEvaluations);

  async function handleSaveScore() {
    const parsedScore = Number(score);
    if (Number.isNaN(parsedScore) || parsedScore < 0 || parsedScore > maxPoints) {
      showToast(`El puntaje debe estar entre 0 y ${maxPoints}.`, "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/attempts/${attemptId}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, manualScore: parsedScore, teacherComment: comment }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error ?? "No se pudo guardar el puntaje.", "error");
        return;
      }

      onGraded(questionId, {
        id: data.answer.id,
        manualScore: parsedScore,
        teacherComment: comment || null,
      });
      showToast("Puntaje guardado.", "success");
    } finally {
      setSaving(false);
    }
  }

  async function handleAiEvaluate() {
    if (!answerId) return;
    setEvaluating(true);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/answers/${answerId}/ai-evaluate`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error ?? "No se pudo obtener la evaluación con IA.", "error");
        return;
      }

      setAiEvaluations((prev) => [data.aiEvaluation, ...prev]);
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-medium uppercase text-slate-500">Respuesta del estudiante</p>
        <CodeEditor value={studentCode || "// (sin respuesta)"} language={language} readOnly height="220px" />
      </div>

      {(expectedSolution || rubric) && (
        <details className="rounded-lg border border-slate-200 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">Solución esperada y rúbrica</summary>
          {expectedSolution && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">Solución esperada</p>
              <pre className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{expectedSolution}</pre>
            </div>
          )}
          {rubric && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">Rúbrica</p>
              <p className="text-slate-700">{rubric}</p>
            </div>
          )}
        </details>
      )}

      {enableAiEvaluation && (
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-brand-800">Evaluación con IA (sugerencia, no definitiva)</p>
            <Button variant="secondary" onClick={handleAiEvaluate} disabled={evaluating || !answerId}>
              {evaluating ? "Evaluando..." : "Evaluar con IA"}
            </Button>
          </div>
          {aiEvaluations.length > 0 && (
            <ul className="mt-3 space-y-2">
              {aiEvaluations.map((ev) => (
                <li key={ev.id} className="rounded bg-white p-2 text-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone="blue">Sugerido: {ev.suggestedScore}/{maxPoints}</Badge>
                    <button
                      type="button"
                      className="text-xs text-brand-600 hover:underline"
                      onClick={() => setScore(String(ev.suggestedScore))}
                    >
                      Usar este puntaje
                    </button>
                  </div>
                  <p className="text-slate-700">{ev.feedback}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <label className="label">Comentario para el estudiante (opcional)</label>
        <TextArea
          rows={3}
          placeholder="Explica en qué se equivocó el estudiante o qué podría mejorar..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          Este comentario será visible para el estudiante junto con su resultado.
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <label className="label">Puntaje manual (máx. {maxPoints})</label>
          <Input
            type="number"
            min={0}
            max={maxPoints}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-32"
          />
        </div>
        <Button onClick={handleSaveScore} disabled={saving}>
          {saving ? "Guardando..." : "Guardar puntaje"}
        </Button>
      </div>
    </div>
  );
}
