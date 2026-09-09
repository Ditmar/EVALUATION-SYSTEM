"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  tags: string[];
  readingTimeMinutes: number;
  publishedAt: string | null;
  createdAt: string;
  commentCount: number;
}

const STATUS_LABEL: Record<ArticleSummary["status"], string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
};

const STATUS_TONE: Record<ArticleSummary["status"], "gray" | "green" | "yellow"> = {
  DRAFT: "gray",
  PUBLISHED: "green",
  ARCHIVED: "yellow",
};

export function ArticleList() {
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/articles")
      .then((res) => res.json())
      .then((data) => setArticles(data.articles ?? []));
  }, []);

  if (articles === null) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> Cargando artículos...
      </div>
    );
  }

  if (articles.length === 0) {
    return <Card className="text-center text-slate-500">Aún no has escrito ningún artículo. Usa el botón &quot;Nuevo artículo&quot;.</Card>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {articles.map((article) => (
        <Link key={article.id} href={`/admin/articles/${article.id}`} className="block h-full">
          <Card className="card-interactive flex h-full flex-col">
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="font-medium leading-snug text-slate-900">{article.title}</h3>
              <Badge tone={STATUS_TONE[article.status]} className="shrink-0">
                {STATUS_LABEL[article.status]}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">/home/{article.slug}</p>
            <p className="mt-1 text-xs text-slate-400">
              {article.readingTimeMinutes} min de lectura · {article.commentCount} comentarios
            </p>
            <div className="mt-4 flex flex-1 flex-wrap items-end gap-2">
              {article.tags.map((tag) => (
                <Badge key={tag} tone="blue">
                  {tag}
                </Badge>
              ))}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
