import Anthropic from "@anthropic-ai/sdk";
import type {
  AiProvider,
  CodeEvaluationInput,
  CodeEvaluationResult,
  TextEvaluationInput,
  TextEvaluationResult,
} from "./provider";
import { buildEvaluationPrompt, buildTextEvaluationPrompt, clampScore, extractJsonPayload, parseAiLikelihood, parseConfidence, parseEvidence } from "./prompt";

const MODEL = process.env.AI_MODEL || "claude-sonnet-5";

function getClient(): Anthropic {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_API_KEY no está configurado en el entorno.");
  }
  return new Anthropic({ apiKey });
}

function firstTextBlock(response: Anthropic.Message): string {
  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  if (!textBlock) {
    throw new Error("La evaluación con IA no devolvió contenido de texto.");
  }
  return textBlock.text;
}

export class AnthropicProvider implements AiProvider {
  async evaluateCodeAnswer(input: CodeEvaluationInput): Promise<CodeEvaluationResult> {
    const client = getClient();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildEvaluationPrompt(input) }],
    });

    const parsed = JSON.parse(extractJsonPayload(firstTextBlock(response))) as {
      score: number;
      feedback: string;
    };

    return {
      suggestedScore: clampScore(parsed.score, input.maxPoints),
      feedback: String(parsed.feedback ?? ""),
      raw: response,
      model: MODEL,
    };
  }

  async evaluateTextAnswer(input: TextEvaluationInput): Promise<TextEvaluationResult> {
    const client = getClient();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildTextEvaluationPrompt(input) }],
    });

    const parsed = JSON.parse(extractJsonPayload(firstTextBlock(response))) as {
      score: number;
      feedback: string;
      evidence?: unknown;
      confidence?: unknown;
      aiLikelihood?: unknown;
    };

    return {
      suggestedScore: clampScore(parsed.score, input.maxPoints),
      feedback: String(parsed.feedback ?? ""),
      evidence: parseEvidence(parsed.evidence),
      confidence: parseConfidence(parsed.confidence),
      aiLikelihood: parseAiLikelihood(parsed.aiLikelihood),
      raw: response,
      model: MODEL,
    };
  }
}
