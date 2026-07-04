"use client";

import { useEffect, useState } from "react";
import { AttemptGradingView } from "@/components/admin/AttemptGradingView";
import { Spinner } from "@/components/ui/Spinner";

export default function AttemptDetailPage({
  params,
}: {
  params: { examId: string; attemptId: string };
}) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/admin/exams/${params.examId}/attempts/${params.attemptId}`)
      .then((res) => res.json())
      .then(setData);
  }, [params.examId, params.attemptId]);

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> Cargando intento...
      </div>
    );
  }

  return (
    <AttemptGradingView examId={params.examId} attempt={data.attempt} questions={data.questions} />
  );
}
