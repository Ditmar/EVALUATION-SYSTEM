import { describe, expect, it } from "vitest";
import { generatePublicToken } from "@/lib/tokens";

describe("generatePublicToken", () => {
  it("produces a URL-safe string", () => {
    const token = generatePublicToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces tokens decoding to at least 24 bytes", () => {
    const token = generatePublicToken();
    const decoded = Buffer.from(token, "base64url");
    expect(decoded.length).toBeGreaterThanOrEqual(24);
  });

  it("produces unique tokens across many calls", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generatePublicToken()));
    expect(tokens.size).toBe(500);
  });
});
