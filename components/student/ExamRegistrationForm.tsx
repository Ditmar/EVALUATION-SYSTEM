"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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

export function ExamRegistrationForm({ token, metadata }: { token: string; metadata: Metadata }) {
  const router = useRouter();
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [ci, setCi] = useState("");
  const [correo, setCorreo] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!acceptTerms) {
      setError("Debe aceptar los términos y condiciones de evaluación para continuar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/public/exams/${token}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombres, apellidos, ci, correo, acceptTerms }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "No se pudo iniciar el examen.");
        return;
      }

      router.push(data.redirectUrl);
    } finally {
      setLoading(false);
    }
  }

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

        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Este examen monitorea la actividad de la pestaña/ventana y la dirección IP observada como
          medida de supervisión. Estas señales se registran como alertas de supervisión, no como prueba
          definitiva de fraude.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4 p-6">
        <h2 className="font-medium text-slate-900">Datos del estudiante</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="nombres">
              Nombres
            </label>
            <Input id="nombres" required value={nombres} onChange={(e) => setNombres(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="apellidos">
              Apellidos
            </label>
            <Input id="apellidos" required value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
          </div>
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
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
          />
          Acepto las condiciones de evaluación, incluyendo el monitoreo de actividad de la pestaña/ventana
          y de la dirección IP durante el examen. Entiendo que no podré modificar mis datos personales una
          vez iniciado el examen.
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Iniciando..." : "Iniciar examen"}
        </Button>
      </form>
    </div>
  );
}
