"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export interface AiEvaluationRecord {
  id: string;
  suggestedScore: number;
  feedback: string;
  model: string;
  createdAt: string;
}

interface Props {
  labId: string;
  submissionId: string;
  questionId: string;
  maxPoints: number;
  aiEvaluations: AiEvaluationRecord[];
  onEvaluated: (evaluation: AiEvaluationRecord) => void;
  onUseScore: (score: number) => void;
}

export function LaboratoryAiSuggestion({ labId, submissionId, questionId, maxPoints, aiEvaluations, onEvaluated, onUseScore }: Props) {
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEvaluate() {
    setEvaluating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/laboratories/${labId}/submissions/${submissionId}/ai-evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "No se pudo obtener la evaluación con IA.");
        return;
      }

      onEvaluated(data.aiEvaluation);
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <div className="rounded-lg border border-brand-100 bg-brand-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-800">Evaluación con IA (sugerencia, no definitiva)</p>
        <Button variant="secondary" onClick={handleEvaluate} disabled={evaluating}>
          {evaluating ? "Evaluando..." : "Evaluar con IA"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {aiEvaluations.length > 0 && (
        <ul className="mt-3 space-y-2">
          {aiEvaluations.map((ev) => (
            <li key={ev.id} className="rounded bg-white p-2 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <Badge tone="blue">
                  Sugerido: {ev.suggestedScore}/{maxPoints}
                </Badge>
                <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => onUseScore(ev.suggestedScore)}>
                  Usar este puntaje
                </button>
              </div>
              <p className="text-slate-700">{ev.feedback}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
