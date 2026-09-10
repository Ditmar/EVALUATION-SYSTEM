"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseArticle } from "@/lib/blog/parse-article";
import { slugify } from "@/lib/blog/slugify";
import type { ArticleDefinition, ArticleParseError } from "@/lib/blog/types";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/blog/Avatar";
import { ArticleContent } from "@/components/blog/ArticleContent";
import { TableOfContents } from "@/components/blog/TableOfContents";

const EXAMPLE_MARKDOWN = `---
title: Introducción a los árboles AVL
excerpt: Cómo mantener un árbol binario de búsqueda balanceado en O(log n).
tags: [estructuras-de-datos, algoritmos]
---

Un árbol AVL es un árbol binario de búsqueda que se autobalancea limitando la
diferencia de alturas entre subárboles a $|h_L - h_R| \\leq 1$.

## Factor de balance

$$
FB(n) = h(n.izquierda) - h(n.derecha)
$$

## Rotación simple a la derecha

\`\`\`python
def rotar_derecha(n):
    pivote = n.izquierda
    n.izquierda = pivote.derecha
    pivote.derecha = n
    return pivote
\`\`\`

## Diagrama del proceso

\`\`\`mermaid
flowchart TD
    A[Insertar nodo] --> B{¿Factor de balance fuera de -1..1?}
    B -- No --> C[Fin]
    B -- Sí --> D[Determinar caso: LL, LR, RL o RR]
    D --> E[Aplicar rotación]
    E --> C
\`\`\`

| Caso      | Condición            | Rotación          |
|-----------|-----------------------|--------------------|
| Izquierda | FB > 1, hijo FB >= 0  | Simple derecha     |
| Derecha   | FB < -1, hijo FB <= 0 | Simple izquierda   |
`;

export interface ArticleEditorInitial {
  id: string;
  slug: string;
  markdownSource: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export function ArticleEditorForm({ initial, authorName }: { initial?: ArticleEditorInitial; authorName: string }) {
  const router = useRouter();
  const [raw, setRaw] = useState(initial?.markdownSource ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<ArticleDefinition | null>(null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);

  function handleValidate(): ArticleDefinition | null {
    setErrors([]);
    setPreview(null);

    const result = parseArticle(raw);
    if (!result.ok) {
      setErrors(result.errors.map((e: ArticleParseError) => e.message));
      return null;
    }

    if (!slugTouched) setSlug(slugify(result.article.frontmatter.title));
    setPreview(result.article);
    return result.article;
  }

  async function handleSave(nextStatus: "draft" | "publish") {
    const parsed = preview ?? handleValidate();
    if (!parsed) return;
    if (!slug.trim()) {
      setErrors(["El slug es requerido."]);
      return;
    }

    setSaving(nextStatus);
    setErrors([]);

    try {
      const url = initial ? `/api/admin/articles/${initial.id}` : "/api/admin/articles";
      const method = initial ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdownSource: raw, slug: slug.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrors([data.error ?? "No se pudo guardar el artículo.", ...(data.issues ?? []).map((i: { message: string }) => i.message)]);
        return;
      }

      const articleId = data.article.id;

      if (nextStatus === "publish") {
        const publishRes = await fetch(`/api/admin/articles/${articleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "PUBLISHED" }),
        });
        const publishData = await publishRes.json().catch(() => ({}));
        if (!publishRes.ok) {
          setErrors([publishData.error ?? "El artículo se guardó, pero no se pudo publicar."]);
          return;
        }
      }

      router.push(`/admin/articles/${articleId}`);
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <label className="label" htmlFor="article-slug">
          Slug (URL pública: /home/{slug || "..."})
        </label>
        <Input
          id="article-slug"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          placeholder="introduccion-arboles-avl"
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-slate-900">Markdown del artículo</h2>
            <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => setRaw(EXAMPLE_MARKDOWN)}>
              Cargar ejemplo
            </button>
          </div>
          <TextArea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={24}
            className="font-mono text-xs"
            placeholder="Pega aquí el Markdown del artículo (frontmatter + contenido)..."
          />
          {errors.length > 0 && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <p className="mb-1 font-medium">Se encontraron errores:</p>
              <ul className="list-inside list-disc space-y-1">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="secondary" type="button" onClick={handleValidate} disabled={!raw.trim()}>
              Validar y previsualizar
            </Button>
            <Button variant="secondary" type="button" onClick={() => handleSave("draft")} disabled={!raw.trim() || saving !== null}>
              {saving === "draft" ? "Guardando..." : initial ? "Guardar cambios" : "Guardar borrador"}
            </Button>
            {initial?.status !== "PUBLISHED" && (
              <Button type="button" onClick={() => handleSave("publish")} disabled={!raw.trim() || saving !== null}>
                {saving === "publish" ? "Publicando..." : "Publicar"}
              </Button>
            )}
          </div>
        </Card>

        <div>
          {preview ? (
            <Card className="max-h-[80vh] overflow-y-auto">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Vista previa</p>
              {preview.frontmatter.tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {preview.frontmatter.tags.map((tag) => (
                    <span key={tag} className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <h1 className="font-serif text-2xl font-bold text-slate-900">{preview.frontmatter.title}</h1>
              <div className="mt-4 mb-6 flex items-center gap-3">
                <Avatar name={authorName} size="sm" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{authorName}</p>
                  <p className="text-xs text-slate-500">Hoy · {preview.readingTimeMinutes} min de lectura</p>
                </div>
              </div>
              {preview.headings.length > 0 && (
                <div className="mb-6 rounded-lg border border-slate-200 p-4">
                  <TableOfContents headings={preview.headings} />
                </div>
              )}
              <ArticleContent content={preview.content} headings={preview.headings} />
            </Card>
          ) : (
            <Card className="text-sm text-slate-500">La vista previa aparecerá aquí después de validar el Markdown.</Card>
          )}
        </div>
      </div>
    </div>
  );
}
