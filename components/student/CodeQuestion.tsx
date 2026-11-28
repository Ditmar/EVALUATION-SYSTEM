"use client";

import { useEffect, useRef, useState } from "react";
import { CodeEditor } from "@/components/CodeEditor";

const EMIT_DEBOUNCE_MS = 300;

/**
 * Exam `code` answer. Typing only updates a local draft; the exam page (which
 * re-renders every question and schedules the autosave) is notified
 * debounced, on blur and on unmount — same approach as the laboratory's
 * CodeAnswer. Emitting on every keystroke made long written answers lag,
 * because each key re-rendered the whole exam.
 */
export function CodeQuestion({
  language,
  value,
  onChange,
  disabled,
}: {
  language: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const lastEmitted = useRef(value);
  const draftRef = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Adopt outside changes (initial load) but not echoes of our own emits.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      draftRef.current = value;
      setDraft(value);
    }
  }, [value]);

  function flush() {
    clearTimeout(timer.current);
    if (draftRef.current !== lastEmitted.current) {
      lastEmitted.current = draftRef.current;
      onChangeRef.current(draftRef.current);
    }
  }

  // Don't lose the last keystrokes if the component unmounts mid-debounce.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200" onBlur={flush}>
      <CodeEditor
        value={disabled ? value : draft}
        language={language}
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
