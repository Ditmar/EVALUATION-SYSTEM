"use client";

import type { AnswerComponentProps } from "./types";

export function MultipleChoiceAnswer({ question, value, onChange, disabled }: AnswerComponentProps) {
  if (question.type !== "multiple-choice") return null;
  const selected = Array.isArray(value) ? value : [];

  function toggle(option: string) {
    onChange(selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option]);
  }

  return (
    <div className="space-y-2">
      {question.options.map((option) => (
        <label
          key={option}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
            selected.includes(option) ? "border-brand-500 bg-brand-50" : "border-slate-200"
          }`}
        >
          <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} disabled={disabled} />
          {option}
        </label>
      ))}
    </div>
  );
}
