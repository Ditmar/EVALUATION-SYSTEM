"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import type { AnswerComponentProps } from "./types";

export function NumberAnswer({ question, value, onChange, disabled }: AnswerComponentProps) {
  // Local text buffer, seeded once from the initial value (e.g. a previously
  // saved answer loaded on mount) — NOT re-synced from `value` on every
  // render, otherwise typing a trailing "." or "-" while entering a decimal
  // would get reset by the parent's own re-render right after each keystroke.
  const [raw, setRaw] = useState(() => (typeof value === "number" ? String(value) : ""));

  if (question.type !== "number") return null;

  function handleChange(next: string) {
    setRaw(next);
    const parsed = Number(next);
    if (next.trim() !== "" && Number.isFinite(parsed)) {
      onChange(parsed);
    }
  }

  return (
    <Input
      type="number"
      value={raw}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={question.placeholder}
      disabled={disabled}
    />
  );
}
