import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SingleChoiceQuestion } from "@/components/student/SingleChoiceQuestion";
import { MultipleChoiceQuestion } from "@/components/student/MultipleChoiceQuestion";
import { CodeQuestion } from "@/components/student/CodeQuestion";

export interface StudentQuestion {
  questionId: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "CODE";
  statement: string;
  points: number;
  options: { id: string; text: string }[] | null;
  language: string | null;
}

export type AnswerValue =
  | { selectedOption: string | null }
  | { selectedOptions: string[] }
  | { codeAnswer: string };

function isAnswered(value: AnswerValue | undefined): boolean {
  if (!value) return false;
  if ("selectedOption" in value) return Boolean(value.selectedOption);
  if ("selectedOptions" in value) return value.selectedOptions.length > 0;
  if ("codeAnswer" in value) return value.codeAnswer.trim().length > 0;
  return false;
}

export function QuestionList({
  questions,
  answers,
  onChange,
  disabled,
}: {
  questions: StudentQuestion[];
  answers: Record<string, AnswerValue>;
  onChange: (questionId: string, value: AnswerValue) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-6">
      {questions.map((q, index) => {
        const answer = answers[q.questionId];
        return (
          <Card key={q.questionId} id={`question-${q.questionId}`}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium text-slate-900">
                Pregunta {index + 1} ({q.points} pts)
              </p>
              <Badge tone={isAnswered(answer) ? "green" : "gray"}>
                {isAnswered(answer) ? "Respondida" : "Pendiente"}
              </Badge>
            </div>
            <p className="mb-4 whitespace-pre-wrap text-slate-700">{q.statement}</p>

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
          </Card>
        );
      })}
    </div>
  );
}
