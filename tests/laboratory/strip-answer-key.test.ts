import { describe, expect, it } from "vitest";
import { stripAnswerKey, toStudentLaboratory } from "@/lib/laboratory/strip-answer-key";
import type { GitHubPullRequestQuestion, LaboratoryDefinition, NumberQuestion, SingleChoiceQuestion } from "@/lib/laboratory/types";

describe("stripAnswerKey", () => {
  it("removes correct/expected/tolerance from a question", () => {
    const question: NumberQuestion = {
      id: "distance",
      type: "number",
      points: 5,
      required: true,
      evaluator: "automatic",
      expected: 1854.3,
      tolerance: 0.5,
    };

    const safe = stripAnswerKey(question) as Record<string, unknown>;
    expect(safe.expected).toBeUndefined();
    expect(safe.tolerance).toBeUndefined();
    expect(safe.id).toBe("distance");
    expect(safe.points).toBe(5);
  });

  it("removes correct from a single-choice question", () => {
    const question: SingleChoiceQuestion = {
      id: "algo",
      type: "single-choice",
      points: 5,
      required: true,
      evaluator: "automatic",
      options: ["BFS", "Dijkstra"],
      correct: "Dijkstra",
    };

    const safe = stripAnswerKey(question) as Record<string, unknown>;
    expect(safe.correct).toBeUndefined();
    expect(safe.options).toEqual(["BFS", "Dijkstra"]);
  });

  it("keeps a github-pr question's shape intact (no answer-key fields to strip)", () => {
    const question: GitHubPullRequestQuestion = {
      id: "solid-pr",
      type: "github-pr",
      points: 35,
      required: true,
      evaluator: "ai",
      source: "base-repository",
    };

    const safe = stripAnswerKey(question) as Record<string, unknown>;
    expect(safe.source).toBe("base-repository");
    expect(safe.type).toBe("github-pr");
    expect(safe.evaluator).toBe("ai");
  });
});

describe("toStudentLaboratory", () => {
  it("never includes rubrics in the student-facing payload, but keeps repositories", () => {
    const laboratory: LaboratoryDefinition = {
      metadata: { id: "lab-1", title: "T", version: 1, status: "draft" },
      content: [],
      questions: [
        { id: "q1", type: "textarea", points: 10, required: true, evaluator: "ai" },
      ],
      rubrics: [{ for: "q1", content: "Rúbrica secreta que no debe llegar al estudiante." }],
      repositories: [{ id: "base-repository", provider: "github", url: "https://github.com/org/repo", branch: "main" }],
    };

    const safe = toStudentLaboratory(laboratory) as unknown as Record<string, unknown>;
    expect(safe.rubrics).toBeUndefined();
    expect(safe.questions).toHaveLength(1);
    expect(safe.repositories).toEqual(laboratory.repositories);
  });
});
