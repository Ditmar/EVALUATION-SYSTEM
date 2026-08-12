"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

type Mode = "checking" | "starting" | "login" | "activate" | "error";

export function RegisteredExamStart({ token, metadata }: { token: string; metadata: Metadata }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("checking");
  const [error, setError] = useState<string | null>(null);

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
    if (res.ok) {
      await tryStart();
    } else {
      setMode("login");
    }
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
            <StudentLoginForm onSuccess={tryStart} />
          ) : (
            <StudentActivateForm onSuccess={tryStart} />
          )}
        </Card>
      )}
    </div>
  );
}
