import { afterEach, describe, expect, it, vi } from "vitest";
import { executeOnPiston, PistonUnavailableError } from "@/lib/code-runner/piston-client";
import { JAVA_LAUNCHER_FILE, javaMainClass } from "@/lib/code-runner/java-launcher";
import { COMPILE_BEGIN as JAVA_COMPILE_BEGIN, COMPILE_END as JAVA_COMPILE_END } from "@/lib/code-runner/launcher-protocol";
import { TS_LAUNCHER_FILE } from "@/lib/code-runner/ts-launcher";

function mockPiston(response: unknown, status = 200) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(response), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof mockPiston>) {
  const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return JSON.parse(call[1].body as string);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("executeOnPiston", () => {
  it("sends the pinned runtime and server limits, never client-chosen ones", async () => {
    vi.stubEnv("PISTON_URL", "http://piston:2000/");
    vi.stubEnv("PISTON_PYTHON_VERSION", "3.12.0");
    const fetchMock = mockPiston({ language: "python", version: "3.12.0", run: { stdout: "hola\n", stderr: "", code: 0, signal: null } });

    const result = await executeOnPiston({ language: "python", files: [{ name: "main.py", content: "print('hola')" }], stdin: "" });

    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("http://piston:2000/api/v2/execute");
    const body = sentBody(fetchMock);
    expect(body).toMatchObject({ language: "python", version: "3.12.0", run_timeout: 3000, run_memory_limit: 256 * 1024 * 1024 });
    expect(result).toMatchObject({ status: "ok", stdout: "hola\n", exitCode: 0, version: "3.12.0" });
  });

  it("sends a bearer token when PISTON_AUTH_TOKEN is set", async () => {
    vi.stubEnv("PISTON_AUTH_TOKEN", "secret");
    const fetchMock = mockPiston({ language: "python", version: "3.12.0", run: { stdout: "", stderr: "", code: 0 } });
    await executeOnPiston({ language: "python", files: [{ name: "main.py", content: "" }], stdin: "" });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
  });

  it("prepends the Java launcher and gives Java extra time for in-process compilation", async () => {
    const fetchMock = mockPiston({ language: "java", version: "15.0.2", run: { stdout: "", stderr: "", code: 0 } });
    await executeOnPiston({
      language: "java",
      files: [
        { name: "Main.java", content: "public class Main {}" },
        { name: "Utils.java", content: "class Utils {}" },
      ],
      stdin: "",
    });
    const body = sentBody(fetchMock);
    expect(body.files.map((f: { name: string }) => f.name)).toEqual([JAVA_LAUNCHER_FILE, "Main.java", "Utils.java"]);
    expect(body.files[0].content).toContain('"Main.java", "Utils.java"');
    expect(body.run_timeout).toBeGreaterThan(3000);
  });

  it("reports launcher-wrapped javac diagnostics as a compile error", async () => {
    mockPiston({
      language: "java",
      version: "15.0.2",
      run: { stdout: "", stderr: `${JAVA_COMPILE_BEGIN}Main.java:1: error: ';' expected\n${JAVA_COMPILE_END}`, code: 97 },
    });
    const result = await executeOnPiston({ language: "java", files: [{ name: "Main.java", content: "x" }], stdin: "" });
    expect(result.status).toBe("compile_error");
    expect(result.compile?.output).toContain("';' expected");
    expect(result.stderr).toBe("");
  });

  it("sends TypeScript as one launcher file embedding the student's files", async () => {
    const fetchMock = mockPiston({ language: "typescript", version: "5.0.3", run: { stdout: "", stderr: "", code: 0 } });
    await executeOnPiston({
      language: "typescript",
      files: [
        { name: "main.ts", content: 'import { f } from "./utils";' },
        { name: "utils.ts", content: "export const f = 1;" },
      ],
      stdin: "",
    });
    const body = sentBody(fetchMock);
    expect(body.files.map((f: { name: string }) => f.name)).toEqual([TS_LAUNCHER_FILE]);
    expect(body.files[0].content).toContain('"name":"utils.ts"');
    expect(body.files[0].content).toContain('var entry = "main.ts"');
  });

  it("explains javac 15's cryptic error for records", async () => {
    mockPiston({
      language: "java",
      version: "15.0.2",
      run: { stdout: "", stderr: `${JAVA_COMPILE_BEGIN}Main.java:1: error: cannot find symbol
  symbol:   class record
${JAVA_COMPILE_END}`, code: 97 },
    });
    const result = await executeOnPiston({ language: "java", files: [{ name: "Main.java", content: "" }], stdin: "" });
    expect(result.compile?.output).toContain("Java 15");
  });

  it("reports launcher-wrapped tsc diagnostics as a compile error", async () => {
    mockPiston({
      language: "typescript",
      version: "5.0.3",
      run: { stdout: "", stderr: `${JAVA_COMPILE_BEGIN}utils.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.
${JAVA_COMPILE_END}`, code: 97 },
    });
    const result = await executeOnPiston({ language: "typescript", files: [{ name: "main.ts", content: "" }], stdin: "" });
    expect(result.status).toBe("compile_error");
    expect(result.compile?.output).toContain("TS2322");
  });

  it("reports a failing compile stage (tsc)", async () => {
    mockPiston({
      language: "typescript",
      version: "5.0.3",
      compile: { stdout: "main.ts(1,7): error TS2322", stderr: "", output: "main.ts(1,7): error TS2322", code: 2 },
      run: { stdout: "", stderr: "", code: null },
    });
    const result = await executeOnPiston({ language: "typescript", files: [{ name: "main.ts", content: "" }], stdin: "" });
    expect(result.status).toBe("compile_error");
    expect(result.compile?.output).toContain("TS2322");
  });

  it("classifies a SIGKILL as timeout and a non-zero exit as runtime error", async () => {
    mockPiston({ language: "python", version: "3.12.0", run: { stdout: "", stderr: "", code: null, signal: "SIGKILL", status: "TO" } });
    expect((await executeOnPiston({ language: "python", files: [{ name: "main.py", content: "" }], stdin: "" })).status).toBe("timeout");

    mockPiston({ language: "python", version: "3.12.0", run: { stdout: "", stderr: "Traceback", code: 1, signal: null } });
    expect((await executeOnPiston({ language: "python", files: [{ name: "main.py", content: "" }], stdin: "" })).status).toBe("runtime_error");
  });

  it("classifies an OOM kill (exit 137 at the memory limit) as memory", async () => {
    mockPiston({
      language: "python",
      version: "3.12.0",
      run: { stdout: "", stderr: "Killed", code: 137, signal: null, status: "RE", memory: 268432000 },
    });
    expect((await executeOnPiston({ language: "python", files: [{ name: "main.py", content: "" }], stdin: "" })).status).toBe("memory");
  });

  it("strips ANSI codes and truncates huge output", async () => {
    vi.stubEnv("CODE_RUN_MAX_OUTPUT_KB", "1");
    mockPiston({ language: "python", version: "3.12.0", run: { stdout: "\u001b[31mrojo\u001b[0m" + "x".repeat(5000), stderr: "", code: 0 } });
    const result = await executeOnPiston({ language: "python", files: [{ name: "main.py", content: "" }], stdin: "" });
    expect(result.stdout.startsWith("rojo")).toBe(true);
    expect(result.stdout.length).toBe(1024);
    expect(result.truncated).toBe(true);
  });

  it("throws PistonUnavailableError when Piston is down or errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(executeOnPiston({ language: "python", files: [{ name: "main.py", content: "" }], stdin: "" })).rejects.toBeInstanceOf(PistonUnavailableError);

    mockPiston({ message: "runtime is unknown" }, 400);
    await expect(executeOnPiston({ language: "python", files: [{ name: "main.py", content: "" }], stdin: "" })).rejects.toBeInstanceOf(PistonUnavailableError);
  });
});

describe("javaMainClass", () => {
  it("honors a package declaration", () => {
    expect(javaMainClass({ name: "Main.java", content: "public class Main {}" })).toBe("Main");
    expect(javaMainClass({ name: "Main.java", content: "package app.core;\npublic class Main {}" })).toBe("app.core.Main");
  });
});
