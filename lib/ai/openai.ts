import OpenAI from "openai";
import type { AiProvider, CodeEvaluationInput, CodeEvaluationResult } from "./provider";
import { buildEvaluationPrompt, clampScore, extractJsonPayload } from "./prompt";

const MODEL = process.env.AI_MODEL || "gpt-4o-mini";

export class OpenAiProvider implements AiProvider {
  async evaluateCodeAnswer(input: CodeEvaluationInput): Promise<CodeEvaluationResult> {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      throw new Error("AI_API_KEY no está configurado en el entorno.");
    }
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Responde únicamente con un objeto JSON válido, sin texto adicional." },
        { role: "user", content: buildEvaluationPrompt(input) },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error("La evaluación con IA no devolvió contenido de texto.");
    }

    const parsed = JSON.parse(extractJsonPayload(text)) as { score: number; feedback: string };

    return {
      suggestedScore: clampScore(parsed.score, input.maxPoints),
      feedback: String(parsed.feedback ?? ""),
      raw: response,
      model: MODEL,
    };
  }
}
