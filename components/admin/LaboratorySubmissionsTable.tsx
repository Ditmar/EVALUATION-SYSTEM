"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

interface Submission {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
  totalScore: number | null;
  submittedAt: string | null;
  student: { id: string; ci: string; nombres: string; apellidos: string };
}

const STATUS_LABEL: Record<Submission["status"], string> = {
  IN_PROGRESS: "En progreso",
  SUBMITTED: "Enviado",
  GRADED: "Calificado",
};

const STATUS_TONE: Record<Submission["status"], "gray" | "yellow" | "green"> = {
  IN_PROGRESS: "gray",
  SUBMITTED: "yellow",
  GRADED: "green",
};

export function LaboratorySubmissionsTable({ laboratoryId }: { laboratoryId: string }) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);

  useEffect(() => {
    fetch(`/api/admin/laboratories/${laboratoryId}/submissions`)
      .then((res) => res.json())
      .then((data) => setSubmissions(data.submissions ?? []));
  }, [laboratoryId]);

  if (submissions === null) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> Cargando entregas...
      </div>
    );
  }

  if (submissions.length === 0) {
    return <Card className="text-center text-sm text-slate-500">Todavía no hay estudiantes trabajando en este laboratorio.</Card>;
  }

  return (
    <div className="space-y-2">
      {submissions.map((s) => (
        <Link key={s.id} href={`/admin/laboratories/${laboratoryId}/submissions/${s.id}`} className="block">
          <Card className="flex items-center justify-between transition hover:border-brand-300">
            <div>
              <p className="font-medium text-slate-900">
                {s.student.nombres} {s.student.apellidos}
              </p>
              <p className="text-sm text-slate-500">CI {s.student.ci}</p>
            </div>
            <div className="flex items-center gap-3">
              {s.totalScore !== null && <span className="text-sm text-slate-500">{s.totalScore} pts</span>}
              <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
