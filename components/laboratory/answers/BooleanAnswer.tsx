"use client";

import type { AnswerComponentProps } from "./types";

export function BooleanAnswer({ question, value, onChange, disabled }: AnswerComponentProps) {
  if (question.type !== "boolean") return null;
  const selected = typeof value === "boolean" ? value : null;

  return (
    <div className="flex gap-3">
      {[
        { label: "Sí", val: true },
        { label: "No", val: false },
      ].map((opt) => (
        <label
          key={opt.label}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm ${
            selected === opt.val ? "border-brand-500 bg-brand-50" : "border-slate-200"
          }`}
        >
          <input
            type="radio"
            name={question.id}
            checked={selected === opt.val}
            onChange={() => onChange(opt.val)}
            disabled={disabled}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
