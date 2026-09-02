"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export interface AiEvaluationEvidence {
  file: string;
  line?: number;
  reason: string;
}

export interface AiEvaluationRecord {
  id: string;
  suggestedScore: number;
  feedback: string;
  evidence?: AiEvaluationEvidence[] | null;
  /** Model's self-reported 0..1 likelihood this answer was AI-generated — already factored into `suggestedScore`; a soft signal, not a verdict. */
  aiLikelihood?: number | null;
  model: string;
  createdAt: string;
}

function aiLikelihoodBadge(aiLikelihood: number): { tone: "red" | "yellow" | "gray"; label: string } {
  if (aiLikelihood >= 0.7) return { tone: "red", label: `Posible uso de IA: ${Math.round(aiLikelihood * 100)}%` };
  if (aiLikelihood >= 0.4) return { tone: "yellow", label: `Uso de IA incierto: ${Math.round(aiLikelihood * 100)}%` };
  return { tone: "gray", label: `Uso de IA improbable: ${Math.round(aiLikelihood * 100)}%` };
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
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge tone="blue">
                  Sugerido: {ev.suggestedScore}/{maxPoints}
                </Badge>
                {typeof ev.aiLikelihood === "number" && (
                  <Badge tone={aiLikelihoodBadge(ev.aiLikelihood).tone}>{aiLikelihoodBadge(ev.aiLikelihood).label}</Badge>
                )}
                <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => onUseScore(ev.suggestedScore)}>
                  Usar este puntaje
                </button>
              </div>
              <p className="text-slate-700">{ev.feedback}</p>
              {ev.evidence && ev.evidence.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
                  {ev.evidence.map((item, i) => (
                    <li key={i}>
                      <span className="font-mono text-slate-500">
                        {item.file}
                        {item.line !== undefined ? `:${item.line}` : ""}
                      </span>{" "}
                      — {item.reason}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
