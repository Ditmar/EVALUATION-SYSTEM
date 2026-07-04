import type { CodeEvaluationInput } from "./provider";

/**
 * Shared prompt-building and response-parsing so every AiProvider adapter
 * (Anthropic, OpenAI, ...) asks the same question and parses the answer the
 * same way — only the SDK call differs between adapters.
 */
export function buildEvaluationPrompt(input: CodeEvaluationInput): string {
  return [
    `Eres un asistente que ayuda a un docente a calificar la respuesta de un examen de programación en ${input.language}.`,
    `Responde ÚNICAMENTE con un objeto JSON de la forma exacta {"score": number, "feedback": string}.`,
    `El score debe estar entre 0 y ${input.maxPoints}.`,
    `El feedback debe ser breve (máximo 3 líneas), objetivo y en español.`,
    ``,
    `Enunciado: ${input.statement}`,
    input.expectedSolution ? `Solución de referencia:\n${input.expectedSolution}` : "",
    input.rubric ? `Rúbrica:\n${input.rubric}` : "",
    `Respuesta del estudiante:\n${input.studentCode}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function extractJsonPayload(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

export function clampScore(score: unknown, maxPoints: number): number {
  const parsed = Number(score);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(maxPoints, parsed));
}
