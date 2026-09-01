"use client";

import { TextArea } from "@/components/ui/TextArea";
import type { AnswerComponentProps } from "./types";

export function TextareaAnswer({ question, value, onChange, disabled }: AnswerComponentProps) {
  if (question.type !== "textarea") return null;

  return (
    <TextArea
      rows={5}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder}
      disabled={disabled}
    />
  );
}
