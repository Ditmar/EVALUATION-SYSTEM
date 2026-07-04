import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

interface FinishedAttempt {
  id: string;
  nombres: string;
  apellidos: string;
  ci: string;
  status: string;
  penaltyCount: number;
  totalScore: number | null;
  pendingReview: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Enviado",
  EXPIRED: "Tiempo agotado",
  LOCKED: "Bloqueado",
};

export function FinishedAttemptsTable({ examId, attempts }: { examId: string; attempts: FinishedAttempt[] }) {
  return (
    <Card>
      <h3 className="mb-3 font-medium text-slate-900">Intentos finalizados ({attempts.length})</h3>
      {attempts.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay intentos finalizados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 pr-4">Estudiante</th>
                <th className="py-2 pr-4">CI</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Incidencias</th>
                <th className="py-2 pr-4">Puntaje</th>
                <th className="py-2 pr-4">Calificación</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="py-2 pr-4">
                    {a.nombres} {a.apellidos}
                  </td>
                  <td className="py-2 pr-4">{a.ci}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={a.status === "LOCKED" ? "red" : "gray"}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">{a.penaltyCount}</td>
                  <td className="py-2 pr-4">{a.totalScore ?? 0}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={a.pendingReview ? "yellow" : "green"}>
                      {a.pendingReview ? "Pendiente de calificación" : "Calificado"}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">
                    <Link href={`/admin/exams/${examId}/attempts/${a.id}`} className="text-brand-600 hover:underline">
                      Ver / calificar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
