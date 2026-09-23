"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";

interface FinishedAttempt {
  id: string;
  nombres: string;
  apellidos: string;
  ci: string;
  status: string;
  penaltyCount: number;
  reopenCount: number;
  canReopen: boolean;
  suggestedReopenMinutes: number;
  totalScore: number | null;
  pendingReview: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Enviado",
  EXPIRED: "Tiempo agotado",
  LOCKED: "Bloqueado",
};

export function FinishedAttemptsTable({
  examId,
  attempts,
  onChanged,
}: {
  examId: string;
  attempts: FinishedAttempt[];
  onChanged?: () => void;
}) {
  const { showToast } = useToast();
  const [reopening, setReopening] = useState<FinishedAttempt | null>(null);
  const [minutes, setMinutes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function openReopenDialog(attempt: FinishedAttempt) {
    setReopening(attempt);
    setMinutes(String(attempt.suggestedReopenMinutes));
  }

  async function confirmReopen() {
    if (!reopening) return;
    const value = Number(minutes);
    if (!Number.isInteger(value) || value < 1 || value > 600) {
      showToast("Indica una cantidad de minutos entre 1 y 600.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/attempts/${reopening.id}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: value }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error ?? "No se pudo reabrir el examen.", "error");
        return;
      }
      showToast(`Examen reabierto para ${reopening.nombres} ${reopening.apellidos}.`, "success");
      setReopening(null);
      onChanged?.();
    } finally {
      setSubmitting(false);
    }
  }

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
                    <span className="flex flex-wrap items-center gap-1">
                      <Badge tone={a.status === "LOCKED" ? "red" : "gray"}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </Badge>
                      {a.canReopen && <Badge tone="red">Penalizado</Badge>}
                      {a.reopenCount > 0 && <Badge tone="blue">Reabierto</Badge>}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{a.penaltyCount}</td>
                  <td className="py-2 pr-4">{a.totalScore ?? 0}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={a.pendingReview ? "yellow" : "green"}>
                      {a.pendingReview ? "Pendiente de calificación" : "Calificado"}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">
                    <span className="flex flex-wrap items-center gap-3 whitespace-nowrap">
                      <Link href={`/admin/exams/${examId}/attempts/${a.id}`} className="text-brand-600 hover:underline">
                        Ver / calificar
                      </Link>
                      {a.canReopen && (
                        <button
                          type="button"
                          onClick={() => openReopenDialog(a)}
                          className="text-amber-700 hover:underline"
                        >
                          Reabrir
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={reopening !== null}
        title="Reabrir examen (segunda oportunidad)"
        onClose={() => !submitting && setReopening(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReopening(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={confirmReopen} disabled={submitting}>
              {submitting ? "Reabriendo..." : "Reabrir examen"}
            </Button>
          </>
        }
      >
        {reopening && (
          <div className="space-y-3">
            <p>
              <strong>
                {reopening.nombres} {reopening.apellidos}
              </strong>{" "}
              podrá volver a ingresar y continuar con sus respuestas guardadas.
            </p>
            <p className="text-slate-500">
              Sus {reopening.penaltyCount} incidencias se conservan en el historial. Desde ahora contará con un nuevo
              margen de incidencias; si vuelve a alcanzarlo, el examen se cerrará otra vez.
            </p>
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Tiempo disponible (minutos)</span>
              <Input
                type="number"
                min={1}
                max={600}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </label>
          </div>
        )}
      </Modal>
    </Card>
  );
}
