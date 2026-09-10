"use client";

import { useEffect, useRef, useState } from "react";
import type { ArticleHeading } from "@/lib/blog/types";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

/** Exported for the admin editor's preview pane, which shows the heading list inline without the real page's fixed mobile button/sidebar chrome. */
export function TocLinks({
  headings,
  activeId,
  onNavigate,
  size = "sm",
}: {
  headings: ArticleHeading[];
  activeId: string | null;
  onNavigate?: () => void;
  size?: "sm" | "base";
}) {
  return (
    <ul className={`space-y-3 ${size === "base" ? "text-base" : "text-sm"}`}>
      {headings.map((h) => (
        <li key={h.id} style={{ paddingLeft: h.depth === 3 ? "1rem" : 0 }}>
          <a
            href={`#${h.id}`}
            onClick={onNavigate}
            className={`block py-0.5 leading-snug transition-colors ${
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
 * Index of contents for an article: a sticky sidebar on desktop (`lg:`,
 * works because the shared grid row stretches its column to the article's
 * full height, giving `position: sticky` room to travel). On mobile there is
 * no such tall container to stick within, so instead of a half-working
 * sticky box we use a `fixed` floating button + bottom-sheet panel — always
 * reachable at the same spot on screen no matter how far you've scrolled
 * into the article.
 */
export function TableOfContents({ headings }: { headings: ArticleHeading[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
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

      {/* Mobile/tablet: floating button, fixed to the viewport so it stays reachable at every scroll position (not left behind like an inline collapsible would be). */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir contenido del artículo"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-base font-medium text-white shadow-lg active:scale-95 lg:hidden"
      >
        <MenuIcon className="h-5 w-5" />
        Contenido
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-5 pb-8 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-semibold text-slate-900">Contenido del artículo</p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <TocLinks headings={headings} activeId={activeId} onNavigate={() => setMobileOpen(false)} size="base" />
          </div>
        </div>
      )}
    </>
  );
}
