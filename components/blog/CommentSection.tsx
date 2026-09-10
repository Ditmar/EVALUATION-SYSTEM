"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/blog/Avatar";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";

interface Comment {
  id: string;
  content: string;
  authorName: string;
  authorType: "STUDENT" | "STAFF";
  createdAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Reads comments are public; posting requires a `Student` or staff (`User`)
 * session — `canComment`/`commenterName` come from the server component
 * (`getStudentSessionForPage` / `getAdminSessionForPage`), since only the
 * server can read the httpOnly session cookies.
 */
export function CommentSection({ slug, canComment, commenterName }: { slug: string; canComment: boolean; commenterName?: string }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/articles/${slug}/comments`)
      .then((res) => res.json())
      .then((data) => setComments(data.comments ?? []))
      .catch(() => setComments([]));
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/articles/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo publicar el comentario.");
        return;
      }
      setComments((prev) => [data.comment, ...(prev ?? [])]);
      setContent("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-12 border-t border-slate-200 pt-8 sm:mt-16 sm:pt-10">
      <h2 className="mb-6 text-lg font-bold text-slate-900 sm:text-xl">
        Comentarios{comments && comments.length > 0 ? ` (${comments.length})` : ""}
      </h2>

      {canComment ? (
        <form onSubmit={handleSubmit} className="mb-8 flex gap-3">
          <Avatar name={commenterName ?? "?"} size="sm" />
          <div className="flex-1">
            <TextArea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Escribe un comentario..."
              maxLength={2000}
              className="text-base"
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            <div className="mt-2 flex justify-end">
              <Button type="submit" disabled={submitting || !content.trim()}>
                {submitting ? "Publicando..." : "Comentar"}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <p className="mb-8 rounded-lg bg-slate-50 p-4 text-base text-slate-600">
          Inicia sesión como{" "}
          <Link href="/student/login" className="font-medium text-brand-700 underline">
            estudiante
          </Link>{" "}
          o{" "}
          <Link href="/admin/login" className="font-medium text-brand-700 underline">
            docente
          </Link>{" "}
          para comentar.
        </p>
      )}

      {comments === null ? (
        <p className="text-base text-slate-400">Cargando comentarios...</p>
      ) : comments.length === 0 ? (
        <p className="text-base text-slate-400">Sé el primero en comentar.</p>
      ) : (
        <ul className="space-y-6">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.authorName} size="sm" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-slate-900">{c.authorName}</span>
                  {c.authorType === "STAFF" && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Docente</span>
                  )}
                  <span className="text-sm text-slate-400">{formatDate(c.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-base text-slate-700">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
