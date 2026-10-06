"use client";

import { useEffect, useRef, useState } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import type { AnswerComponentProps } from "./types";

const EMIT_DEBOUNCE_MS = 300;

export function CodeAnswer({ question, value, onChange, disabled }: AnswerComponentProps) {
  const external = typeof value === "string" ? value : "";
  // Typing updates only this local draft; the parent (which re-renders the
  // whole laboratory and autosaves) is notified debounced — same approach as
  // TextareaAnswer.
  const [draft, setDraft] = useState(external);
  const lastEmitted = useRef(external);
  const draftRef = useRef(draft);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Adopt outside changes (e.g. initial load) but not echoes of our own emits.
  useEffect(() => {
    if (external !== lastEmitted.current) {
      lastEmitted.current = external;
      draftRef.current = external;
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

  if (question.type !== "code") return null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200" onBlur={flush}>
      <CodeEditor
        value={disabled ? external : draft}
        language={question.language}
        onChange={(next) => {
          draftRef.current = next;
          setDraft(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, EMIT_DEBOUNCE_MS);
        }}
        readOnly={disabled}
        height="260px"
      />
    </div>
  );
}
