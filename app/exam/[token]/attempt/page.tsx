"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CountdownTimer } from "@/components/student/CountdownTimer";
import { PenaltyWarningBanner } from "@/components/student/PenaltyWarningBanner";
import { FinalizeExamDialog } from "@/components/student/FinalizeExamDialog";
import { ActivityMonitor } from "@/components/student/ActivityMonitor";
import { ScreenCaptureGate } from "@/components/student/ScreenCaptureGate";
import { QuestionList, type AnswerValue, type StudentQuestion } from "@/components/student/QuestionList";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

type Screen = "loading" | "exam" | "finished" | "locked" | "unauthorized";

const AUTOSAVE_DEBOUNCE_MS = 700;
const SAVE_RETRY_DELAYS_MS = [1000, 2000, 4000];
const BACKGROUND_RETRY_MS = 5000;

type SaveStatus = "idle" | "saving" | "saved" | "error";
type SaveOutcome = "ok" | "retry" | "fatal";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ExamAttemptPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("loading");
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  const [maxPenalties, setMaxPenalties] = useState(3);
  const [penaltyCount, setPenaltyCount] = useState(0);
  const [trackFocusEvents, setTrackFocusEvents] = useState(true);
  const [requireScreenCapture, setRequireScreenCapture] = useState(false);
  const [captureIntervalMinutes, setCaptureIntervalMinutes] = useState(1);
  const suppressFocusRef = useRef(false);
  const [reopened, setReopened] = useState(false);
  const [lastPenaltyMessage, setLastPenaltyMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Último valor de cada pregunta que todavía no llegó al servidor.
  const pendingValues = useRef<Record<string, AnswerValue>>({});
  // Un solo guardado en curso por pregunta: así un PUT viejo nunca pisa a uno nuevo.
  const inFlight = useRef<Record<string, Promise<SaveOutcome>>>({});
  const failedQuestions = useRef<Set<string>>(new Set());

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
        setRequireScreenCapture(Boolean(data.requireScreenCapture));
        setCaptureIntervalMinutes(data.screenCaptureIntervalMinutes ?? 1);
        setReopened(Boolean(data.reopened));
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

  const refreshSaveStatus = useCallback(() => {
    const busy = Object.keys(inFlight.current).length > 0 || Object.keys(pendingValues.current).length > 0;
    if (failedQuestions.current.size > 0) setSaveStatus("error");
    else setSaveStatus(busy ? "saving" : "saved");
  }, []);

  const putAnswer = useCallback(
    async (questionId: string, value: AnswerValue): Promise<SaveOutcome> => {
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(`/api/public/exams/${params.token}/answers/${questionId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(value),
          });
          if (res.ok) return "ok";
          // 401/404/409: el examen ya no acepta respuestas; reintentar no sirve.
          if (res.status === 401 || res.status === 404 || res.status === 409) return "fatal";
        } catch {
          // error de red: se reintenta
        }
        if (attempt >= SAVE_RETRY_DELAYS_MS.length) return "retry";
        await sleep(SAVE_RETRY_DELAYS_MS[attempt]);
      }
    },
    [params.token]
  );

  /** Envía el valor pendiente de una pregunta (y los que lleguen mientras tanto), en orden. */
  const flushQuestion = useCallback(
    (questionId: string): Promise<SaveOutcome> => {
      clearTimeout(debounceTimers.current[questionId]);
      delete debounceTimers.current[questionId];

      const existing = inFlight.current[questionId];
      if (existing) return existing;

      const run = (async (): Promise<SaveOutcome> => {
        let outcome: SaveOutcome = "ok";
        while (pendingValues.current[questionId] !== undefined) {
          const value = pendingValues.current[questionId];
          delete pendingValues.current[questionId];
          outcome = await putAnswer(questionId, value);
          if (outcome !== "ok") {
            // Conservar el valor (salvo que ya haya uno más nuevo) para reintentarlo.
            if (outcome === "retry" && pendingValues.current[questionId] === undefined) {
              pendingValues.current[questionId] = value;
            }
            break;
          }
        }
        if (outcome === "ok") failedQuestions.current.delete(questionId);
        else failedQuestions.current.add(questionId);
        return outcome;
      })();

      inFlight.current[questionId] = run;
      setSaveStatus("saving");
      run.finally(() => {
        delete inFlight.current[questionId];
        refreshSaveStatus();
      });
      return run;
    },
    [putAnswer, refreshSaveStatus]
  );

  /** Envía todo lo pendiente y espera a que termine. Devuelve true si todo quedó guardado. */
  const flushAll = useCallback(async (): Promise<boolean> => {
    const ids = new Set([
      ...Object.keys(pendingValues.current),
      ...Object.keys(debounceTimers.current),
      ...Object.keys(inFlight.current),
    ]);
    const outcomes = await Promise.all([...ids].map((id) => flushQuestion(id)));
    return outcomes.every((o) => o === "ok");
  }, [flushQuestion]);

  // Reintento en segundo plano de respuestas que no se pudieron guardar (p. ej. sin conexión).
  useEffect(() => {
    if (saveStatus !== "error") return;
    const timer = setTimeout(() => {
      for (const id of Object.keys(pendingValues.current)) flushQuestion(id);
    }, BACKGROUND_RETRY_MS);
    return () => clearTimeout(timer);
  }, [saveStatus, flushQuestion]);

  // Avisar si intenta cerrar la pestaña con respuestas sin guardar.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (Object.keys(pendingValues.current).length > 0 || Object.keys(inFlight.current).length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  function handleAnswerChange(questionId: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    pendingValues.current[questionId] = value;
    setSaveStatus("saving");
    clearTimeout(debounceTimers.current[questionId]);
    debounceTimers.current[questionId] = setTimeout(() => flushQuestion(questionId), AUTOSAVE_DEBOUNCE_MS);
  }

  /**
   * `force`: al vencer el tiempo se envía igual aunque algo no se haya podido
   * guardar; al finalizar manualmente se bloquea y se avisa al estudiante.
   */
  const submitExam = useCallback(
    async (force = false) => {
      setSubmitting(true);
      setSubmitError(null);
      try {
        const allSaved = await flushAll();
        if (!allSaved && !force) {
          setSubmitError("Algunas respuestas no se pudieron guardar. Revisa tu conexión y vuelve a intentar finalizar.");
          return;
        }
        let res: Response | null = null;
        for (let attempt = 0; attempt <= SAVE_RETRY_DELAYS_MS.length; attempt++) {
          res = await fetch(`/api/public/exams/${params.token}/submit`, { method: "POST" }).catch(() => null);
          if (res && (res.ok || res.status === 401 || res.status === 404)) break;
          if (attempt < SAVE_RETRY_DELAYS_MS.length) await sleep(SAVE_RETRY_DELAYS_MS[attempt]);
        }
        if (!res || !res.ok) {
          setSubmitError("No se pudo enviar el examen. Revisa tu conexión y vuelve a intentar.");
          return;
        }
        setConfirmOpen(false);
        setScreen("finished");
      } finally {
        setSubmitting(false);
      }
    },
    [flushAll, params.token]
  );

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
          <a
            href={`/exam/${params.token}/result`}
            className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            Consultar mi resultado
          </a>
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
      <ActivityMonitor
        token={params.token}
        enabled={trackFocusEvents}
        onResult={handleActivityResult}
        suppressRef={suppressFocusRef}
      />

      {deadline && <CountdownTimer deadline={deadline} onExpire={() => submitExam(true)} />}
      <PenaltyWarningBanner penaltyCount={penaltyCount} maxPenalties={maxPenalties} lastMessage={lastPenaltyMessage} />
      {reopened && (
        <div className="border-b border-blue-200 bg-blue-50 p-3 text-center text-sm text-blue-800">
          Tu docente reabrió este examen como segunda oportunidad. Tus incidencias anteriores quedan registradas y, si
          vuelves a alcanzar el máximo, el examen se cerrará nuevamente.
        </div>
      )}

      {requireScreenCapture ? (
        <ScreenCaptureGate
          token={params.token}
          suppressFocusRef={suppressFocusRef}
          onActivityResult={handleActivityResult}
          intervalMinutes={captureIntervalMinutes}
        >
          <div className="mx-auto max-w-4xl px-4 py-6">
            <QuestionList questions={questions} answers={answers} onChange={handleAnswerChange} />
          </div>
        </ScreenCaptureGate>
      ) : (
        <div className="mx-auto max-w-4xl px-4 py-6">
          <QuestionList questions={questions} answers={answers} onChange={handleAnswerChange} />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="text-sm">
            <p className="text-slate-500">
              {answeredCount} de {questions.length} preguntas respondidas
            </p>
            <SaveStatusLabel status={saveStatus} />
            {submitError && !confirmOpen && <p className="text-red-600">{submitError}</p>}
          </div>
          <Button onClick={() => setConfirmOpen(true)}>Finalizar examen</Button>
        </div>
      </div>

      <FinalizeExamDialog
        open={confirmOpen}
        answeredCount={answeredCount}
        totalCount={questions.length}
        onConfirm={() => submitExam(false)}
        onCancel={() => setConfirmOpen(false)}
        submitting={submitting}
        error={submitError}
      />
    </div>
  );
}

function SaveStatusLabel({ status }: { status: SaveStatus }) {
  if (status === "saving") return <p className="text-xs text-slate-400">Guardando respuestas...</p>;
  if (status === "saved") return <p className="text-xs text-emerald-600">Todas las respuestas guardadas</p>;
  if (status === "error")
    return <p className="text-xs font-medium text-red-600">Hay respuestas sin guardar (revisa tu conexión), reintentando...</p>;
  return null;
}
