import type { CodeEvaluationInput, EvidenceItem, TextEvaluationInput } from "./provider";

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

/**
 * Same JSON contract as `buildEvaluationPrompt`, for a free-text answer
 * graded against a rubric instead of code — this also covers `github-pr`
 * reviews: the caller just passes a formatted diff (see
 * `lib/laboratory/evaluation/repository-context.ts`) as `studentAnswer`,
 * this function has no idea the "answer" originated from GitHub.
 */
export function buildTextEvaluationPrompt(input: TextEvaluationInput): string {
  return [
    `Eres un asistente que ayuda a un docente a calificar la respuesta escrita de un estudiante en un laboratorio.`,
    `Responde ÚNICAMENTE con un objeto JSON de la forma exacta {"score": number, "feedback": string, "evidence": [{"file": string, "line": number, "reason": string}], "confidence": number, "aiLikelihood": number}.`,
    `El score debe estar entre 0 y ${input.maxPoints}.`,
    `El feedback debe ser breve (máximo 3 líneas), objetivo y en español.`,
    `"evidence" es opcional: si la respuesta del estudiante incluye cambios de código o archivos identificables, cita los archivos/líneas concretos que respaldan tu evaluación; si no aplica (una respuesta de texto simple), responde "evidence": [].`,
    `Si la respuesta incluye un diff de código, evalúa principalmente los cambios introducidos por el estudiante — no le atribuyas mérito a código que ya existía antes de sus cambios.`,
    `"confidence" es un número entre 0 y 1 que refleja tu propia certeza sobre el puntaje asignado.`,
    `"aiLikelihood" es un número entre 0 y 1 que refleja qué tan probable te parece que esta respuesta haya sido generada por una IA (p. ej. un chatbot) en lugar de redactada por el propio estudiante. Básate en señales como: lenguaje genérico o "de manual" que no hace referencia concreta a su propio código/repositorio; tono uniformemente formal/pulido inconsistente con el resto de sus respuestas; estructura tipo chatbot (encabezados, listas perfectas) para una simple justificación breve; ausencia de razonamiento específico ligado a las decisiones reales que tomó. Sé conservador: usa valores altos (>0.7) solo cuando la evidencia sea clara, no por el mero hecho de que la redacción sea buena.`,
    `Usa "aiLikelihood" para ajustar el "score" dentro del rango permitido: si crees que la respuesta fue probablemente generada por IA, reduce el score de forma proporcional a tu certeza y explica brevemente por qué en el feedback (sin inventar una regla numérica exacta, usa tu criterio). Si en cambio la respuesta se lee como genuinamente humana, coherente y con razonamiento propio ligado a su trabajo concreto, no apliques ninguna penalización y otorga el puntaje completo que merezca según la rúbrica — el score nunca debe superar ${input.maxPoints} en ningún caso.`,
    ``,
    `Pregunta: ${input.question}`,
    input.rubric ? `Rúbrica de calificación:\n${input.rubric}` : "",
    `Respuesta del estudiante:\n${input.studentAnswer}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Safely coerces the parsed JSON's `evidence` field — never trust a model's output shape blindly. */
export function parseEvidence(value: unknown): EvidenceItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      file: typeof item.file === "string" ? item.file : "",
      line: typeof item.line === "number" ? item.line : undefined,
      reason: typeof item.reason === "string" ? item.reason : "",
    }))
    .filter((item) => item.file || item.reason);
  return items.length > 0 ? items : undefined;
}

/** Clamps any parsed JSON field that's supposed to be a 0..1 number (self-reported by the model), or `undefined` if absent/invalid. */
function parseUnitInterval(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : undefined;
}

/** Safely coerces the parsed JSON's self-reported `confidence` field into a 0..1 number, or `undefined` if absent/invalid. */
export function parseConfidence(value: unknown): number | undefined {
  return parseUnitInterval(value);
}

/** Safely coerces the parsed JSON's self-reported `aiLikelihood` field into a 0..1 number, or `undefined` if absent/invalid. */
export function parseAiLikelihood(value: unknown): number | undefined {
  return parseUnitInterval(value);
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
