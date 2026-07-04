import { afterEach, describe, expect, it } from "vitest";
import { getAiProvider } from "@/lib/ai/factory";
import { AnthropicProvider } from "@/lib/ai/anthropic";
import { OpenAiProvider } from "@/lib/ai/openai";

const ORIGINAL_AI_PROVIDER = process.env.AI_PROVIDER;

afterEach(() => {
  process.env.AI_PROVIDER = ORIGINAL_AI_PROVIDER;
});

describe("getAiProvider", () => {
  it("defaults to Anthropic when AI_PROVIDER is unset", () => {
    delete process.env.AI_PROVIDER;
    expect(getAiProvider()).toBeInstanceOf(AnthropicProvider);
  });

  it("returns the Anthropic adapter when AI_PROVIDER=anthropic", () => {
    process.env.AI_PROVIDER = "anthropic";
    expect(getAiProvider()).toBeInstanceOf(AnthropicProvider);
  });

  it("returns the OpenAI adapter when AI_PROVIDER=openai", () => {
    process.env.AI_PROVIDER = "openai";
    expect(getAiProvider()).toBeInstanceOf(OpenAiProvider);
  });

  it("is case-insensitive and trims whitespace", () => {
    process.env.AI_PROVIDER = "  OpenAI  ";
    expect(getAiProvider()).toBeInstanceOf(OpenAiProvider);
  });

  it("throws a clear error for an unknown provider name", () => {
    process.env.AI_PROVIDER = "gemini";
    expect(() => getAiProvider()).toThrow(/Proveedor de IA desconocido/);
  });
});
