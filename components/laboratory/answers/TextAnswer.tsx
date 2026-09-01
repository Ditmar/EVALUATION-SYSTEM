"use client";

import { Input } from "@/components/ui/Input";
import type { AnswerComponentProps } from "./types";

export function TextAnswer({ question, value, onChange, disabled }: AnswerComponentProps) {
  if (question.type !== "text") return null;

  return (
    <Input
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder}
      disabled={disabled}
    />
  );
}
