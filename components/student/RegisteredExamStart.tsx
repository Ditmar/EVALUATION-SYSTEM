"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { StudentLoginForm } from "@/components/student/StudentLoginForm";
import { StudentActivateForm } from "@/components/student/StudentActivateForm";

interface Metadata {
  title: string;
  career: string;
  academicTerm: string;
  subject: string;
  examDate: string;
  durationMinutes: number;
  instructions: string;
  evaluationType: string;
}

type Mode = "checking" | "confirm" | "starting" | "login" | "activate" | "error";

export function RegisteredExamStart({ token, metadata }: { token: string; metadata: Metadata }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("checking");
  const [error, setError] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // The tab/window monitoring (ActivityMonitor) only mounts on the attempt
  // page, so it only starts once this POST succeeds — everything before it
  // (login, activation, reading the warning below) happens with no
  // monitoring active yet.
  async function tryStart() {
    setMode("starting");
    setError(null);
    const res = await fetch(`/api/public/exams/${token}/start`, { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      router.push(data.redirectUrl);
      return;
    }

    if (res.status === 401) {
      setMode("login");
      return;
    }

    setError(data.error ?? "No se pudo iniciar el examen.");
    setMode("error");
  }

  async function checkSession() {
    const res = await fetch("/api/student/auth/me");
    setMode(res.ok ? "confirm" : "login");
  }

  useEffect(() => {
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="card p-6">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">{metadata.title}</h1>
        <p className="mb-4 text-sm text-slate-500">{metadata.evaluationType}</p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Carrera</dt>
          <dd>{metadata.career}</dd>
          <dt className="text-slate-500">Gestión</dt>
          <dd>{metadata.academicTerm}</dd>
          <dt className="text-slate-500">Materia</dt>
          <dd>{metadata.subject}</dd>
          <dt className="text-slate-500">Fecha</dt>
          <dd>{new Date(`${metadata.examDate}T00:00:00Z`).toLocaleDateString("es-BO", { timeZone: "UTC" })}</dd>
          <dt className="text-slate-500">Duración</dt>
          <dd>{metadata.durationMinutes} minutos</dd>
        </dl>

        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <p className="mb-1 font-medium">Instrucciones</p>
          <p className="whitespace-pre-wrap">{metadata.instructions}</p>
        </div>

        <div className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
          Este examen es solo para estudiantes registrados y matriculados en la materia correspondiente.
        </div>
      </div>

      {(mode === "checking" || mode === "starting") && (
        <Card>
          <div className="flex items-center gap-2 text-slate-500">
            <Spinner /> {mode === "checking" ? "Verificando sesión..." : "Iniciando examen..."}
          </div>
        </Card>
      )}

      {mode === "error" && (
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {(mode === "login" || mode === "activate") && (
        <Card>
          <div className="mb-4 flex gap-4 border-b border-slate-200 text-sm">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`-mb-px border-b-2 px-1 pb-2 ${
                mode === "login" ? "border-brand-600 font-medium text-brand-600" : "border-transparent text-slate-500"
              }`}
            >
              Ya tengo cuenta
            </button>
            <button
              type="button"
              onClick={() => setMode("activate")}
              className={`-mb-px border-b-2 px-1 pb-2 ${
                mode === "activate" ? "border-brand-600 font-medium text-brand-600" : "border-transparent text-slate-500"
              }`}
            >
              Primera vez / activar cuenta
            </button>
          </div>

          {mode === "login" ? (
            <StudentLoginForm onSuccess={() => setMode("confirm")} />
          ) : (
            <StudentActivateForm onSuccess={() => setMode("confirm")} />
          )}
        </Card>
      )}

      {mode === "confirm" && (
        <Card>
          <h2 className="mb-3 font-medium text-slate-900">Antes de comenzar</h2>
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            A partir de que hagas clic en &quot;Iniciar examen&quot;, este examen monitorea la
            actividad de la pestaña/ventana y la dirección IP observada como medida de
            supervisión. <strong>No minimices la ventana ni cambies de pestaña</strong> mientras
            rindes: hacerlo se registra como una incidencia y, si se repite, el examen puede
            bloquearse o enviarse automáticamente según la configuración del docente.
          </div>

          <label className="mb-4 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            Entiendo que este examen monitorea mi actividad de pestaña/ventana y mi dirección IP,
            y que no debo minimizar ni cambiar de pestaña una vez iniciado.
          </label>

          <Button onClick={tryStart} disabled={!acceptTerms} className="w-full">
            Iniciar examen
          </Button>
        </Card>
      )}
    </div>
  );
}
