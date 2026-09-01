import https from "node:https";
import OpenAI from "openai";
import type {
  AiProvider,
  CodeEvaluationInput,
  CodeEvaluationResult,
  TextEvaluationInput,
  TextEvaluationResult,
} from "./provider";
import { buildEvaluationPrompt, buildTextEvaluationPrompt, clampScore, extractJsonPayload, parseConfidence, parseEvidence } from "./prompt";

const MODEL = process.env.AI_MODEL || "gpt-4o-mini";

// keepAlive: false evita que se reutilicen sockets del pool del SDK. En hosts
// como Railway el NAT de salida puede cerrar una conexión keep-alive inactiva
// sin avisar; el siguiente request la reutiliza y falla con "Premature close".
// Sin keep-alive cada llamada abre una conexión nueva, eliminando ese caso.
const httpAgent = new https.Agent({ keepAlive: false });

function getClient(): OpenAI {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_API_KEY no está configurado en el entorno.");
  }
  return new OpenAI({ apiKey, httpAgent });
}

async function chatJson(client: OpenAI, prompt: string): Promise<{ text: string; response: OpenAI.Chat.Completions.ChatCompletion }> {
  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Responde únicamente con un objeto JSON válido, sin texto adicional." },
      { role: "user", content: prompt },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("La evaluación con IA no devolvió contenido de texto.");
  }
  return { text, response };
}

export class OpenAiProvider implements AiProvider {
  async evaluateCodeAnswer(input: CodeEvaluationInput): Promise<CodeEvaluationResult> {
    const client = getClient();
    const { text, response } = await chatJson(client, buildEvaluationPrompt(input));
    const parsed = JSON.parse(extractJsonPayload(text)) as { score: number; feedback: string };

    return {
      suggestedScore: clampScore(parsed.score, input.maxPoints),
      feedback: String(parsed.feedback ?? ""),
      raw: response,
      model: MODEL,
    };
  }

  async evaluateTextAnswer(input: TextEvaluationInput): Promise<TextEvaluationResult> {
    const client = getClient();
    const { text, response } = await chatJson(client, buildTextEvaluationPrompt(input));
    const parsed = JSON.parse(extractJsonPayload(text)) as { score: number; feedback: string; evidence?: unknown; confidence?: unknown };

    return {
      suggestedScore: clampScore(parsed.score, input.maxPoints),
      feedback: String(parsed.feedback ?? ""),
      evidence: parseEvidence(parsed.evidence),
      confidence: parseConfidence(parsed.confidence),
      raw: response,
      model: MODEL,
    };
  }
}
