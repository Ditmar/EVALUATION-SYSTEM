"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { IpAlertBanner } from "@/components/admin/IpAlertBanner";

interface LiveAttempt {
  id: string;
  nombres: string;
  apellidos: string;
  ci: string;
  correo: string;
  expiresAt: string;
  observedIp: string | null;
  penaltyCount: number;
  differentIp: boolean;
}

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Vencido";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function LiveAttemptsPanel({ attempts, predominantIp }: { attempts: LiveAttempt[]; predominantIp: string | null }) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <IpAlertBanner attempts={attempts} />
      <Card>
        <h3 className="mb-3 font-medium text-slate-900">
          Estudiantes rindiendo ahora ({attempts.length})
          {predominantIp && (
            <span className="ml-2 text-xs font-normal text-slate-500">IP predominante: {predominantIp}</span>
          )}
        </h3>
        {attempts.length === 0 ? (
          <p className="text-sm text-slate-500">No hay estudiantes rindiendo el examen en este momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Estudiante</th>
                  <th className="py-2 pr-4">CI</th>
                  <th className="py-2 pr-4">Tiempo restante</th>
                  <th className="py-2 pr-4">IP</th>
                  <th className="py-2 pr-4">Incidencias</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="py-2 pr-4">
                      {a.nombres} {a.apellidos}
                    </td>
                    <td className="py-2 pr-4">{a.ci}</td>
                    <td className="py-2 pr-4 font-mono">{formatRemaining(a.expiresAt)}</td>
                    <td className="py-2 pr-4">
                      <span className={a.differentIp ? "font-medium text-amber-700" : ""}>
                        {a.observedIp ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {a.penaltyCount > 0 ? <Badge tone="yellow">{a.penaltyCount}</Badge> : "0"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
