"use client";

import { useCallback, useEffect, useState } from "react";
import { LiveAttemptsPanel } from "@/components/admin/LiveAttemptsPanel";
import { FinishedAttemptsTable } from "@/components/admin/FinishedAttemptsTable";
import { Spinner } from "@/components/ui/Spinner";

interface AttemptsData {
  live: any[];
  finished: any[];
  predominantIp: string | null;
}

export function ExamMonitoringSection({ examId }: { examId: string }) {
  const [data, setData] = useState<AttemptsData | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/exams/${examId}/attempts`);
    if (res.ok) setData(await res.json());
  }, [examId]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) load();
    };

    tick();
    const interval = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [load]);

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> Cargando estado del examen...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LiveAttemptsPanel attempts={data.live} predominantIp={data.predominantIp} />
      <FinishedAttemptsTable examId={examId} attempts={data.finished} onChanged={load} />
    </div>
  );
}
