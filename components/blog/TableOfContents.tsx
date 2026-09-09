"use client";

import { useEffect, useRef, useState } from "react";
import type { ArticleHeading } from "@/lib/blog/types";

function TocLinks({ headings, activeId, onNavigate }: { headings: ArticleHeading[]; activeId: string | null; onNavigate?: () => void }) {
  return (
    <ul className="space-y-2 text-sm">
      {headings.map((h) => (
        <li key={h.id} style={{ paddingLeft: h.depth === 3 ? "0.75rem" : 0 }}>
          <a
            href={`#${h.id}`}
            onClick={onNavigate}
            className={`block truncate transition-colors ${
              activeId === h.id ? "font-medium text-brand-700" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Index of contents for an article: a sticky sidebar on desktop (`lg:`), a
 * collapsible `<details>` above the article body on mobile. Highlights the
 * heading currently in view via `IntersectionObserver` rather than a scroll
 * handler (cheaper, no manual rAF throttling needed).
 */
export function TableOfContents({ headings }: { headings: ArticleHeading[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const elements = headings.map((h) => document.getElementById(h.id)).filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px" }
    );

    for (const el of elements) observerRef.current.observe(el);
    return () => observerRef.current?.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <>
      {/* Desktop: sticky sidebar */}
      <nav className="sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-y-auto lg:block" aria-label="Tabla de contenidos">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Contenido</p>
        <TocLinks headings={headings} activeId={activeId} />
      </nav>

      {/* Mobile/tablet: collapsible summary */}
      <details className="mb-8 rounded-lg border border-slate-200 bg-white p-4 lg:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Contenido del artículo</summary>
        <div className="mt-3">
          <TocLinks headings={headings} activeId={activeId} />
        </div>
      </details>
    </>
  );
}
