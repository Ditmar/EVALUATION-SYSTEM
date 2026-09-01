"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { LaboratoryEditForm } from "@/components/admin/LaboratoryEditForm";

interface LaboratoryDetail {
  id: string;
  title: string;
  markdownSource: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export default function EditLaboratoryPage({ params }: { params: { labId: string } }) {
  const [laboratory, setLaboratory] = useState<LaboratoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/laboratories/${params.labId}`)
      .then((res) => res.json())
      .then((data) => (data.error ? setError(data.error) : setLaboratory(data.laboratory)));
  }, [params.labId]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!laboratory) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> Cargando laboratorio...
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Editar: {laboratory.title}</h1>
      <LaboratoryEditForm labId={laboratory.id} initialMarkdown={laboratory.markdownSource} status={laboratory.status} />
    </div>
  );
}
