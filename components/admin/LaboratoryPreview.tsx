import type { LaboratoryDefinition, LaboratoryParseWarning } from "@/lib/laboratory/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LaboratoryRenderer } from "@/components/laboratory/LaboratoryRenderer";

const EVALUATOR_LABEL: Record<string, string> = { automatic: "Automática", manual: "Manual", ai: "IA" };

export function LaboratoryPreview({ laboratory, warnings = [] }: { laboratory: LaboratoryDefinition; warnings?: LaboratoryParseWarning[] }) {
  const totalPoints = laboratory.questions.reduce((sum, q) => sum + q.points, 0);
  const automaticCount = laboratory.questions.filter((q) => q.evaluator === "automatic").length;
  const manualCount = laboratory.questions.filter((q) => q.evaluator === "manual").length;
  const aiCount = laboratory.questions.filter((q) => q.evaluator === "ai").length;

  return (
    <Card>
      <h3 className="mb-1 text-lg font-semibold text-slate-900">{laboratory.metadata.title}</h3>
      <p className="mb-3 text-xs text-slate-400">id: {laboratory.metadata.id} · versión {laboratory.metadata.version}</p>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone="blue">{laboratory.questions.length} preguntas</Badge>
        <Badge tone="blue">{totalPoints} puntos</Badge>
        {laboratory.metadata.duration && <Badge tone="gray">{laboratory.metadata.duration} minutos</Badge>}
        <Badge tone="gray">{automaticCount} automáticas</Badge>
        <Badge tone="gray">{manualCount} manuales</Badge>
        <Badge tone="gray">{aiCount} IA</Badge>
      </div>

      {warnings.length > 0 && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <ul className="list-inside list-disc space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-2 mt-6 text-sm font-medium text-slate-700">Vista previa</div>
      <div className="rounded-lg border border-slate-200 p-4">
        <LaboratoryRenderer
          content={laboratory.content}
          questions={laboratory.questions}
          answers={{}}
          repositories={laboratory.repositories}
          disabled
        />
      </div>

      <div className="mb-2 mt-6 text-sm font-medium text-slate-700">Preguntas ({laboratory.questions.length})</div>
      <ul className="space-y-2">
        {laboratory.questions.map((q) => (
          <li key={q.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
            <div>
              <span className="font-mono text-xs text-slate-400">{q.id}</span> · {q.type}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Badge tone="gray">{EVALUATOR_LABEL[q.evaluator]}</Badge>
              <span className="text-slate-500">{q.points} pts</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
