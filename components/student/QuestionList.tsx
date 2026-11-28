import { memo } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { QuestionStatement } from "@/components/QuestionStatement";
import { SingleChoiceQuestion } from "@/components/student/SingleChoiceQuestion";
import { MultipleChoiceQuestion } from "@/components/student/MultipleChoiceQuestion";
import { CodeQuestion } from "@/components/student/CodeQuestion";
import { IdeQuestion } from "@/components/student/IdeQuestion";
import type { IdeAnswerValue } from "@/lib/code-runner/types";

export interface StudentQuestion {
  questionId: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "CODE" | "CODE_IDE";
  statement: string;
  points: number;
  options: { id: string; text: string }[] | null;
  language: string | null;
  /** CODE_IDE only (IdeConfig JSON). */
  ideConfig?: unknown;
  runsUsed?: number;
}

export type AnswerValue =
  | { selectedOption: string | null }
  | { selectedOptions: string[] }
  | { codeAnswer: string }
  | { codeFiles: IdeAnswerValue };

function isAnswered(value: AnswerValue | undefined): boolean {
  if (!value) return false;
  if ("selectedOption" in value) return Boolean(value.selectedOption);
  if ("selectedOptions" in value) return value.selectedOptions.length > 0;
  if ("codeAnswer" in value) return value.codeAnswer.trim().length > 0;
  if ("codeFiles" in value) return value.codeFiles.files.some((f) => f.content.trim().length > 0);
  return false;
}

export function QuestionList({
  questions,
  answers,
  onChange,
  disabled,
  runEndpoint,
}: {
  questions: StudentQuestion[];
  answers: Record<string, AnswerValue>;
  /** Must be referentially stable (useCallback) for the per-question memo to work. */
  onChange: (questionId: string, value: AnswerValue) => void;
  disabled?: boolean;
  /** POST endpoint for CODE_IDE runs (the exam's `/run` route). */
  runEndpoint?: string;
}) {
  return (
    <div className="space-y-6">
      {questions.map((q, index) => (
        <QuestionCard
          key={q.questionId}
          question={q}
          index={index}
          answer={answers[q.questionId]}
          onChange={onChange}
          disabled={disabled}
          runEndpoint={runEndpoint}
        />
      ))}
    </div>
  );
}

/**
 * One question. Memoized so that typing in one answer (which replaces only
 * that question's entry in `answers`) doesn't re-render the other questions —
 * their statements, code blocks and editors.
 */
const QuestionCard = memo(function QuestionCard({
  question: q,
  index,
  answer,
  onChange,
  disabled,
  runEndpoint,
}: {
  question: StudentQuestion;
  index: number;
  answer: AnswerValue | undefined;
  onChange: (questionId: string, value: AnswerValue) => void;
  disabled?: boolean;
  runEndpoint?: string;
}) {
  return (
    <Card id={`question-${q.questionId}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium text-slate-900">
          Pregunta {index + 1} ({q.points} pts)
        </p>
        <Badge tone={isAnswered(answer) ? "green" : "gray"}>{isAnswered(answer) ? "Respondida" : "Pendiente"}</Badge>
      </div>
      <QuestionStatement statement={q.statement} className="mb-4 space-y-2" />

      {q.type === "SINGLE_CHOICE" && q.options && (
        <SingleChoiceQuestion
          name={q.questionId}
          options={q.options}
          value={answer && "selectedOption" in answer ? answer.selectedOption : null}
          onChange={(value) => onChange(q.questionId, { selectedOption: value })}
          disabled={disabled}
        />
      )}

      {q.type === "MULTIPLE_CHOICE" && q.options && (
        <MultipleChoiceQuestion
          options={q.options}
          value={answer && "selectedOptions" in answer ? answer.selectedOptions : []}
          onChange={(value) => onChange(q.questionId, { selectedOptions: value })}
          disabled={disabled}
        />
      )}

      {q.type === "CODE" && (
        <CodeQuestion
          language={q.language ?? "javascript"}
          value={answer && "codeAnswer" in answer ? answer.codeAnswer : ""}
          onChange={(value) => onChange(q.questionId, { codeAnswer: value })}
          disabled={disabled}
        />
      )}

      {q.type === "CODE_IDE" && (
        <IdeQuestion
          questionId={q.questionId}
          ideConfig={q.ideConfig}
          value={answer && "codeFiles" in answer ? answer.codeFiles : undefined}
          onChange={(value) => onChange(q.questionId, { codeFiles: value })}
          disabled={disabled}
          runEndpoint={runEndpoint}
          runsUsed={q.runsUsed}
        />
      )}
    </Card>
  );
});
