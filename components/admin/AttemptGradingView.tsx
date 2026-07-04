"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CodeAnswerGrader } from "@/components/admin/CodeAnswerGrader";
import { ActivityEventsList } from "@/components/admin/ActivityEventsList";

interface Option {
  id: string;
  text: string;
}

interface Answer {
  id: string;
  selectedOption: string | null;
  selectedOptions: string[] | null;
  codeAnswer: string | null;
  isCorrect: boolean | null;
  autoScore: number | null;
  manualScore: number | null;
  teacherComment: string | null;
  aiEvaluations: { id: string; suggestedScore: number; feedback: string; model: string; createdAt: string }[];
}

interface Question {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "CODE";
  statement: string;
  points: number;
  options: Option[] | null;
  correctAnswer: string | null;
  correctAnswers: string[] | null;
  language: string | null;
  expectedSolution: string | null;
  rubric: string | null;
  enableAiEvaluation: boolean;
  answer: Answer | null;
}

interface ActivityEvent {
  id: string;
  type: string;
  detail: string | null;
  isPenalty: boolean;
  createdAt: string;
}

interface Attempt {
  id: string;
  nombres: string;
  apellidos: string;
  ci: string;
  correo: string;
  status: string;
  penaltyCount: number;
  totalScore: number | null;
  activityEvents: ActivityEvent[];
}

export function AttemptGradingView({
  examId,
  attempt,
  questions,
}: {
  examId: string;
  attempt: Attempt;
  questions: Question[];
}) {
  const [localQuestions, setLocalQuestions] = useState(questions);

  function handleGraded(
    questionId: string,
    answer: { id: string; manualScore: number; teacherComment: string | null }
  ) {
    setLocalQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              answer: q.answer
                ? { ...q.answer, manualScore: answer.manualScore, teacherComment: answer.teacherComment }
                : {
                    id: answer.id,
                    selectedOption: null,
                    selectedOptions: null,
                    codeAnswer: null,
                    isCorrect: null,
                    autoScore: null,
                    manualScore: answer.manualScore,
                    teacherComment: answer.teacherComment,
                    aiEvaluations: [],
                  },
            }
          : q
      )
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-slate-900">
              {attempt.nombres} {attempt.apellidos}
            </h2>
            <p className="text-sm text-slate-500">
              CI {attempt.ci} · {attempt.correo}
            </p>
          </div>
          <div className="text-right">
            <Badge tone={attempt.status === "LOCKED" ? "red" : "gray"}>{attempt.status}</Badge>
            <p className="mt-1 text-sm text-slate-500">
              Puntaje: {attempt.totalScore ?? 0} · Incidencias: {attempt.penaltyCount}
            </p>
          </div>
        </div>
      </Card>

      <ActivityEventsList events={attempt.activityEvents} />

      {localQuestions.map((q, index) => (
        <Card key={q.id}>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium text-slate-900">
              Pregunta {index + 1} ({q.points} pts)
            </p>
            {q.answer?.isCorrect !== null && q.answer?.isCorrect !== undefined && (
              <Badge tone={q.answer.isCorrect ? "green" : "red"}>
                {q.answer.isCorrect ? "Correcta" : "Incorrecta"} · {q.answer.autoScore ?? 0} pts
              </Badge>
            )}
          </div>
          <p className="mb-3 text-slate-700">{q.statement}</p>

          {q.type === "SINGLE_CHOICE" && q.options && (
            <ul className="space-y-1 text-sm">
              {q.options.map((opt) => {
                const isCorrectOption = opt.id === q.correctAnswer;
                const isSelected = opt.id === q.answer?.selectedOption;
                return (
                  <li
                    key={opt.id}
                    className={`rounded px-2 py-1 ${
                      isCorrectOption ? "bg-emerald-50" : isSelected ? "bg-red-50" : ""
                    }`}
                  >
                    {isSelected && "→ "}
                    {opt.text}
                    {isCorrectOption && <span className="ml-2 text-xs text-emerald-600">(correcta)</span>}
                  </li>
                );
              })}
            </ul>
          )}

          {q.type === "MULTIPLE_CHOICE" && q.options && (
            <ul className="space-y-1 text-sm">
              {q.options.map((opt) => {
                const isCorrectOption = (q.correctAnswers ?? []).includes(opt.id);
                const isSelected = (q.answer?.selectedOptions ?? []).includes(opt.id);
                return (
                  <li
                    key={opt.id}
                    className={`rounded px-2 py-1 ${
                      isCorrectOption ? "bg-emerald-50" : isSelected ? "bg-red-50" : ""
                    }`}
                  >
                    {isSelected && "→ "}
                    {opt.text}
                    {isCorrectOption && <span className="ml-2 text-xs text-emerald-600">(correcta)</span>}
                  </li>
                );
              })}
            </ul>
          )}

          {q.type === "CODE" && (
            <CodeAnswerGrader
              examId={examId}
              attemptId={attempt.id}
              questionId={q.id}
              answerId={q.answer?.id ?? null}
              language={q.language ?? "javascript"}
              studentCode={q.answer?.codeAnswer ?? ""}
              expectedSolution={q.expectedSolution}
              rubric={q.rubric}
              maxPoints={q.points}
              manualScore={q.answer?.manualScore ?? null}
              teacherComment={q.answer?.teacherComment ?? null}
              enableAiEvaluation={q.enableAiEvaluation}
              aiEvaluations={q.answer?.aiEvaluations ?? []}
              onGraded={handleGraded}
            />
          )}
        </Card>
      ))}
    </div>
  );
}
