import { describe, expect, it } from "vitest";
import { evaluate } from "@/lib/laboratory/evaluation/engine";
import type {
  BooleanQuestion,
  MultipleChoiceQuestion,
  NumberQuestion,
  QuestionDefinition,
  SingleChoiceQuestion,
  TextQuestion,
  TextareaQuestion,
} from "@/lib/laboratory/types";

describe("evaluate — exact match (text)", () => {
  const question: TextQuestion = { id: "q1", type: "text", points: 5, required: true, evaluator: "automatic", correct: "Dijkstra" };

  it("awards full points on an exact match", () => {
    expect(evaluate(question, "Dijkstra")).toMatchObject({ status: "correct", score: 5, maxScore: 5 });
  });

  it("awards zero on a mismatch", () => {
    expect(evaluate(question, "Prim")).toMatchObject({ status: "incorrect", score: 0 });
  });
});

describe("evaluate — numeric tolerance", () => {
  const question: NumberQuestion = { id: "q2", type: "number", points: 5, required: true, evaluator: "automatic", expected: 1854.3, tolerance: 0.5 };

  it("is correct exactly at the tolerance boundary", () => {
    expect(evaluate(question, 1854.8)).toMatchObject({ status: "correct", score: 5 });
    expect(evaluate(question, 1853.8)).toMatchObject({ status: "correct", score: 5 });
  });

  it("is incorrect just outside the tolerance boundary", () => {
    expect(evaluate(question, 1854.81)).toMatchObject({ status: "incorrect", score: 0 });
  });
});

describe("evaluate — boolean", () => {
  const question: BooleanQuestion = { id: "q3", type: "boolean", points: 5, required: true, evaluator: "automatic", correct: true };

  it("matches the expected boolean", () => {
    expect(evaluate(question, true)).toMatchObject({ status: "correct", score: 5 });
    expect(evaluate(question, false)).toMatchObject({ status: "incorrect", score: 0 });
  });
});

describe("evaluate — single-choice", () => {
  const question: SingleChoiceQuestion = {
    id: "q4",
    type: "single-choice",
    points: 5,
    required: true,
    evaluator: "automatic",
    options: ["BFS", "DFS", "Dijkstra", "Prim"],
    correct: "Dijkstra",
  };

  it("awards full points for the correct option", () => {
    expect(evaluate(question, "Dijkstra")).toMatchObject({ status: "correct", score: 5 });
  });

  it("awards zero for any other option", () => {
    expect(evaluate(question, "BFS")).toMatchObject({ status: "incorrect", score: 0 });
  });
});

describe("evaluate — multiple-choice (all-or-nothing)", () => {
  const question: MultipleChoiceQuestion = {
    id: "q5",
    type: "multiple-choice",
    points: 10,
    required: true,
    evaluator: "automatic",
    options: ["BFS", "DFS", "Dijkstra", "Prim"],
    correct: ["BFS", "DFS"],
  };

  it("awards full points for an exact set match regardless of order", () => {
    expect(evaluate(question, ["DFS", "BFS"])).toMatchObject({ status: "correct", score: 10 });
  });

  it("awards zero for a partial overlap (missing one correct option)", () => {
    expect(evaluate(question, ["BFS"])).toMatchObject({ status: "incorrect", score: 0 });
  });

  it("awards zero for an exact-plus-extra selection", () => {
    expect(evaluate(question, ["BFS", "DFS", "Prim"])).toMatchObject({ status: "incorrect", score: 0 });
  });
});

describe("evaluate — manual", () => {
  const question: TextareaQuestion = { id: "q6", type: "textarea", points: 10, required: true, evaluator: "manual" };

  it("is always pending_review with a null score", () => {
    expect(evaluate(question, "cualquier respuesta")).toEqual({
      status: "pending_review",
      score: null,
      maxScore: 10,
      evaluator: "manual",
    });
  });
});

describe("evaluate — ai", () => {
  const question: TextareaQuestion = { id: "q7", type: "textarea", points: 10, required: true, evaluator: "ai" };

  it("is pending_review synchronously — the real suggestion comes from evaluateWithAi", () => {
    expect(evaluate(question, "respuesta")).toEqual({
      status: "pending_review",
      score: null,
      maxScore: 10,
      evaluator: "ai",
    });
  });
});

describe("evaluate — automatic requested on a type with no deterministic rule", () => {
  it("falls back to manual pending review instead of guessing", () => {
    const question: QuestionDefinition = { id: "q8", type: "textarea", points: 10, required: true, evaluator: "automatic" };
    expect(evaluate(question, "x")).toMatchObject({ status: "pending_review", score: null, evaluator: "manual" });
  });
});
