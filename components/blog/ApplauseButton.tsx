"use client";

import { useEffect, useRef, useState } from "react";

const CLAPPER_STORAGE_KEY = "blog_clapper_id";
const MAX_CLAPS_PER_VISITOR = 50;
const SYNC_DELAY_MS = 600;

function getClapperId(): string {
  try {
    let id = localStorage.getItem(CLAPPER_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLAPPER_STORAGE_KEY, id);
    }
    return id;
  } catch {
    // Private browsing / storage blocked: a fresh id per click means claps
    // won't persist across a refresh, but the button still works this visit.
    return crypto.randomUUID();
  }
}

/**
 * Medium-style "clap" button: every click increments optimistically and
 * batches the actual `POST` after a short pause (so mashing the button
 * doesn't fire a request per click), capped at `MAX_CLAPS_PER_VISITOR`. The
 * visitor is identified by an opaque id in `localStorage` — no account
 * needed, mirrors Medium's anonymous-clap behavior. On mount, fetches this
 * visitor's own past clap count for the article so the button still reads
 * as "clapped" after a page refresh.
 */
export function ApplauseButton({ slug, initialTotal }: { slug: string; initialTotal: number }) {
  const [total, setTotal] = useState(initialTotal);
  const [byYou, setByYou] = useState(0);
  const pendingRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clapperId = getClapperId();
    fetch(`/api/public/articles/${slug}/applause?clapperId=${encodeURIComponent(clapperId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setByYou(data.byYou ?? 0);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function flush() {
    const amount = pendingRef.current;
    pendingRef.current = 0;
    if (amount === 0) return;

    fetch(`/api/public/articles/${slug}/applause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clapperId: getClapperId(), amount }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setTotal(data.total);
          setByYou(data.byYou);
        }
      })
      .catch(() => {});
  }

  function handleClick() {
    if (byYou + pendingRef.current >= MAX_CLAPS_PER_VISITOR) return;

    setTotal((t) => t + 1);
    setByYou((b) => b + 1);
    pendingRef.current += 1;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, SYNC_DELAY_MS);
  }

  const clapped = byYou > 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={clapped}
      title="Aplaudir este artículo"
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        clapped ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill={clapped ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 11.5V7a1.5 1.5 0 0 1 3 0v3M10 10V5.5a1.5 1.5 0 0 1 3 0V10M13 10.2V6.5a1.5 1.5 0 0 1 3 0V11M16 10.5a1.5 1.5 0 0 1 3 0V15c0 3.5-2.5 6-6.5 6h-1C8 21 6 19 5 17l-2-4c-.4-.9.2-2 1.2-2 .6 0 1.1.3 1.4.8L7 14"
        />
      </svg>
      <span>{total.toLocaleString("es")}</span>
    </button>
  );
}
