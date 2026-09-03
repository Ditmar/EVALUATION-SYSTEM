"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LaboratoryList } from "@/components/admin/LaboratoryList";
import { Button } from "@/components/ui/Button";

export default function AdminLaboratoriesPage() {
  const [role, setRole] = useState<"TEACHER" | "ASSISTANT" | null>(null);

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((res) => res.json())
      .then((data) => setRole(data.role ?? null))
      .catch(() => setRole(null));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">
          {role === "ASSISTANT" ? "Laboratorios asignados" : "Mis laboratorios"}
        </h1>
        {role === "TEACHER" && (
          <Link href="/admin/laboratories/new">
            <Button>+ Nuevo laboratorio</Button>
          </Link>
        )}
      </div>
      <LaboratoryList />
    </div>
  );
}
