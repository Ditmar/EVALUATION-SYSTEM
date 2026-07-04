"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";

export function PublishToggle({ examId, initialPublished }: { examId: string; initialPublished: boolean }) {
  const [isPublished, setIsPublished] = useState(initialPublished);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !isPublished }),
      });
      if (!res.ok) {
        showToast("No se pudo actualizar el estado de publicación.", "error");
        return;
      }
      setIsPublished(!isPublished);
      showToast(!isPublished ? "Examen publicado." : "Examen despublicado.", "success");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Badge tone={isPublished ? "green" : "gray"}>{isPublished ? "Publicado" : "Borrador"}</Badge>
      <Button variant={isPublished ? "secondary" : "primary"} onClick={toggle} disabled={loading}>
        {isPublished ? "Despublicar" : "Publicar"}
      </Button>
    </div>
  );
}
