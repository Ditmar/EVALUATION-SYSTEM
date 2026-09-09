"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

const STATUS_LABEL: Record<Status, string> = { DRAFT: "Borrador", PUBLISHED: "Publicado", ARCHIVED: "Archivado" };
const STATUS_TONE: Record<Status, "gray" | "green" | "yellow"> = { DRAFT: "gray", PUBLISHED: "green", ARCHIVED: "yellow" };

/** Status transitions + delete for an existing article — separate from `ArticleEditorForm`'s own save/publish flow, which only ever moves DRAFT → PUBLISHED. */
export function ArticleStatusBar({ articleId, slug, status }: { articleId: string; slug: string; status: Status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: Status) {
    setBusy(true);
    try {
      await fetch(`/api/admin/articles/${articleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este artículo permanentemente? Esta acción no se puede deshacer.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/articles/${articleId}`, { method: "DELETE" });
      if (res.ok) router.push("/admin/articles");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      {status === "PUBLISHED" && (
        <a href={`/home/${slug}`} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">
          Ver publicado
        </a>
      )}
      <div className="ml-auto flex gap-2">
        {status !== "ARCHIVED" && (
          <Button variant="secondary" type="button" disabled={busy} onClick={() => setStatus("ARCHIVED")}>
            Archivar
          </Button>
        )}
        {status !== "DRAFT" && (
          <Button variant="secondary" type="button" disabled={busy} onClick={() => setStatus("DRAFT")}>
            Volver a borrador
          </Button>
        )}
        <Button variant="danger" type="button" disabled={busy} onClick={handleDelete}>
          Eliminar
        </Button>
      </div>
    </div>
  );
}
