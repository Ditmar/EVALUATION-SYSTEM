"use client";

import { useState } from "react";

/** Native share sheet on mobile (`navigator.share`), copy-to-clipboard fallback everywhere else. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User dismissed the share sheet — not an error.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — nothing more we can do without a prompt().
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.68 13.34a3 3 0 1 0 0-2.68m0 2.68 6.64 3.98m-6.64-6.66 6.64-3.98m0 0a3 3 0 1 0 0-2.02 3 3 0 0 0 0 2.02Zm0 10.66a3 3 0 1 0 0 2.02 3 3 0 0 0 0-2.02Z"
        />
      </svg>
      {copied ? "¡Enlace copiado!" : "Compartir"}
    </button>
  );
}
