"use client";

interface RunSummary {
  total: number;
  byStatus: Record<string, number>;
  last: { status: string; exitCode: number | null; stdout: string; stderr: string; compileOut: string | null; durationMs: number; createdAt: string | Date } | null;
}

const STATUS_LABEL: Record<string, string> = {
  ok: "correctas",
  runtime_error: "con error",
  compile_error: "error de compilación",
  timeout: "tiempo excedido",
  memory: "memoria excedida",
};

/** "12 ejecuciones · 9 correctas, 3 error de compilación" + the last run's output. */
export function IdeRunSummary({ summary }: { summary: RunSummary | null | undefined }) {
  if (!summary) return null;
  if (summary.total === 0) {
    return <p className="text-xs text-slate-500">El estudiante no ejecutó su código ninguna vez.</p>;
  }
  const breakdown = Object.entries(summary.byStatus)
    .map(([status, n]) => `${n} ${STATUS_LABEL[status] ?? status}`)
    .join(", ");

  return (
    <details className="rounded-lg border border-slate-200 p-3 text-sm">
      <summary className="cursor-pointer text-slate-700">
        <span className="font-medium">{summary.total} ejecuciones del estudiante</span>
        <span className="text-slate-500"> · {breakdown}</span>
      </summary>
      {summary.last && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-slate-500">
            Última: {STATUS_LABEL[summary.last.status] ?? summary.last.status} · exit {summary.last.exitCode ?? "-"} · {summary.last.durationMs} ms ·{" "}
            {new Date(summary.last.createdAt).toLocaleString()}
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-2 font-mono text-xs text-slate-100">
            {summary.last.compileOut && <span className="text-amber-300">{summary.last.compileOut}</span>}
            {summary.last.stdout || (summary.last.compileOut ? "" : "(sin salida)")}
            {summary.last.stderr && <span className="text-red-400">{summary.last.stderr}</span>}
          </pre>
        </div>
      )}
    </details>
  );
}
