import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, CodeEvaluationInput, CodeEvaluationResult } from "./provider";

const MODEL = process.env.AI_MODEL || "claude-sonnet-5";

function getClient(): Anthropic {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_API_KEY no está configurado en el entorno.");
  }
  return new Anthropic({ apiKey });
}

function buildPrompt(input: CodeEvaluationInput): string {
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

function extractJsonPayload(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

export class AnthropicProvider implements AiProvider {
  async evaluateCodeAnswer(input: CodeEvaluationInput): Promise<CodeEvaluationResult> {
    const client = getClient();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(input) }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    if (!textBlock) {
      throw new Error("La evaluación con IA no devolvió contenido de texto.");
    }

    const parsed = JSON.parse(extractJsonPayload(textBlock.text)) as {
      score: number;
      feedback: string;
    };

    return {
      suggestedScore: Math.max(0, Math.min(input.maxPoints, Number(parsed.score) || 0)),
      feedback: String(parsed.feedback ?? ""),
      raw: response,
      model: MODEL,
    };
  }
}

export function getAiProvider(): AiProvider {
  return new AnthropicProvider();
}
