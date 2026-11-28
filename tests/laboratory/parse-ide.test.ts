import { describe, expect, it } from "vitest";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import { extractStarterFiles } from "@/lib/laboratory/extract-files";
import type { IdeQuestion } from "@/lib/laboratory/types";

function fixture(body: string): string {
  return `---\nid: lab-ide\ntitle: Lab IDE\n---\n\n${body}`;
}

function onlyQuestion(body: string): IdeQuestion {
  const result = parseLaboratory(fixture(body));
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.laboratory.questions[0] as IdeQuestion;
}

const FENCE = "```";

describe('{{answer type="ide"}}', () => {
  it("applies per-language defaults when only language is given", () => {
    const q = onlyQuestion(`Escriba fib.\n\n{{answer id="fib" type="ide" language="python" points="10"}}\n`);
    expect(q).toMatchObject({
      type: "ide",
      language: "python",
      mode: "single",
      entry: "main.py",
      starterFiles: [{ name: "main.py", content: "" }],
      allowNewFiles: false,
      maxFiles: 10,
      stdin: "",
      stdinEditable: true,
      runEnabled: true,
      autocomplete: false,
      evaluator: "manual",
    });
  });

  it("accepts aliases and defaults Java/TypeScript entries", () => {
    expect(onlyQuestion(`{{answer id="a" type="ide" language="java" points="1"}}`).entry).toBe("Main.java");
    expect(onlyQuestion(`{{answer id="a" type="ide" language="ts" points="1"}}`)).toMatchObject({ language: "typescript", entry: "main.ts" });
  });

  it("reads starter files (with readonly) from a {{files}} block and keeps them out of the content", () => {
    const md = `{{answer id="inv" type="ide" language="java" mode="multi" points="15"}}

{{files for="inv"}}
${FENCE}java file="Main.java"
public class Main {
    public static void main(String[] args) { System.out.println(new Inventario().total()); }
}
${FENCE}

${FENCE}java file="Inventario.java"
public class Inventario { int total() { return 0; } }
${FENCE}

${FENCE}java file="Producto.java" readonly="true"
public record Producto(String nombre) {}
${FENCE}
{{/files}}
`;
    const result = parseLaboratory(fixture(md));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const q = result.laboratory.questions[0] as IdeQuestion;
    expect(q.mode).toBe("multi");
    expect(q.allowNewFiles).toBe(true);
    expect(q.starterFiles.map((f) => [f.name, Boolean(f.readonly)])).toEqual([
      ["Main.java", false],
      ["Inventario.java", false],
      ["Producto.java", true],
    ]);
    expect(q.starterFiles[0].content).toContain("System.out.println");
    expect(JSON.stringify(result.laboratory.content)).not.toContain("Inventario");
  });

  it("turns a literal \\n in stdin into a newline", () => {
    expect(onlyQuestion(`{{answer id="a" type="ide" language="python" points="1" stdin="3\\n4"}}`).stdin).toBe("3\n4");
  });

  it("rejects an unknown language", () => {
    const result = parseLaboratory(fixture(`{{answer id="a" type="ide" language="cobol" points="1"}}`));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain("language");
  });

  it('rejects evaluator="automatic" in v1', () => {
    const result = parseLaboratory(fixture(`{{answer id="a" type="ide" language="python" points="1" evaluator="automatic"}}`));
    expect(result.ok).toBe(false);
  });

  it("requires the entry file among the starter files", () => {
    const md = `{{answer id="a" type="ide" language="python" points="1"}}\n\n{{files for="a"}}\n${FENCE}python file="utils.py"\nx = 1\n${FENCE}\n{{/files}}\n`;
    const result = parseLaboratory(fixture(md));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message.includes("main.py"))).toBe(true);
  });

  it('rejects two editable files in mode="single"', () => {
    const md = `{{answer id="a" type="ide" language="python" points="1"}}\n\n{{files for="a"}}\n${FENCE}python file="main.py"\n${FENCE}\n\n${FENCE}python file="utils.py"\n${FENCE}\n{{/files}}\n`;
    const result = parseLaboratory(fixture(md));
    expect(result.ok).toBe(false);
  });

  it("rejects path traversal and wrong extensions in file names", () => {
    for (const name of ["../etc.py", "dir/main.py", "main.js"]) {
      const md = `{{answer id="a" type="ide" language="python" mode="multi" points="1"}}\n\n{{files for="a"}}\n${FENCE}python file="main.py"\n${FENCE}\n\n${FENCE}python file="${name}"\n${FENCE}\n{{/files}}\n`;
      expect(parseLaboratory(fixture(md)).ok, name).toBe(false);
    }
  });

  it("rejects {{files}} pointing at a missing or non-ide question", () => {
    const missing = parseLaboratory(fixture(`{{files for="nope"}}\n${FENCE}python file="main.py"\n${FENCE}\n{{/files}}\n`));
    expect(missing.ok).toBe(false);
    const wrongType = parseLaboratory(
      fixture(`{{answer id="t" type="textarea" points="1"}}\n\n{{files for="t"}}\n${FENCE}python file="main.py"\n${FENCE}\n{{/files}}\n`)
    );
    expect(wrongType.ok).toBe(false);
  });

  it("warns when a Java public class does not match its file name", () => {
    const md = `{{answer id="a" type="ide" language="java" points="1"}}\n\n{{files for="a"}}\n${FENCE}java file="Main.java"\npublic class Principal {}\n${FENCE}\n{{/files}}\n`;
    const result = parseLaboratory(fixture(md));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((w) => w.message.includes("Principal.java"))).toBe(true);
  });

  it("does not let code inside {{files}} be mistaken for an {{answer}} placeholder", () => {
    const md = `{{answer id="a" type="ide" language="python" points="1"}}\n\n{{files for="a"}}\n${FENCE}python file="main.py"\nprint("{{answer id=\\"fake\\" type=\\"text\\" points=\\"1\\"}}")\n${FENCE}\n{{/files}}\n`;
    const result = parseLaboratory(fixture(md));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.laboratory.questions.map((q) => q.id)).toEqual(["a"]);
  });
});

describe("extractStarterFiles", () => {
  it("accepts an empty file body and ~~~ fences", () => {
    const { declarations, errors } = extractStarterFiles(`{{files for="a"}}\n~~~python file="main.py"\n~~~\n{{/files}}`);
    expect(errors).toEqual([]);
    expect(declarations[0].files).toEqual([{ name: "main.py", content: "" }]);
  });

  it("reports a fence without file=", () => {
    const { errors } = extractStarterFiles(`{{files for="a"}}\n${FENCE}python\nx\n${FENCE}\n{{/files}}`);
    expect(errors[0].message).toContain('file="Nombre.ext"');
  });
});
