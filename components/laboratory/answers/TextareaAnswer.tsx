"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { TextArea } from "@/components/ui/TextArea";
import { MarkdownNodes } from "@/components/laboratory/LaboratoryRenderer";
import { renderMarkdownText } from "@/lib/laboratory/render-markdown-text";
import type { AnswerComponentProps } from "./types";

type Mode = "edit" | "preview";

const EMIT_DEBOUNCE_MS = 300;

const Preview = memo(function Preview({ text, emptyLabel }: { text: string; emptyLabel: string }) {
  const nodes = useMemo(() => renderMarkdownText(text), [text]);
  if (!text.trim()) {
    return <p className="text-sm italic text-slate-400">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2 text-sm text-slate-700">
      <MarkdownNodes nodes={nodes} />
    </div>
  );
});

export function TextareaAnswer({ question, value, onChange, disabled }: AnswerComponentProps) {
  // Hooks first, unconditionally — see GitHubPrAnswer.tsx for why the type
  // guard runs after them rather than before.
  const [mode, setMode] = useState<Mode>("edit");

  const external = typeof value === "string" ? value : "";
  // Typing updates only this local draft; the parent (which re-renders the
  // whole laboratory and autosaves) is notified debounced, so keystrokes stay
  // instant regardless of how big the laboratory is.
  const [draft, setDraft] = useState(external);
  const lastEmitted = useRef(external);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Adopt outside changes (e.g. initial load) but not echoes of our own emits.
  useEffect(() => {
    if (external !== lastEmitted.current) {
      lastEmitted.current = external;
      setDraft(external);
    }
  }, [external]);

  function flush() {
    clearTimeout(timer.current);
    if (draftRef.current !== lastEmitted.current) {
      lastEmitted.current = draftRef.current;
      onChangeRef.current(draftRef.current);
    }
  }

  // Don't lose the last keystrokes if the component unmounts mid-debounce.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (question.type !== "textarea") return null;

  const text = disabled ? external : draft;

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
          onClick={() => {
            flush();
            setMode("preview");
          }}
          className={mode === "preview" ? "font-medium text-brand-600" : "text-slate-400 hover:text-slate-600"}
        >
          Vista previa
        </button>
      </div>

      {mode === "edit" ? (
        <TextArea
          rows={10}
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            draftRef.current = next;
            setDraft(next);
            clearTimeout(timer.current);
            timer.current = setTimeout(flush, EMIT_DEBOUNCE_MS);
          }}
          onBlur={flush}
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
