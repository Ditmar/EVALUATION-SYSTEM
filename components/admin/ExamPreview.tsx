import type { ExamImportInput } from "@/lib/validation/exam-schema";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const TYPE_LABEL: Record<string, string> = {
  single_choice: "Opción única",
  multiple_choice: "Opción múltiple",
  code: "Código",
};

export function ExamPreview({ exam }: { exam: ExamImportInput }) {
  const totalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <Card>
      <h3 className="mb-3 text-lg font-semibold text-slate-900">{exam.metadata.title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">Carrera</dt>
        <dd>{exam.metadata.career}</dd>
        <dt className="text-slate-500">Gestión</dt>
        <dd>{exam.metadata.academicTerm}</dd>
        <dt className="text-slate-500">Materia</dt>
        <dd>{exam.metadata.subject}</dd>
        <dt className="text-slate-500">Fecha</dt>
        <dd>{exam.metadata.examDate}</dd>
        <dt className="text-slate-500">Duración</dt>
        <dd>{exam.metadata.durationMinutes} minutos</dd>
        <dt className="text-slate-500">Tipo</dt>
        <dd>{exam.metadata.evaluationType}</dd>
        <dt className="text-slate-500">Puntaje total</dt>
        <dd>{totalPoints} puntos</dd>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <Badge tone="blue">Máx. penalidades: {exam.settings.maxPenalties}</Badge>
        <Badge tone="blue">Al alcanzarlas: {exam.settings.onMaxPenalties}</Badge>
        <Badge tone={exam.settings.monitorExternalIps ? "yellow" : "gray"}>
          Monitoreo IP: {exam.settings.differentIpPolicy}
        </Badge>
        <Badge tone={exam.settings.allowAiCodeEvaluation ? "green" : "gray"}>
          IA para código: {exam.settings.allowAiCodeEvaluation ? "habilitada" : "deshabilitada"}
        </Badge>
      </div>

      <h4 className="mb-2 mt-6 text-sm font-medium text-slate-700">
        Preguntas ({exam.questions.length})
      </h4>
      <ul className="space-y-2">
        {exam.questions.map((q) => (
          <li key={q.id} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="mb-1 flex items-center justify-between">
              <Badge tone="gray">{TYPE_LABEL[q.type]}</Badge>
              <span className="text-slate-500">{q.points} pts</span>
            </div>
            <p className="text-slate-800">{q.statement}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
