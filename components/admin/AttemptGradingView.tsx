"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { QuestionStatement } from "@/components/QuestionStatement";
import { CodeAnswerGrader } from "@/components/admin/CodeAnswerGrader";
import { ActivityEventsList } from "@/components/admin/ActivityEventsList";
import { ScreenCaptureGallery } from "@/components/admin/ScreenCaptureGallery";
import { IdeRunSummary } from "@/components/admin/IdeRunSummary";
import { IdeWorkspace } from "@/components/ide/IdeWorkspace";
import { asIdeConfig } from "@/lib/code-runner/ide-config";
import { isIdeAnswerValue } from "@/lib/code-runner/types";

interface Option {
  id: string;
  text: string;
}

interface Answer {
  id: string;
  selectedOption: string | null;
  selectedOptions: string[] | null;
  codeAnswer: string | null;
  codeFiles?: unknown;
  isCorrect: boolean | null;
  autoScore: number | null;
  manualScore: number | null;
  teacherComment: string | null;
  aiEvaluations: { id: string; suggestedScore: number; feedback: string; model: string; createdAt: string }[];
}

interface Question {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "CODE" | "CODE_IDE";
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
  ideConfig?: unknown;
  runSummary?: React.ComponentProps<typeof IdeRunSummary>["summary"];
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

      <ScreenCaptureGallery examId={examId} attemptId={attempt.id} />

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
          <QuestionStatement statement={q.statement} className="mb-3 space-y-2" />

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

          {(q.type === "CODE" || q.type === "CODE_IDE") && (
            <CodeAnswerGrader
              answerView={q.type === "CODE_IDE" ? <IdeGradingView question={q} /> : undefined}
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

/** CODE_IDE answer for the teacher: every file read-only, Run via the admin route, and the student's run history. */
function IdeGradingView({ question }: { question: Question }) {
  const config = asIdeConfig(question.ideConfig);
  if (!config) return <p className="text-sm text-red-600">Configuración del IDE inválida.</p>;
  const files = question.answer?.codeFiles;
  return (
    <div className="space-y-2">
      <IdeWorkspace
        config={config}
        value={isIdeAnswerValue(files) ? files : undefined}
        runEndpoint="/api/admin/code-runner/run"
        runBody={{ questionId: question.id, config }}
        disabled
        allowRunWhenDisabled
      />
      <IdeRunSummary summary={question.runSummary} />
    </div>
  );
}
