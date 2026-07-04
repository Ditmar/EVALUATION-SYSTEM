"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CountdownTimer } from "@/components/student/CountdownTimer";
import { PenaltyWarningBanner } from "@/components/student/PenaltyWarningBanner";
import { FinalizeExamDialog } from "@/components/student/FinalizeExamDialog";
import { ActivityMonitor } from "@/components/student/ActivityMonitor";
import { QuestionList, type AnswerValue, type StudentQuestion } from "@/components/student/QuestionList";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

type Screen = "loading" | "exam" | "finished" | "locked" | "unauthorized";

const AUTOSAVE_DEBOUNCE_MS = 700;

export default function ExamAttemptPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("loading");
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  const [maxPenalties, setMaxPenalties] = useState(3);
  const [penaltyCount, setPenaltyCount] = useState(0);
  const [trackFocusEvents, setTrackFocusEvents] = useState(true);
  const [lastPenaltyMessage, setLastPenaltyMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    fetch(`/api/public/exams/${params.token}/attempt`)
      .then(async (res) => {
        if (res.status === 401) {
          router.replace(`/exam/${params.token}`);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.status !== "IN_PROGRESS") {
          setScreen(data.status === "LOCKED" ? "locked" : "finished");
          return;
        }
        setQuestions(data.questions);
        setMaxPenalties(data.maxPenalties);
        setPenaltyCount(data.penaltyCount);
        setTrackFocusEvents(data.trackFocusEvents);
        setDeadline(Date.now() + data.remainingMs);

        const initialAnswers: Record<string, AnswerValue> = {};
        for (const q of data.questions as (StudentQuestion & { currentAnswer: any })[]) {
          if (q.currentAnswer) {
            if (q.type === "SINGLE_CHOICE") {
              initialAnswers[q.questionId] = { selectedOption: q.currentAnswer.selectedOption };
            } else if (q.type === "MULTIPLE_CHOICE") {
              initialAnswers[q.questionId] = { selectedOptions: q.currentAnswer.selectedOptions ?? [] };
            } else {
              initialAnswers[q.questionId] = { codeAnswer: q.currentAnswer.codeAnswer ?? "" };
            }
          }
        }
        setAnswers(initialAnswers);
        setScreen("exam");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  const saveAnswer = useCallback(
    (questionId: string, value: AnswerValue) => {
      fetch(`/api/public/exams/${params.token}/answers/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      }).catch(() => {});
    },
    [params.token]
  );

  function handleAnswerChange(questionId: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    clearTimeout(debounceTimers.current[questionId]);
    debounceTimers.current[questionId] = setTimeout(() => saveAnswer(questionId, value), AUTOSAVE_DEBOUNCE_MS);
  }

  const submitExam = useCallback(async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/public/exams/${params.token}/submit`, { method: "POST" });
      setScreen("finished");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }, [params.token]);

  const handleActivityResult = useCallback(
    (result: { penaltyCount: number; remaining: number; action: string }) => {
      if (result.action === "none") return;
      setPenaltyCount(result.penaltyCount);
      if (result.action === "warn") {
        setLastPenaltyMessage("Se detectó actividad fuera del examen (cambio de pestaña o pérdida de foco).");
      } else if (result.action === "lock") {
        setLastPenaltyMessage("Se alcanzó el máximo de incidencias permitidas. El examen ha sido bloqueado.");
        setScreen("locked");
      } else if (result.action === "auto_submit") {
        setLastPenaltyMessage("Se alcanzó el máximo de incidencias permitidas. El examen fue enviado automáticamente.");
        setScreen("finished");
      }
    },
    []
  );

  const answeredCount = useMemo(
    () =>
      questions.filter((q) => {
        const a = answers[q.questionId];
        if (!a) return false;
        if ("selectedOption" in a) return Boolean(a.selectedOption);
        if ("selectedOptions" in a) return a.selectedOptions.length > 0;
        if ("codeAnswer" in a) return a.codeAnswer.trim().length > 0;
        return false;
      }).length,
    [questions, answers]
  );

  if (screen === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-slate-500">
        <Spinner /> Cargando examen...
      </div>
    );
  }

  if (screen === "finished") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Examen enviado</h1>
          <p className="mt-2 text-slate-500">
            Tus respuestas fueron registradas correctamente. Puedes cerrar esta ventana.
          </p>
        </div>
      </div>
    );
  }

  if (screen === "locked") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-xl font-semibold text-red-700">Examen bloqueado</h1>
          <p className="mt-2 text-slate-500">
            Tu examen fue bloqueado por alcanzar el máximo de incidencias de supervisión permitidas. Contacta
            a tu docente si consideras que esto es un error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <ActivityMonitor token={params.token} enabled={trackFocusEvents} onResult={handleActivityResult} />

      {deadline && <CountdownTimer deadline={deadline} onExpire={submitExam} />}
      <PenaltyWarningBanner penaltyCount={penaltyCount} maxPenalties={maxPenalties} lastMessage={lastPenaltyMessage} />

      <div className="mx-auto max-w-3xl px-4 py-6">
        <QuestionList questions={questions} answers={answers} onChange={handleAnswerChange} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <p className="text-sm text-slate-500">
            {answeredCount} de {questions.length} preguntas respondidas
          </p>
          <Button onClick={() => setConfirmOpen(true)}>Finalizar examen</Button>
        </div>
      </div>

      <FinalizeExamDialog
        open={confirmOpen}
        answeredCount={answeredCount}
        totalCount={questions.length}
        onConfirm={submitExam}
        onCancel={() => setConfirmOpen(false)}
        submitting={submitting}
      />
    </div>
  );
}
