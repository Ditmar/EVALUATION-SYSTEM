"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

interface LaboratorySummary {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  totalPoints: number;
  durationMinutes: number | null;
  subject: { id: string; name: string };
  questionCount: number;
  automaticCount: number;
  manualCount: number;
  aiCount: number;
  submissionCount: number;
}

const STATUS_LABEL: Record<LaboratorySummary["status"], string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
};

const STATUS_TONE: Record<LaboratorySummary["status"], "gray" | "green" | "yellow"> = {
  DRAFT: "gray",
  PUBLISHED: "green",
  ARCHIVED: "yellow",
};

export function LaboratoryList() {
  const [laboratories, setLaboratories] = useState<LaboratorySummary[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/laboratories")
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
    return (
      <Card className="text-center text-slate-500">
        Aún no has creado ningún laboratorio. Usa el botón &quot;Nuevo laboratorio&quot; para subir un archivo Markdown.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {laboratories.map((lab) => (
        <Link key={lab.id} href={`/admin/laboratories/${lab.id}`} className="block h-full">
          <Card className="card-interactive flex h-full flex-col">
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="font-medium leading-snug text-slate-900">{lab.title}</h3>
              <Badge tone={STATUS_TONE[lab.status]} className="shrink-0">
                {STATUS_LABEL[lab.status]}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              {lab.subject.name} · {lab.totalPoints} puntos
              {lab.durationMinutes ? ` · ${lab.durationMinutes} minutos` : ""}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {lab.questionCount} preguntas ({lab.automaticCount} automáticas · {lab.manualCount} manuales · {lab.aiCount} IA)
            </p>
            <div className="mt-4 flex flex-1 items-end">
              <Badge tone="gray">{lab.submissionCount} entregas</Badge>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
