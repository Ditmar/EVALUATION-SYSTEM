import type { ComponentType } from "react";
import type { AnswerValue, QuestionDefinition } from "@/lib/laboratory/types";

export interface AnswerComponentProps {
  question: QuestionDefinition;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  disabled?: boolean;
}

export type AnswerComponent = ComponentType<AnswerComponentProps>;
