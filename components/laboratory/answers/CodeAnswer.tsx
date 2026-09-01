"use client";

import { CodeEditor } from "@/components/CodeEditor";
import type { AnswerComponentProps } from "./types";

export function CodeAnswer({ question, value, onChange, disabled }: AnswerComponentProps) {
  if (question.type !== "code") return null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <CodeEditor
        value={typeof value === "string" ? value : ""}
        language={question.language}
        onChange={onChange}
        readOnly={disabled}
        height="260px"
      />
    </div>
  );
}
