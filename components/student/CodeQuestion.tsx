"use client";

import { CodeEditor } from "@/components/CodeEditor";

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
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <CodeEditor value={value} language={language} onChange={onChange} readOnly={disabled} height="260px" />
    </div>
  );
}
