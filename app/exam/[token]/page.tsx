"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExamRegistrationForm } from "@/components/student/ExamRegistrationForm";
import { Spinner } from "@/components/ui/Spinner";

export default function ExamLandingPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "register" | "not-found">("loading");
  const [metadata, setMetadata] = useState<any>(null);

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

  return <ExamRegistrationForm token={params.token} metadata={metadata} />;
}
