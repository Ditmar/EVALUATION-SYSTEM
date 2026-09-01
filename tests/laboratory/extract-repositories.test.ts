import { describe, expect, it } from "vitest";
import { extractRepositories } from "@/lib/laboratory/extract-repositories";

describe("extractRepositories", () => {
  it("extracts a valid repository and strips it from the source", () => {
    const result = extractRepositories(
      `# Lab\n\n{{repository id="base-repository" provider="github" url="https://github.com/Ditmar/lab1-seminario" branch="main"}}\n\nResto del contenido.`
    );

    expect(result.errors).toEqual([]);
    expect(result.repositories).toEqual([
      { id: "base-repository", provider: "github", url: "https://github.com/Ditmar/lab1-seminario", branch: "main" },
    ]);
    expect(result.source).not.toContain("{{repository");
    expect(result.source).toContain("Resto del contenido.");
  });

  it("defaults branch to main when omitted", () => {
    const result = extractRepositories(`{{repository id="r1" provider="github" url="https://github.com/org/repo"}}`);
    expect(result.repositories[0].branch).toBe("main");
  });

  it("rejects a repository without a url", () => {
    const result = extractRepositories(`{{repository id="r1" provider="github"}}`);
    expect(result.errors.some((e) => e.message.includes('"url"'))).toBe(true);
  });

  it("rejects a duplicate repository id", () => {
    const result = extractRepositories(
      `{{repository id="r1" provider="github" url="https://github.com/org/repo"}}\n{{repository id="r1" provider="github" url="https://github.com/org/other"}}`
    );
    expect(result.errors.some((e) => e.message === 'Duplicate repository id: "r1".')).toBe(true);
  });

  it("rejects an unsupported provider", () => {
    const result = extractRepositories(`{{repository id="r1" provider="gitlab" url="https://gitlab.com/org/repo"}}`);
    expect(result.errors.some((e) => e.message.includes("gitlab"))).toBe(true);
  });

  it("rejects a non-GitHub url", () => {
    const result = extractRepositories(`{{repository id="r1" provider="github" url="https://example.com/org/repo"}}`);
    expect(result.errors.some((e) => e.message.includes("url de GitHub inválida"))).toBe(true);
  });
});
