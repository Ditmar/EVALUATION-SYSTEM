"use client";

import { Select } from "@/components/ui/Select";
import type { AnswerComponentProps } from "./types";

export function SelectAnswer({ question, value, onChange, disabled }: AnswerComponentProps) {
  if (question.type !== "select") return null;

  return (
    <Select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">Selecciona una opción...</option>
      {question.options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </Select>
  );
}
