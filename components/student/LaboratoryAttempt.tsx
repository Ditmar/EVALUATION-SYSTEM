"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LaboratoryRenderer } from "@/components/laboratory/LaboratoryRenderer";
import { AutosaveIndicator, type AutosaveState } from "@/components/laboratory/AutosaveIndicator";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { studentFetch } from "@/lib/client/student-fetch";
import type { AnswerValue } from "@/lib/laboratory/types";
import type { StudentSafeLaboratory } from "@/lib/laboratory/strip-answer-key";
import type { GithubAttemptSummary } from "@/components/laboratory/answers/types";

const AUTOSAVE_DEBOUNCE_MS = 800;

type Screen = "loading" | "ready" | "submitted" | "error";
type SubmissionStatus = "IN_PROGRESS" | "SUBMITTED" | "GRADED";

function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function LaboratoryAttempt({ labId }: { labId: string }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [error, setError] = useState<string | null>(null);
  const [laboratory, setLaboratory] = useState<StudentSafeLaboratory | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [status, setStatus] = useState<SubmissionStatus>("IN_PROGRESS");
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [autosave, setAutosave] = useState<AutosaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [githubAttempts, setGithubAttempts] = useState<Record<string, GithubAttemptSummary>>({});

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    studentFetch(`/api/student/laboratories/${labId}/submission`).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo cargar el laboratorio.");
        setScreen("error");
        return;
      }
      setLaboratory(data.laboratory);
      setAnswers(data.answers ?? {});
      setStatus(data.status);
      setTotalScore(data.totalScore);
      setGithubAttempts(data.githubAttempts ?? {});
      setScreen(data.status === "IN_PROGRESS" ? "ready" : "submitted");
    });
  }, [labId]);

  const saveAnswer = useCallback(
    async (questionId: string, value: AnswerValue) => {
      setAutosave("saving");
      try {
        const res = await studentFetch(`/api/student/laboratories/${labId}/submission/answers`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, value }),
        });
        setAutosave(res.ok ? "saved" : "error");
      } catch {
        setAutosave("error");
      }
    },
    [labId]
  );

  function handleAnswerChange(questionId: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    clearTimeout(debounceTimers.current[questionId]);
    debounceTimers.current[questionId] = setTimeout(() => saveAnswer(questionId, value), AUTOSAVE_DEBOUNCE_MS);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await studentFetch(`/api/student/laboratories/${labId}/submission`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus(data.submission.status);
        setTotalScore(data.submission.totalScore);
        setScreen("submitted");
      }
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  if (screen === "loading") {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> Cargando laboratorio...
      </div>
    );
  }

  if (screen === "error" || !laboratory) {
    return <p className="text-sm text-red-600">{error ?? "No se pudo cargar el laboratorio."}</p>;
  }

  const answeredCount = laboratory.questions.filter((q) => isAnswered(answers[q.id])).length;
  const totalPoints = laboratory.questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="space-y-6 pb-24">
      <Card>
        <h1 className="text-xl font-semibold text-slate-900">{laboratory.metadata.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {laboratory.metadata.duration ? `${laboratory.metadata.duration} minutos · ` : ""}
          {totalPoints} puntos
        </p>
      </Card>

      {screen === "submitted" && (
        <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
          {status === "GRADED"
            ? `Laboratorio enviado y calificado: ${totalScore ?? 0} de ${totalPoints} puntos.`
            : "Laboratorio enviado. Algunas preguntas quedan pendientes de revisión del docente."}
        </Card>
      )}

      <Card>
        <LaboratoryRenderer
          content={laboratory.content}
          questions={laboratory.questions}
          answers={answers}
          onAnswerChange={screen === "ready" ? handleAnswerChange : undefined}
          disabled={screen !== "ready"}
          labId={labId}
          repositories={laboratory.repositories}
          githubAttempts={githubAttempts}
        />
      </Card>

      {screen === "ready" && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-500">
                {answeredCount} de {laboratory.questions.length} preguntas respondidas
              </p>
              <AutosaveIndicator state={autosave} />
            </div>
            <Button onClick={() => setConfirmOpen(true)}>Enviar laboratorio</Button>
          </div>
        </div>
      )}

      <Modal
        open={confirmOpen}
        title="Confirmar envío del laboratorio"
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Enviando..." : "Sí, enviar"}
            </Button>
          </>
        }
      >
        <p>
          Has respondido {answeredCount} de {laboratory.questions.length} preguntas. Una vez enviado no podrás modificar tus
          respuestas. ¿Deseas continuar?
        </p>
      </Modal>
    </div>
  );
}
