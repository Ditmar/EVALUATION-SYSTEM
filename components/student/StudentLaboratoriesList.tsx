"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { studentFetch } from "@/lib/client/student-fetch";

interface LaboratorySummary {
  id: string;
  title: string;
  subject: { id: string; name: string };
  totalPoints: number;
  durationMinutes: number | null;
  submission: { id: string; status: "IN_PROGRESS" | "SUBMITTED" | "GRADED"; totalScore: number | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "En progreso",
  SUBMITTED: "Enviado",
  GRADED: "Calificado",
};

export function StudentLaboratoriesList() {
  const [laboratories, setLaboratories] = useState<LaboratorySummary[] | null>(null);

  useEffect(() => {
    studentFetch("/api/student/laboratories")
      .then((res) => res.json())
      .then((data) => setLaboratories(data.laboratories ?? []));
  }, []);

  if (laboratories === null) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> Cargando laboratorios...
      </div>
    );
  }

  if (laboratories.length === 0) {
    return <Card className="text-center text-sm text-slate-500">No hay laboratorios disponibles por el momento.</Card>;
  }

  return (
    <div className="space-y-3">
      {laboratories.map((lab) => (
        <Link key={lab.id} href={`/student/laboratories/${lab.id}`} className="block">
          <Card className="flex items-center justify-between transition hover:border-brand-300">
            <div>
              <h3 className="font-medium text-slate-900">{lab.title}</h3>
              <p className="text-sm text-slate-500">
                {lab.subject.name} · {lab.totalPoints} puntos
                {lab.durationMinutes ? ` · ${lab.durationMinutes} minutos` : ""}
              </p>
            </div>
            {lab.submission ? (
              <div className="text-right">
                <Badge tone={lab.submission.status === "IN_PROGRESS" ? "gray" : "green"}>
                  {STATUS_LABEL[lab.submission.status]}
                </Badge>
                {lab.submission.totalScore !== null && (
                  <p className="mt-1 text-sm text-slate-500">{lab.submission.totalScore} pts</p>
                )}
              </div>
            ) : (
              <Badge tone="blue">Nuevo</Badge>
            )}
          </Card>
        </Link>
      ))}
    </div>
  );
}
