"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { StudentLoginForm } from "@/components/student/StudentLoginForm";
import { StudentActivateForm } from "@/components/student/StudentActivateForm";

type Mode = "login" | "activate";

export default function StudentLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  function handleSuccess() {
    router.push("/student/laboratories");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-1 text-center text-2xl font-semibold text-slate-900">Laboratorios</h1>
      <p className="mb-6 text-center text-sm text-slate-500">Ingresa con tu cuenta de estudiante para ver tus laboratorios.</p>

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

        {mode === "login" ? <StudentLoginForm onSuccess={handleSuccess} /> : <StudentActivateForm onSuccess={handleSuccess} />}
      </Card>
    </div>
  );
}
