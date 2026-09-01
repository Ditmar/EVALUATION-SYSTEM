"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { answerRegistry } from "@/components/laboratory/answers/registry";
import { LaboratoryAiSuggestion, type AiEvaluationRecord } from "@/components/admin/LaboratoryAiSuggestion";
import type { AnswerValue, GradingMap, LaboratoryDefinition, QuestionDefinition } from "@/lib/laboratory/types";

interface AiEvalWithQuestion extends AiEvaluationRecord {
  questionId: string;
}

interface SubmissionData {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
  answers: Record<string, AnswerValue>;
  grading: GradingMap;
  totalScore: number | null;
  student: { id: string; ci: string; nombres: string; apellidos: string };
  aiEvaluations: AiEvalWithQuestion[];
}

function formatExpectedAnswer(question: QuestionDefinition): string {
  switch (question.type) {
    case "text":
      return question.correct ?? "(sin respuesta de referencia)";
    case "number":
      return question.expected !== undefined ? `${question.expected} ± ${question.tolerance ?? 0}` : "(sin valor de referencia)";
    case "boolean":
      return question.correct === undefined ? "(sin respuesta de referencia)" : question.correct ? "Sí" : "No";
    case "single-choice":
    case "select":
      return question.correct ?? "(sin respuesta de referencia)";
    case "multiple-choice":
      return question.correct && question.correct.length > 0 ? question.correct.join(", ") : "(sin respuesta de referencia)";
    default:
      return "";
  }
}

export function LaboratoryGradingView({
  labId,
  definition,
  submission: initialSubmission,
}: {
  labId: string;
  definition: LaboratoryDefinition;
  submission: SubmissionData;
}) {
  const { showToast } = useToast();
  const [submission, setSubmission] = useState(initialSubmission);
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      definition.questions.map((q) => {
        const grading = initialSubmission.grading[q.id];
        const value = grading?.manualScore ?? grading?.finalScore;
        return [q.id, value !== undefined && value !== null ? String(value) : ""];
      })
    )
  );
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>(() =>
    Object.fromEntries(definition.questions.map((q) => [q.id, initialSubmission.grading[q.id]?.feedback ?? ""]))
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  async function handleSaveScore(question: QuestionDefinition) {
    const parsedScore = Number(scores[question.id]);
    if (Number.isNaN(parsedScore) || parsedScore < 0 || parsedScore > question.points) {
      showToast(`El puntaje debe estar entre 0 y ${question.points}.`, "error");
      return;
    }

    setSaving((prev) => ({ ...prev, [question.id]: true }));
    try {
      const res = await fetch(`/api/admin/laboratories/${labId}/submissions/${submission.id}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, manualScore: parsedScore, feedback: feedbacks[question.id] || null }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error ?? "No se pudo guardar el puntaje.", "error");
        return;
      }

      setSubmission((prev) => ({ ...prev, ...data.submission }));
      showToast("Puntaje guardado.", "success");
    } finally {
      setSaving((prev) => ({ ...prev, [question.id]: false }));
    }
  }

  function handleAiEvaluated(questionId: string, evaluation: AiEvaluationRecord) {
    setSubmission((prev) => ({ ...prev, aiEvaluations: [{ ...evaluation, questionId }, ...prev.aiEvaluations] }));
  }

  const totalMax = definition.questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-slate-900">
              {submission.student.nombres} {submission.student.apellidos}
            </h2>
            <p className="text-sm text-slate-500">CI {submission.student.ci}</p>
          </div>
          <div className="text-right">
            <Badge tone={submission.status === "GRADED" ? "green" : submission.status === "SUBMITTED" ? "yellow" : "gray"}>
              {submission.status}
            </Badge>
            <p className="mt-1 text-sm text-slate-500">
              Puntaje: {submission.totalScore ?? 0} / {totalMax}
            </p>
          </div>
        </div>
      </Card>

      {definition.questions.map((question, index) => {
        const AnswerComponent = answerRegistry[question.type];
        const grading = submission.grading[question.id];
        const aiEvaluations = submission.aiEvaluations.filter((e) => e.questionId === question.id);
        const rubric = definition.rubrics.find((r) => r.for === question.id)?.content;

        return (
          <Card key={question.id}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium text-slate-900">
                Pregunta {index + 1} ({question.points} pts)
              </p>
              <div className="flex items-center gap-2">
                <Badge tone="gray">{question.evaluator}</Badge>
                {grading && grading.status !== "pending_review" && (
                  <Badge tone={grading.status === "incorrect" ? "red" : "green"}>{grading.finalScore ?? 0} pts</Badge>
                )}
              </div>
            </div>

            {question.context && <p className="mb-3 text-sm text-slate-700">{question.context}</p>}

            <div className="mb-3">
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">Respuesta del estudiante</p>
              <AnswerComponent question={question} value={submission.answers[question.id]} onChange={() => {}} disabled />
            </div>

            {question.evaluator === "automatic" && (
              <p className="mb-3 text-xs text-slate-500">Respuesta esperada: {formatExpectedAnswer(question)}</p>
            )}

            {rubric && (
              <details className="mb-3 rounded-lg border border-slate-200 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-slate-700">Rúbrica (no visible para el estudiante)</summary>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">{rubric}</p>
              </details>
            )}

            {question.evaluator === "ai" && (
              <div className="mb-3">
                <LaboratoryAiSuggestion
                  labId={labId}
                  submissionId={submission.id}
                  questionId={question.id}
                  maxPoints={question.points}
                  aiEvaluations={aiEvaluations}
                  onEvaluated={(ev) => handleAiEvaluated(question.id, ev)}
                  onUseScore={(score) => setScores((prev) => ({ ...prev, [question.id]: String(score) }))}
                />
              </div>
            )}

            <div className="mb-3">
              <label className="label">Comentario para el estudiante (opcional)</label>
              <TextArea
                rows={3}
                value={feedbacks[question.id]}
                onChange={(e) => setFeedbacks((prev) => ({ ...prev, [question.id]: e.target.value }))}
              />
            </div>

            <div className="flex items-end gap-3">
              <div>
                <label className="label">Puntaje manual (máx. {question.points})</label>
                <Input
                  type="number"
                  min={0}
                  max={question.points}
                  value={scores[question.id]}
                  onChange={(e) => setScores((prev) => ({ ...prev, [question.id]: e.target.value }))}
                  className="w-32"
                />
              </div>
              <Button onClick={() => handleSaveScore(question)} disabled={saving[question.id]}>
                {saving[question.id] ? "Guardando..." : "Guardar puntaje"}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
