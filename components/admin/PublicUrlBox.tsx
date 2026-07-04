"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function PublicUrlBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
      <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-slate-700">{url}</code>
      <Button variant="secondary" onClick={copy} className="shrink-0">
        {copied ? "¡Copiado!" : "Copiar"}
      </Button>
    </div>
  );
}
