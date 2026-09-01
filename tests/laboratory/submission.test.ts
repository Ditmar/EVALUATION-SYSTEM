import { describe, expect, it } from "vitest";
import { computeTotalScore, mergeAnswer } from "@/lib/laboratory/submission";

describe("mergeAnswer", () => {
  it("adds a new field into an empty answers map", () => {
    expect(mergeAnswer(undefined, "q1", "Dijkstra")).toEqual({ q1: "Dijkstra" });
  });

  it("merges a field without clobbering existing ones", () => {
    const existing = { q1: "Dijkstra", q2: 42 };
    expect(mergeAnswer(existing, "q3", ["BFS", "DFS"])).toEqual({ q1: "Dijkstra", q2: 42, q3: ["BFS", "DFS"] });
  });

  it("overwrites only the targeted field", () => {
    const existing = { q1: "Dijkstra", q2: 42 };
    expect(mergeAnswer(existing, "q1", "Prim")).toEqual({ q1: "Prim", q2: 42 });
  });
});

describe("computeTotalScore", () => {
  it("returns 0 for an empty or missing grading map", () => {
    expect(computeTotalScore(undefined)).toBe(0);
    expect(computeTotalScore({})).toBe(0);
  });

  it("sums finalScore across questions, treating pending (null) as 0", () => {
    const grading = {
      q1: { evaluator: "automatic" as const, status: "correct" as const, finalScore: 5 },
      q2: { evaluator: "manual" as const, status: "pending_review" as const, finalScore: null },
      q3: { evaluator: "manual" as const, status: "correct" as const, finalScore: 8 },
    };
    expect(computeTotalScore(grading)).toBe(13);
  });
});
