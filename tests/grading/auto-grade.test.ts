import { describe, expect, it } from "vitest";
import { gradeMultipleChoice, gradeSingleChoice, toStudentQuestion } from "@/lib/grading/auto-grade";
import type { QuestionInput } from "@/lib/validation/exam-schema";

describe("gradeSingleChoice", () => {
  const question = { type: "single_choice" as const, points: 10, correctAnswer: "b" };

  it("awards full points for the correct option", () => {
    expect(gradeSingleChoice(question, "b")).toEqual({ isCorrect: true, autoScore: 10 });
  });

  it("awards zero for an incorrect option", () => {
    expect(gradeSingleChoice(question, "a")).toEqual({ isCorrect: false, autoScore: 0 });
  });

  it("awards zero when unanswered", () => {
    expect(gradeSingleChoice(question, null)).toEqual({ isCorrect: false, autoScore: 0 });
  });
});

describe("gradeMultipleChoice", () => {
  const question = { type: "multiple_choice" as const, points: 15, correctAnswers: ["a", "b", "d"] };

  it("awards full points for an exact match regardless of order", () => {
    expect(gradeMultipleChoice(question, ["d", "a", "b"])).toEqual({ isCorrect: true, autoScore: 15 });
  });

  it("awards zero when missing one correct option (no partial credit)", () => {
    expect(gradeMultipleChoice(question, ["a", "b"])).toEqual({ isCorrect: false, autoScore: 0 });
  });

  it("awards zero when an extra incorrect option is selected", () => {
    expect(gradeMultipleChoice(question, ["a", "b", "d", "c"])).toEqual({ isCorrect: false, autoScore: 0 });
  });

  it("awards zero when unanswered", () => {
    expect(gradeMultipleChoice(question, undefined)).toEqual({ isCorrect: false, autoScore: 0 });
  });
});

describe("toStudentQuestion", () => {
  it("strips answer-key fields from single_choice questions", () => {
    const question: QuestionInput = {
      id: "q1",
      type: "single_choice",
      statement: "¿...?",
      points: 10,
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      correctAnswer: "b",
    };
    const safe = toStudentQuestion(question) as Record<string, unknown>;
    expect(safe.correctAnswer).toBeUndefined();
    expect(safe.id).toBe("q1");
    expect(safe.options).toEqual(question.options);
  });

  it("strips expectedSolution and rubric from code questions", () => {
    const question: QuestionInput = {
      id: "q3",
      type: "code",
      statement: "Implemente...",
      points: 25,
      language: "javascript",
      expectedSolution: "function factorial(n) {}",
      rubric: "Debe usar recursividad",
      enableAiEvaluation: true,
    };
    const safe = toStudentQuestion(question) as Record<string, unknown>;
    expect(safe.expectedSolution).toBeUndefined();
    expect(safe.rubric).toBeUndefined();
    expect(safe.language).toBe("javascript");
  });
});
