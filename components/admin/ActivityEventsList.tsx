import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

interface ActivityEvent {
  id: string;
  type: string;
  detail: string | null;
  isPenalty: boolean;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  TAB_HIDDEN: "Cambio de pestaña",
  WINDOW_BLUR: "Pérdida de foco de ventana",
  FULLSCREEN_EXIT: "Salida de pantalla completa",
  HEARTBEAT: "Latido de conexión",
  RECONNECT: "Reconexión",
  OTHER: "Otro",
};

export function ActivityEventsList({ events }: { events: ActivityEvent[] }) {
  return (
    <Card>
      <h3 className="mb-1 font-medium text-slate-900">Alertas de supervisión</h3>
      <p className="mb-3 text-xs text-slate-500">
        Estos eventos son señales de mejor esfuerzo del navegador, no una prueba definitiva de fraude.
      </p>
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">No se registraron incidencias durante este intento.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-center justify-between border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
              <span>
                {TYPE_LABEL[ev.type] ?? ev.type}
                {ev.detail && <span className="text-slate-400"> — {ev.detail}</span>}
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-400">
                {ev.isPenalty && <Badge tone="yellow">penalidad</Badge>}
                {new Date(ev.createdAt).toLocaleString("es-BO")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
