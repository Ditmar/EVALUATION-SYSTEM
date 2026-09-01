import { describe, expect, it, vi } from "vitest";
import type { TextareaQuestion } from "@/lib/laboratory/types";

const evaluateTextAnswer = vi.fn().mockResolvedValue({
  suggestedScore: 8,
  feedback: "Buena explicación, falta mencionar la actualización de vecinos.",
  raw: { mocked: true },
  model: "mock-model",
});

vi.mock("@/lib/ai/factory", () => ({
  getAiProvider: () => ({ evaluateTextAnswer, evaluateCodeAnswer: vi.fn() }),
}));

describe("evaluateWithAi", () => {
  it("shapes the provider's suggestion as {score, maxScore, feedback}, without a fabricated confidence", async () => {
    const { evaluateWithAi } = await import("@/lib/laboratory/evaluation/ai");

    const question: TextareaQuestion = { id: "q1", type: "textarea", points: 10, required: true, evaluator: "ai" };
    const suggestion = await evaluateWithAi(question, "¿Por qué Dijkstra encuentra el camino mínimo?", "Debe mencionar pesos.", "Porque siempre elige el nodo con menor distancia acumulada.");

    expect(evaluateTextAnswer).toHaveBeenCalledWith({
      question: "¿Por qué Dijkstra encuentra el camino mínimo?",
      rubric: "Debe mencionar pesos.",
      studentAnswer: "Porque siempre elige el nodo con menor distancia acumulada.",
      maxPoints: 10,
    });
    expect(suggestion).toEqual({
      score: 8,
      maxScore: 10,
      feedback: "Buena explicación, falta mencionar la actualización de vecinos.",
      raw: { mocked: true },
      model: "mock-model",
    });
    expect(suggestion.confidence).toBeUndefined();
  });
});
