"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExamRegistrationForm } from "@/components/student/ExamRegistrationForm";
import { RegisteredExamStart } from "@/components/student/RegisteredExamStart";
import { Spinner } from "@/components/ui/Spinner";

export default function ExamLandingPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "register" | "not-found">("loading");
  const [metadata, setMetadata] = useState<any>(null);
  const [requireScreenCapture, setRequireScreenCapture] = useState(false);
  const [captureIntervalMinutes, setCaptureIntervalMinutes] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // If a valid attempt cookie already exists for this exam, skip straight
      // to the questions screen instead of showing the registration form again.
      const attemptRes = await fetch(`/api/public/exams/${params.token}/attempt`);
      if (cancelled) return;
      if (attemptRes.ok) {
        router.replace(`/exam/${params.token}/attempt`);
        return;
      }

      const metaRes = await fetch(`/api/public/exams/${params.token}`);
      if (cancelled) return;
      if (!metaRes.ok) {
        setState("not-found");
        return;
      }
      const data = await metaRes.json();
      setMetadata(data.metadata);
      setRequireScreenCapture(Boolean(data.settings?.requireScreenCapture));
      setCaptureIntervalMinutes(data.settings?.screenCaptureIntervalMinutes ?? 1);
      setState("register");
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [params.token, router]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-slate-500">
        <Spinner /> Cargando examen...
      </div>
    );
  }

  if (state === "not-found") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Examen no disponible</h1>
          <p className="mt-2 text-slate-500">
            El enlace no es válido o el examen aún no ha sido publicado por el docente.
          </p>
        </div>
      </div>
    );
  }

  const form =
    metadata.accessMode === "REGISTERED" ? (
      <RegisteredExamStart token={params.token} metadata={metadata} />
    ) : (
      <ExamRegistrationForm token={params.token} metadata={metadata} />
    );

  if (!requireScreenCapture) return form;

  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
        Este examen requiere <strong>compartir tu pantalla completa</strong> y guarda una captura{" "}
        {captureIntervalMinutes === 1 ? "cada minuto" : `cada ${captureIntervalMinutes} minutos`}. Ríndelo
        desde una computadora con Chrome, Edge o Firefox (no funciona en celulares).
      </div>
      {form}
    </>
  );
}
