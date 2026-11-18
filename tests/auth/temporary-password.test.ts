import { describe, expect, it } from "vitest";
import { generateTemporaryPassword, normalizeTemporaryPassword } from "@/lib/auth/temporary-password";

describe("generateTemporaryPassword", () => {
  it("has the form LLLL-NNNN without ambiguous letters", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateTemporaryPassword()).toMatch(/^[A-HJ-NP-Z]{4}-\d{4}$/);
    }
  });

  it("varies between calls", () => {
    const values = new Set(Array.from({ length: 200 }, () => generateTemporaryPassword()));
    expect(values.size).toBeGreaterThan(190);
  });
});

describe("normalizeTemporaryPassword", () => {
  it("uppercases and trims", () => {
    expect(normalizeTemporaryPassword("  kmtr-4821 ")).toBe("KMTR-4821");
  });
});
