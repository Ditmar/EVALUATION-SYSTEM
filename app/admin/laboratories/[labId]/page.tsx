"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { LaboratoryStatusControl } from "@/components/admin/LaboratoryStatusControl";
import { LaboratorySubmissionsTable } from "@/components/admin/LaboratorySubmissionsTable";

const STATUS_LABEL = { DRAFT: "Borrador", PUBLISHED: "Publicado", ARCHIVED: "Archivado" } as const;
const STATUS_TONE = { DRAFT: "gray", PUBLISHED: "green", ARCHIVED: "yellow" } as const;

interface LaboratoryDetail {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: number;
  totalPoints: number;
  durationMinutes: number | null;
  subject: { id: string; name: string };
}

export default function LaboratoryDetailPage({ params }: { params: { labId: string } }) {
  const [laboratory, setLaboratory] = useState<LaboratoryDetail | null>(null);
  const [role, setRole] = useState<"TEACHER" | "ASSISTANT" | null>(null);

  useEffect(() => {
    fetch(`/api/admin/laboratories/${params.labId}`)
      .then((res) => res.json())
      .then((data) => setLaboratory(data.laboratory));
    fetch("/api/admin/auth/me")
      .then((res) => res.json())
      .then((data) => setRole(data.role ?? null))
      .catch(() => setRole(null));
  }, [params.labId]);

  if (!laboratory) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> Cargando laboratorio...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{laboratory.title}</h1>
          <p className="text-sm text-slate-500">
            {laboratory.subject.name} · {laboratory.totalPoints} puntos
            {laboratory.durationMinutes ? ` · ${laboratory.durationMinutes} minutos` : ""} · versión {laboratory.version}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {role === "TEACHER" ? (
            <>
              <Link href={`/admin/laboratories/${laboratory.id}/edit`}>
                <Button variant="secondary">Editar</Button>
              </Link>
              <LaboratoryStatusControl laboratoryId={laboratory.id} initialStatus={laboratory.status} />
            </>
          ) : (
            <Badge tone={STATUS_TONE[laboratory.status]}>{STATUS_LABEL[laboratory.status]}</Badge>
          )}
        </div>
      </div>

      {laboratory.status !== "PUBLISHED" && (
        <Card className="text-sm text-amber-700">
          Este laboratorio aún no está publicado; los estudiantes matriculados en {laboratory.subject.name} no podrán verlo hasta que
          lo publiques.
        </Card>
      )}

      <div>
        <h2 className="mb-3 font-medium text-slate-900">Entregas de estudiantes</h2>
        <LaboratorySubmissionsTable laboratoryId={laboratory.id} />
      </div>
    </div>
  );
}
