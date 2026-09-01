"use client";

import type { AnswerComponentProps } from "./types";

export function SingleChoiceAnswer({ question, value, onChange, disabled }: AnswerComponentProps) {
  if (question.type !== "single-choice") return null;
  const selected = typeof value === "string" ? value : null;

  return (
    <div className="space-y-2">
      {question.options.map((option) => (
        <label
          key={option}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
            selected === option ? "border-brand-500 bg-brand-50" : "border-slate-200"
          }`}
        >
          <input type="radio" name={question.id} checked={selected === option} onChange={() => onChange(option)} disabled={disabled} />
          {option}
        </label>
      ))}
    </div>
  );
}
