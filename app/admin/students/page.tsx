"use client";

import { useState } from "react";
import { StudentImportForm } from "@/components/admin/StudentImportForm";
import { StudentDirectory } from "@/components/admin/StudentDirectory";

type Tab = "list" | "import";

const TABS: { id: Tab; label: string }[] = [
  { id: "list", label: "Listado de estudiantes" },
  { id: "import", label: "Importar JSON" },
];

export default function StudentsPage() {
  const [tab, setTab] = useState<Tab>("list");

  return (
    <div className="mx-auto max-w-5xl">
      <nav className="mb-2 text-sm text-slate-500" aria-label="Breadcrumb">
        <span>Estudiantes</span>
        <span className="mx-2">/</span>
        <span className="text-slate-700">{TABS.find((t) => t.id === tab)?.label}</span>
      </nav>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Estudiantes</h1>

      <div className="mb-6 flex gap-4 border-b border-slate-200 text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-1 pb-2 ${
              tab === t.id ? "border-brand-600 font-medium text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "list" ? <StudentDirectory /> : <StudentImportForm />}
    </div>
  );
}
