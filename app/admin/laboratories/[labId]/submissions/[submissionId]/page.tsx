"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { LaboratoryGradingView } from "@/components/admin/LaboratoryGradingView";

export default function LaboratorySubmissionPage({ params }: { params: { labId: string; submissionId: string } }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/laboratories/${params.labId}/submissions/${params.submissionId}`)
      .then((res) => res.json())
      .then((json) => (json.error ? setError(json.error) : setData(json)));
  }, [params.labId, params.submissionId]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> Cargando entrega...
      </div>
    );
  }

  return <LaboratoryGradingView labId={params.labId} definition={data.definition} submission={data.submission} />;
}
