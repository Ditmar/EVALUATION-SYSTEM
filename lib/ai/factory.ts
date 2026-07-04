import type { AiProvider } from "./provider";
import { AnthropicProvider } from "./anthropic";
import { OpenAiProvider } from "./openai";

export const AI_PROVIDERS = ["anthropic", "openai"] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

/**
 * Inversion point: callers only ever depend on the `AiProvider` interface.
 * Which concrete adapter gets built is decided purely by the AI_PROVIDER
 * env var, so adding a new provider means adding one more `case` here and an
 * adapter file — nothing else in the app needs to change.
 */
export function getAiProvider(): AiProvider {
  const configured = (process.env.AI_PROVIDER || "anthropic").trim().toLowerCase();

  switch (configured) {
    case "anthropic":
      return new AnthropicProvider();
    case "openai":
      return new OpenAiProvider();
    default:
      throw new Error(
        `Proveedor de IA desconocido: "${configured}". Valores válidos para AI_PROVIDER: ${AI_PROVIDERS.join(", ")}.`
      );
  }
}
