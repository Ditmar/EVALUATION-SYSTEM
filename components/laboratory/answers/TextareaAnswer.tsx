"use client";

import { useState } from "react";
import { TextArea } from "@/components/ui/TextArea";
import { MarkdownNodes } from "@/components/laboratory/LaboratoryRenderer";
import { renderMarkdownText } from "@/lib/laboratory/render-markdown-text";
import type { AnswerComponentProps } from "./types";

type Mode = "edit" | "preview";

function Preview({ text, emptyLabel }: { text: string; emptyLabel: string }) {
  if (!text.trim()) {
    return <p className="text-sm italic text-slate-400">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2 text-sm text-slate-700">
      <MarkdownNodes nodes={renderMarkdownText(text)} />
    </div>
  );
}

export function TextareaAnswer({ question, value, onChange, disabled }: AnswerComponentProps) {
  // Hooks first, unconditionally — see GitHubPrAnswer.tsx for why the type
  // guard runs after them rather than before.
  const [mode, setMode] = useState<Mode>("edit");

  if (question.type !== "textarea") return null;

  const text = typeof value === "string" ? value : "";

  // Read-only (teacher grading view, or after the lab is submitted/graded):
  // always show the rendered Markdown, never a disabled raw textarea — the
  // point of writing Markdown is that someone eventually reads it formatted.
  if (disabled) {
    return (
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-slate-50 p-3">
        <Preview text={text} emptyLabel="(sin respuesta)" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-1.5 flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => setMode("edit")}
          className={mode === "edit" ? "font-medium text-brand-600" : "text-slate-400 hover:text-slate-600"}
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => setMode("preview")}
          className={mode === "preview" ? "font-medium text-brand-600" : "text-slate-400 hover:text-slate-600"}
        >
          Vista previa
        </button>
      </div>

      {mode === "edit" ? (
        <TextArea
          rows={10}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          className="font-mono text-sm"
        />
      ) : (
        <div className="min-h-[220px] rounded-lg border border-slate-200 bg-white p-3">
          <Preview text={text} emptyLabel="Nada que previsualizar todavía." />
        </div>
      )}

      <p className="mt-1 text-xs text-slate-400">
        Puedes usar Markdown: <code className="rounded bg-slate-100 px-1">**negrita**</code>,{" "}
        <code className="rounded bg-slate-100 px-1">*cursiva*</code>, listas, <code className="rounded bg-slate-100 px-1">`código`</code>.
      </p>
    </div>
  );
}
