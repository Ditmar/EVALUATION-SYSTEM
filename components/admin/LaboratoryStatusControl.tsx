"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

const STATUS_LABEL: Record<Status, string> = { DRAFT: "Borrador", PUBLISHED: "Publicado", ARCHIVED: "Archivado" };
const STATUS_TONE: Record<Status, "gray" | "green" | "yellow"> = { DRAFT: "gray", PUBLISHED: "green", ARCHIVED: "yellow" };

export function LaboratoryStatusControl({ laboratoryId, initialStatus }: { laboratoryId: string; initialStatus: Status }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function setNextStatus(next: Status) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/laboratories/${laboratoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next.toLowerCase() }),
      });
      if (!res.ok) {
        showToast("No se pudo actualizar el estado del laboratorio.", "error");
        return;
      }
      setStatus(next);
      showToast(`Laboratorio marcado como "${STATUS_LABEL[next]}".`, "success");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      {status !== "PUBLISHED" && (
        <Button onClick={() => setNextStatus("PUBLISHED")} disabled={loading}>
          Publicar
        </Button>
      )}
      {status === "PUBLISHED" && (
        <Button variant="secondary" onClick={() => setNextStatus("DRAFT")} disabled={loading}>
          Despublicar
        </Button>
      )}
      {status !== "ARCHIVED" && (
        <Button variant="secondary" onClick={() => setNextStatus("ARCHIVED")} disabled={loading}>
          Archivar
        </Button>
      )}
    </div>
  );
}
