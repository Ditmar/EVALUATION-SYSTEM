import { describe, expect, it } from "vitest";
import { resolveRunFiles, resolveStdin, formatFilesAsText } from "@/lib/code-runner/files";
import { normalizeIdeConfig } from "@/lib/code-runner/ide-config";
import type { IdeConfig } from "@/lib/code-runner/types";

function config(overrides: Partial<Parameters<typeof normalizeIdeConfig>[1]> = {}): IdeConfig {
  const result = normalizeIdeConfig("q", { language: "java", mode: "multi", ...overrides });
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.config;
}

describe("resolveRunFiles", () => {
  const withReadonly = config({
    files: [
      { name: "Main.java", content: "class Main {}" },
      { name: "Producto.java", content: "record Producto() {}", readonly: true },
    ],
  });

  it("puts the entry first and always takes read-only files from the config", () => {
    const result = resolveRunFiles(withReadonly, [
      { name: "Utils.java", content: "class Utils {}" },
      { name: "Main.java", content: "class Main { /* student */ }" },
      { name: "Producto.java", content: "HACKED" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.files.map((f) => f.name)).toEqual(["Main.java", "Utils.java", "Producto.java"]);
    expect(result.files.find((f) => f.name === "Producto.java")?.content).toBe("record Producto() {}");
  });

  it("rejects a missing entry file", () => {
    const result = resolveRunFiles(withReadonly, [{ name: "Utils.java", content: "" }]);
    expect(result.ok).toBe(false);
  });

  it("rejects unsafe names", () => {
    for (const name of ["../x.java", "a/b.java", ".hidden.java", "x.sh"]) {
      const result = resolveRunFiles(withReadonly, [{ name: "Main.java", content: "" }, { name, content: "" }]);
      expect(result.ok, name).toBe(false);
    }
  });

  it("rejects case-insensitive duplicates", () => {
    const result = resolveRunFiles(withReadonly, [
      { name: "Main.java", content: "" },
      { name: "utils.java", content: "" },
      { name: "Utils.java", content: "" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects new files when the question does not allow them", () => {
    const single = config({ mode: "single" });
    const result = resolveRunFiles(single, [{ name: "Main.java", content: "" }, { name: "Extra.java", content: "" }]);
    expect(result.ok).toBe(false);
  });

  it("enforces max-files including read-only files", () => {
    const small = config({ maxFiles: 2, files: [{ name: "Main.java", content: "" }, { name: "R.java", content: "", readonly: true }] });
    const result = resolveRunFiles(small, [{ name: "Main.java", content: "" }, { name: "B.java", content: "" }]);
    expect(result.ok).toBe(false);
  });

  it("enforces the per-file size limit", () => {
    const result = resolveRunFiles(withReadonly, [{ name: "Main.java", content: "x".repeat(65 * 1024) }]);
    expect(result.ok).toBe(false);
  });
});

describe("resolveStdin", () => {
  it("uses the question stdin when it is not editable", () => {
    const fixed = config({ stdin: "5", stdinEditable: false });
    expect(resolveStdin(fixed, "999")).toEqual({ ok: true, stdin: "5" });
  });

  it("uses the student's stdin when editable, falling back to the default", () => {
    const editable = config({ stdin: "5" });
    expect(resolveStdin(editable, "7")).toEqual({ ok: true, stdin: "7" });
    expect(resolveStdin(editable, undefined)).toEqual({ ok: true, stdin: "5" });
  });
});

describe("formatFilesAsText", () => {
  it("keeps a single file as-is and labels multiple files", () => {
    expect(formatFilesAsText([{ name: "main.py", content: "print(1)" }])).toBe("print(1)");
    expect(formatFilesAsText([{ name: "a.py", content: "1" }, { name: "b.py", content: "2" }])).toBe("// ===== a.py =====\n1\n\n// ===== b.py =====\n2");
  });
});
