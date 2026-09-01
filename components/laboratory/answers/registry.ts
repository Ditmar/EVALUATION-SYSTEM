import type { QuestionType } from "@/lib/laboratory/types";
import { TextAnswer } from "./TextAnswer";
import { TextareaAnswer } from "./TextareaAnswer";
import { NumberAnswer } from "./NumberAnswer";
import { BooleanAnswer } from "./BooleanAnswer";
import { SingleChoiceAnswer } from "./SingleChoiceAnswer";
import { MultipleChoiceAnswer } from "./MultipleChoiceAnswer";
import { SelectAnswer } from "./SelectAnswer";
import { CodeAnswer } from "./CodeAnswer";
import type { AnswerComponent } from "./types";

/**
 * The only place that maps a question `type` to the component that renders
 * it. Adding a new answer type means adding one entry here — nothing in
 * `LaboratoryRenderer` needs to change.
 */
export const answerRegistry: Record<QuestionType, AnswerComponent> = {
  text: TextAnswer,
  textarea: TextareaAnswer,
  number: NumberAnswer,
  boolean: BooleanAnswer,
  "single-choice": SingleChoiceAnswer,
  "multiple-choice": MultipleChoiceAnswer,
  select: SelectAnswer,
  code: CodeAnswer,
};
