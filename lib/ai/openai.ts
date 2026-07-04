import https from "node:https";
import OpenAI from "openai";
import type { AiProvider, CodeEvaluationInput, CodeEvaluationResult } from "./provider";
import { buildEvaluationPrompt, clampScore, extractJsonPayload } from "./prompt";

const MODEL = process.env.AI_MODEL || "gpt-4o-mini";

// keepAlive: false evita que se reutilicen sockets del pool del SDK. En hosts
// como Railway el NAT de salida puede cerrar una conexión keep-alive inactiva
// sin avisar; el siguiente request la reutiliza y falla con "Premature close".
// Sin keep-alive cada llamada abre una conexión nueva, eliminando ese caso.
const httpAgent = new https.Agent({ keepAlive: false });

export class OpenAiProvider implements AiProvider {
  async evaluateCodeAnswer(input: CodeEvaluationInput): Promise<CodeEvaluationResult> {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      throw new Error("AI_API_KEY no está configurado en el entorno.");
    }
    const client = new OpenAI({ apiKey, httpAgent });

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
