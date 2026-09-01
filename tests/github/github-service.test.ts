import { describe, expect, it, vi, beforeEach } from "vitest";

const mockOctokit = {
  pulls: { get: vi.fn() },
  repos: { getBranch: vi.fn(), compareCommitsWithBasehead: vi.fn() },
};

vi.mock("@/lib/github/client", () => ({
  getGitHubClient: () => mockOctokit,
}));

describe("parsePullRequestUrl", () => {
  it("extracts owner/repo/number from a valid PR url", async () => {
    const { parsePullRequestUrl } = await import("@/lib/github/github-service");
    expect(parsePullRequestUrl("https://github.com/student/lab1-seminario/pull/5")).toEqual({
      owner: "student",
      repo: "lab1-seminario",
      number: 5,
    });
  });

  it("returns null for a non-PR url", async () => {
    const { parsePullRequestUrl } = await import("@/lib/github/github-service");
    expect(parsePullRequestUrl("https://github.com/student/lab1-seminario")).toBeNull();
    expect(parsePullRequestUrl("not a url")).toBeNull();
  });
});

describe("getPullRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  function mockPrResponse(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      data: {
        number: 4,
        state: "open",
        merged: false,
        title: "Refactor SOLID",
        base: { ref: "main", sha: "base-sha", repo: { owner: { login: "Ditmar" }, name: "lab1-seminario" } },
        head: { ref: "refactor/solid", sha: "head-sha", label: "student:refactor/solid", repo: { owner: { login: "student" }, name: "lab1-seminario" } },
        commits: 7,
        changed_files: 14,
        additions: 223,
        deletions: 118,
        ...overrides,
      },
    };
  }

  it("maps the Octokit response into a PullRequestSummary", async () => {
    mockOctokit.pulls.get.mockResolvedValue(mockPrResponse());
    const { getPullRequest } = await import("@/lib/github/github-service");

    const pr = await getPullRequest("Ditmar", "lab1-seminario", 4);
    expect(pr).toEqual({
      number: 4,
      state: "open",
      title: "Refactor SOLID",
      base: { owner: "Ditmar", repo: "lab1-seminario", branch: "main", sha: "base-sha" },
      head: { owner: "student", repo: "lab1-seminario", branch: "refactor/solid", sha: "head-sha" },
      commits: 7,
      changedFiles: 14,
      additions: 223,
      deletions: 118,
    });
  });

  it("reports merged over closed when both are true", async () => {
    mockOctokit.pulls.get.mockResolvedValue(mockPrResponse({ state: "closed", merged: true }));
    const { getPullRequest } = await import("@/lib/github/github-service");
    const pr = await getPullRequest("Ditmar", "lab1-seminario", 4);
    expect(pr.state).toBe("merged");
  });

  it("throws a descriptive error when the PR does not exist", async () => {
    mockOctokit.pulls.get.mockRejectedValue({ status: 404 });
    const { getPullRequest } = await import("@/lib/github/github-service");
    await expect(getPullRequest("Ditmar", "lab1-seminario", 999)).rejects.toThrow(/no encontrado/);
  });
});

describe("validateAgainstBaseRepository", () => {
  const basePr = {
    number: 4,
    state: "open" as const,
    title: "x",
    base: { owner: "Ditmar", repo: "lab1-seminario", branch: "main", sha: "base-sha" },
    head: { owner: "student", repo: "lab1-seminario", branch: "refactor/solid", sha: "head-sha" },
    commits: 1,
    changedFiles: 1,
    additions: 1,
    deletions: 0,
  };

  it("accepts a PR whose base matches the configured repository", async () => {
    const { validateAgainstBaseRepository } = await import("@/lib/github/github-service");
    expect(() => validateAgainstBaseRepository(basePr, "Ditmar", "lab1-seminario")).not.toThrow();
  });

  it("rejects a PR targeting a different repository", async () => {
    const { validateAgainstBaseRepository } = await import("@/lib/github/github-service");
    expect(() => validateAgainstBaseRepository(basePr, "otro-owner", "otro-repo")).toThrow(/no está dirigido/);
  });

  it("rejects a merged PR", async () => {
    const { validateAgainstBaseRepository } = await import("@/lib/github/github-service");
    expect(() => validateAgainstBaseRepository({ ...basePr, state: "merged" }, "Ditmar", "lab1-seminario")).toThrow(/fusionado/);
  });

  it("rejects a closed PR", async () => {
    const { validateAgainstBaseRepository } = await import("@/lib/github/github-service");
    expect(() => validateAgainstBaseRepository({ ...basePr, state: "closed" }, "Ditmar", "lab1-seminario")).toThrow(/cerrado/);
  });
});

describe("getBranchHeadSha", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves the head sha of a branch", async () => {
    mockOctokit.repos.getBranch.mockResolvedValue({ data: { commit: { sha: "73ac901" } } });
    const { getBranchHeadSha } = await import("@/lib/github/github-service");
    expect(await getBranchHeadSha("Ditmar", "lab1-seminario", "main")).toBe("73ac901");
  });
});

describe("getCompareDiff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps the compare response into a RepositoryDiff", async () => {
    mockOctokit.repos.compareCommitsWithBasehead.mockResolvedValue({
      data: {
        files: [
          { filename: "src/OrderService.ts", status: "modified", additions: 23, deletions: 41, changes: 64, patch: "@@ ... @@" },
        ],
      },
    });
    const { getCompareDiff } = await import("@/lib/github/github-service");

    const diff = await getCompareDiff("Ditmar", "lab1-seminario", "base-sha", "student", "head-sha");
    expect(diff.baseSha).toBe("base-sha");
    expect(diff.headSha).toBe("head-sha");
    expect(diff.files).toHaveLength(1);
    expect(mockOctokit.repos.compareCommitsWithBasehead).toHaveBeenCalledWith({
      owner: "Ditmar",
      repo: "lab1-seminario",
      basehead: "base-sha...student:head-sha",
    });
  });
});
