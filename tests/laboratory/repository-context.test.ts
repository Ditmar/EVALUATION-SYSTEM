import { describe, expect, it } from "vitest";
import { formatDiffForPrompt } from "@/lib/laboratory/evaluation/repository-context";
import type { RepositoryDiff } from "@/lib/github/types";

const repo = {
  baseOwner: "Ditmar",
  baseRepo: "lab1-seminario",
  baseBranch: "main",
  headOwner: "student",
  headRepo: "lab1-seminario",
  headBranch: "refactor/solid",
  pullRequestNumber: 4,
  commitsCount: 7,
};

describe("formatDiffForPrompt", () => {
  it("includes the repo header and each file's patch", () => {
    const diff: RepositoryDiff = {
      baseSha: "base123",
      headSha: "head456",
      files: [{ filename: "src/OrderService.ts", status: "modified", additions: 23, deletions: 41, changes: 64, patch: "@@ -1,3 +1,3 @@" }],
    };

    const text = formatDiffForPrompt(diff, repo);
    expect(text).toContain("Ditmar/lab1-seminario");
    expect(text).toContain("student/lab1-seminario");
    expect(text).toContain("Pull Request #4");
    expect(text).toContain("base123");
    expect(text).toContain("head456");
    expect(text).toContain("src/OrderService.ts");
    expect(text).toContain("@@ -1,3 +1,3 @@");
  });

  it("excludes noise paths like node_modules and lockfiles", () => {
    const diff: RepositoryDiff = {
      baseSha: "a",
      headSha: "b",
      files: [
        { filename: "node_modules/foo/index.js", status: "modified", additions: 1, deletions: 1, changes: 2, patch: "noise" },
        { filename: "package-lock.json", status: "modified", additions: 1, deletions: 1, changes: 2, patch: "noise" },
        { filename: "src/real-change.ts", status: "modified", additions: 5, deletions: 0, changes: 5, patch: "real" },
      ],
    };

    const text = formatDiffForPrompt(diff, repo);
    expect(text).not.toContain("node_modules");
    expect(text).not.toContain("package-lock.json");
    expect(text).toContain("src/real-change.ts");
    expect(text).toContain("excluidos");
  });

  it("truncates a patch larger than the size cap", () => {
    const hugePatch = "x".repeat(25000);
    const diff: RepositoryDiff = {
      baseSha: "a",
      headSha: "b",
      files: [{ filename: "src/big.ts", status: "modified", additions: 1000, deletions: 0, changes: 1000, patch: hugePatch }],
    };

    const text = formatDiffForPrompt(diff, repo);
    expect(text).toContain("truncado por límite de tamaño");
    expect(text.length).toBeLessThan(hugePatch.length + 2000);
  });

  it("notes how many extra files were omitted beyond the per-request file cap", () => {
    const files = Array.from({ length: 30 }, (_, i) => ({
      filename: `src/file-${i}.ts`,
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: "x",
    }));
    const diff: RepositoryDiff = { baseSha: "a", headSha: "b", files };

    const text = formatDiffForPrompt(diff, repo);
    expect(text).toContain("archivo(s) adicionales no incluidos");
  });
});
