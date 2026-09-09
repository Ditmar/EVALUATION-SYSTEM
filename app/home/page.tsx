import Link from "next/link";
import { listPublishedArticles } from "@/lib/blog/queries";
import { Avatar } from "@/components/blog/Avatar";

function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BlogHomePage({ searchParams }: { searchParams: { tag?: string } }) {
  const activeTag = searchParams.tag ?? null;
  const articles = await listPublishedArticles(activeTag);

  const allTags = Array.from(new Set(articles.flatMap((a) => a.tags))).sort();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-10">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-slate-900">Artículos</h1>
        <p className="mt-2 text-slate-500">Notas y guías del curso, en texto, código y ecuaciones.</p>
      </div>

      {allTags.length > 0 && (
        <div className="mb-10 flex flex-wrap gap-2">
          <Link
            href="/home"
            className={`rounded-full px-3 py-1 text-sm font-medium ${!activeTag ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Todos
          </Link>
          {allTags.map((tag) => (
            <Link
              key={tag}
              href={`/home?tag=${encodeURIComponent(tag)}`}
              className={`rounded-full px-3 py-1 text-sm font-medium ${activeTag === tag ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {tag}
            </Link>
          ))}
        </div>
      )}

      {articles.length === 0 ? (
        <p className="text-slate-400">
          {activeTag ? `No hay artículos con la etiqueta "${activeTag}" todavía.` : "Todavía no hay artículos publicados."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {articles.map((article) => (
            <li key={article.slug} className="py-8 first:pt-0">
              <Link href={`/home/${article.slug}`} className="group block">
                {article.tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {article.tags.map((tag) => (
                      <span key={tag} className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <h2 className="font-serif text-2xl font-bold text-slate-900 group-hover:text-brand-700">{article.title}</h2>
                <p className="mt-2 line-clamp-2 text-slate-600">{article.excerpt}</p>
                <div className="mt-4 flex items-center gap-3 text-sm text-slate-500">
                  <Avatar name={article.authorName} size="sm" />
                  <span className="font-medium text-slate-700">{article.authorName}</span>
                  <span aria-hidden>·</span>
                  <span>{formatDate(article.publishedAt)}</span>
                  <span aria-hidden>·</span>
                  <span>{article.readingTimeMinutes} min de lectura</span>
                  <span aria-hidden>·</span>
                  <span>👏 {article.applauseCount}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
