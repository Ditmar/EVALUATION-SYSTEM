"use client";

import { useEffect, useId, useRef, useState } from "react";

let mermaidInitPromise: Promise<typeof import("mermaid").default> | null = null;

/**
 * Lazily imports and configures `mermaid` exactly once per page, however
 * many diagrams it renders — `mermaid.initialize` is a global, idempotent
 * config call, not a per-instance one.
 */
function getMermaid() {
  if (!mermaidInitPromise) {
    mermaidInitPromise = import("mermaid").then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        // Diagram source is teacher-authored article Markdown — the same
        // trust boundary as everything else `ArticleContent` renders — but
        // `strict` (mermaid's own default) is kept explicit as
        // defense-in-depth against HTML-label/click-handler injection.
        securityLevel: "strict",
        theme: "neutral",
        fontFamily: "inherit",
      });
      return mermaid;
    });
  }
  return mermaidInitPromise;
}

/**
 * Renders a ```mermaid fenced code block as an SVG diagram. Mirrors
 * `components/laboratory/MathNode.tsx`'s one deliberate
 * `dangerouslySetInnerHTML` exception: mermaid's output is generated SVG
 * markup that can't reasonably be reconstructed as plain React elements, and
 * — like KaTeX — this only ever runs on trusted, teacher-authored article
 * content, never on student-facing free text.
 */
export function MermaidDiagram({ code }: { code: string }) {
  const rawId = useId().replace(/[:]/g, "-");
  const id = `mermaid-${rawId}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const generation = ++generationRef.current;

    getMermaid()
      .then((mermaid) => mermaid.render(id, code))
      .then(({ svg }) => {
        if (!cancelled && generation === generationRef.current) {
          setSvg(svg);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled && generation === generationRef.current) {
          setError(err.message || "No se pudo renderizar el diagrama.");
          setSvg(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, code]);

  if (error) {
    return (
      <div className="my-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="font-medium">Error en el diagrama Mermaid:</p>
        <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{error}</pre>
      </div>
    );
  }

  if (!svg) {
    return <div className="my-6 h-24 animate-pulse rounded-lg bg-slate-100" aria-label="Renderizando diagrama..." />;
  }

  return <div className="my-6 flex justify-center overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}
