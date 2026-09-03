import { describe, expect, it } from "vitest";
import { parseLaboratory } from "@/lib/laboratory/parse-laboratory";
import type { LaboratoryNode, SingleChoiceQuestion } from "@/lib/laboratory/types";

function fixture(body: string, frontmatter = `---\nid: lab-1\ntitle: Laboratorio de prueba\n---\n`): string {
  return `${frontmatter}\n${body}`;
}

describe("parseLaboratory", () => {
  it("parses a valid laboratory into metadata + content + questions + rubrics", () => {
    const result = parseLaboratory(
      fixture(
        `# Intro\n\nExplique Dijkstra.\n\n{{answer id="q1" type="textarea" points="10" evaluator="ai"}}\n\n{{rubric for="q1"}}\nDebe mencionar pesos.\n{{/rubric}}\n`,
        `---\nid: lab-1\ntitle: Laboratorio de prueba\npoints: 10\n---\n`
      )
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.laboratory.metadata).toEqual({
      id: "lab-1",
      title: "Laboratorio de prueba",
      subject: undefined,
      version: 1,
      duration: undefined,
      points: 10,
      status: "draft",
    });
    expect(result.laboratory.questions).toHaveLength(1);
    expect(result.laboratory.questions[0]).toMatchObject({ id: "q1", type: "textarea", evaluator: "ai", points: 10 });
    expect(result.laboratory.rubrics).toEqual([{ for: "q1", content: "Debe mencionar pesos." }]);
    expect(result.warnings).toEqual([]);

    const headings = result.laboratory.content.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(1);
  });

  it("rejects duplicate question ids", () => {
    const result = parseLaboratory(
      fixture(`{{answer id="q2" type="text" points="5"}}\n\n{{answer id="q2" type="text" points="5"}}\n`)
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message === 'Duplicate question id: "q2".')).toBe(true);
  });

  it("rejects an invalid question type", () => {
    const result = parseLaboratory(fixture(`{{answer id="q1" type="dropdown" points="5"}}\n`));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain('type="dropdown"');
  });

  it('reports a descriptive error for single-choice without options', () => {
    const result = parseLaboratory(fixture(`{{answer id="q4" type="single-choice" points="5"}}\n`));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toBe('Question "q4" uses type="single-choice" but does not define options.');
  });

  it("infers evaluator=automatic for a number question with expected+tolerance", () => {
    const result = parseLaboratory(
      fixture(`{{answer id="distance" type="number" points="5" expected="1854.3" tolerance="0.5"}}\n`)
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.laboratory.questions[0]).toMatchObject({ evaluator: "automatic", expected: 1854.3, tolerance: 0.5 });
  });

  it("defaults evaluator=manual for a number question with no expected value", () => {
    const result = parseLaboratory(fixture(`{{answer id="distance" type="number" points="5"}}\n`));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.laboratory.questions[0].evaluator).toBe("manual");
  });

  it("attaches a valid rubric to its question", () => {
    const result = parseLaboratory(
      fixture(`{{answer id="q1" type="textarea" points="10"}}\n\n{{rubric for="q1"}}\nContenido de la rúbrica.\n{{/rubric}}\n`)
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.laboratory.rubrics).toEqual([{ for: "q1", content: "Contenido de la rúbrica." }]);
  });

  it("rejects a rubric that references a nonexistent question", () => {
    const result = parseLaboratory(
      fixture(`{{answer id="q1" type="textarea" points="10"}}\n\n{{rubric for="q20"}}\nTexto.\n{{/rubric}}\n`)
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message === 'Rubric references unknown question "q20".')).toBe(true);
  });

  it("parses multiple-choice options and correct answers as arrays", () => {
    const result = parseLaboratory(
      fixture(`{{answer id="q3" type="multiple-choice" options="BFS|DFS|Dijkstra|Prim" correct="BFS|DFS" points="10"}}\n`)
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.laboratory.questions[0]).toMatchObject({
      type: "multiple-choice",
      options: ["BFS", "DFS", "Dijkstra", "Prim"],
      correct: ["BFS", "DFS"],
      evaluator: "automatic",
    });
  });

  it("parses a code answer without attempting auto-execution, defaulting to manual", () => {
    const result = parseLaboratory(fixture(`{{answer id="q4" type="code" language="java" points="10"}}\n`));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.laboratory.questions[0]).toMatchObject({ type: "code", language: "java", evaluator: "manual" });
  });

  it("warns (but does not fail) when total question points differ from frontmatter points", () => {
    const result = parseLaboratory(
      fixture(`{{answer id="q1" type="text" points="5"}}\n`, `---\nid: lab-1\ntitle: T\npoints: 30\n---\n`)
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].message).toContain("(5)");
    expect(result.warnings[0].message).toContain("(30)");
  });

  it("keeps a placeholder inside a table cell, split correctly around surrounding text", () => {
    const result = parseLaboratory(
      fixture(
        `| Campo | Valor |\n|---|---|\n| Distancia | {{answer id="distance" type="number" points="3"}} |\n`
      )
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const table = result.laboratory.content.find((n) => n.type === "table");
    expect(table).toBeDefined();
    if (!table || table.type !== "table") return;

    const dataRow = table.children[1];
    expect(dataRow.type).toBe("tableRow");
    if (dataRow.type !== "tableRow") return;

    const valueCell = dataRow.children[1];
    expect(valueCell.type).toBe("tableCell");
    if (valueCell.type !== "tableCell") return;

    const kinds = valueCell.children.map((n: LaboratoryNode) => n.type);
    expect(kinds).toContain("labAnswer");
    expect(result.laboratory.questions.map((q) => q.id)).toContain("distance");
  });

  it("derives question context from the preceding top-level paragraph, for the AI evaluator prompt", () => {
    const result = parseLaboratory(
      fixture(`Explique por qué Dijkstra encuentra el camino mínimo.\n\n{{answer id="q1" type="textarea" points="10" evaluator="ai"}}\n`)
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.laboratory.questions[0].context).toBe("Explique por qué Dijkstra encuentra el camino mínimo.");
  });

  it("parses a valid github-pr question with its repository resource", () => {
    const result = parseLaboratory(
      fixture(
        `{{repository id="base-repository" provider="github" url="https://github.com/Ditmar/lab1-seminario" branch="main"}}\n\n{{answer id="solid-pr" type="github-pr" source="base-repository" points="35" evaluator="ai"}}\n`
      )
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.laboratory.repositories).toEqual([
      { id: "base-repository", provider: "github", url: "https://github.com/Ditmar/lab1-seminario", branch: "main" },
    ]);
    expect(result.laboratory.questions[0]).toMatchObject({ type: "github-pr", source: "base-repository", evaluator: "ai" });
    // {{repository}} is lab-level metadata, not renderable content.
    expect(result.laboratory.content.some((n) => JSON.stringify(n).includes("repository"))).toBe(false);
  });

  it('rejects a github-pr question missing "source"', () => {
    const result = parseLaboratory(fixture(`{{answer id="solid-pr" type="github-pr" points="35"}}\n`));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain('does not define "source"');
  });

  it("rejects a github-pr question whose source references an unknown repository", () => {
    const result = parseLaboratory(fixture(`{{answer id="solid-pr" type="github-pr" source="does-not-exist" points="35"}}\n`));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message === 'Question "solid-pr" references unknown repository "does-not-exist".')).toBe(true);
  });

  it("defaults a github-pr question's evaluator to manual", () => {
    const result = parseLaboratory(
      fixture(
        `{{repository id="base-repository" provider="github" url="https://github.com/org/repo"}}\n\n{{answer id="solid-pr" type="github-pr" source="base-repository" points="35"}}\n`
      )
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.laboratory.questions[0].evaluator).toBe("manual");
  });

  it("accepts evaluator=ai for a github-pr question", () => {
    const result = parseLaboratory(
      fixture(
        `{{repository id="base-repository" provider="github" url="https://github.com/org/repo"}}\n\n{{answer id="solid-pr" type="github-pr" source="base-repository" points="35" evaluator="ai"}}\n`
      )
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.laboratory.questions[0].evaluator).toBe("ai");
  });

  it("rejects evaluator=automatic for a github-pr question", () => {
    const result = parseLaboratory(
      fixture(
        `{{repository id="base-repository" provider="github" url="https://github.com/org/repo"}}\n\n{{answer id="solid-pr" type="github-pr" source="base-repository" points="35" evaluator="automatic"}}\n`
      )
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain('does not support evaluator="automatic"');
  });

  it("requires frontmatter id and title", () => {
    const result = parseLaboratory("---\nversion: 1\n---\n\nSin id ni title.\n");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message.includes('"id"'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('"title"'))).toBe(true);
  });

  it("rejects an unsupported Markdown construct instead of silently dropping it", () => {
    const result = parseLaboratory(fixture(`<div>html crudo no soportado</div>\n`));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain("no soportado");
  });

  it("resolves single-choice correctness data for grading, hidden from the raw question list order", () => {
    const result = parseLaboratory(
      fixture(`{{answer id="algo" type="single-choice" options="BFS|DFS|Dijkstra|Prim" correct="Dijkstra" points="5"}}\n`)
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const q = result.laboratory.questions[0] as SingleChoiceQuestion;
    expect(q.correct).toBe("Dijkstra");
    expect(q.evaluator).toBe("automatic");
  });

  it("parses $$...$$ / $...$ math into dedicated math/inlineMath nodes", () => {
    const result = parseLaboratory(fixture(`Fórmula en línea: $x^2$.\n\n$$\n\\frac{dx}{dt}\n$$\n`));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const paragraph = result.laboratory.content.find((n) => n.type === "paragraph");
    expect(paragraph).toBeDefined();
    if (paragraph?.type !== "paragraph") return;
    const inline = paragraph.children.find((n): n is Extract<LaboratoryNode, { type: "inlineMath" }> => n.type === "inlineMath");
    expect(inline?.value).toBe("x^2");

    const block = result.laboratory.content.find((n): n is Extract<LaboratoryNode, { type: "math" }> => n.type === "math");
    expect(block?.value.trim()).toBe("\\frac{dx}{dt}");
  });

  it("also accepts LaTeX-style \\(...\\) / \\[...\\] delimiters, translating them to the same math nodes", () => {
    const result = parseLaboratory(fixture(`Velocidad \\(x^2\\) de cambio.\n\n\\[\n\\frac{dx}{dt}\n\\]\n`));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const paragraph = result.laboratory.content.find((n) => n.type === "paragraph");
    if (paragraph?.type !== "paragraph") throw new Error("expected a paragraph");
    const inline = paragraph.children.find((n): n is Extract<LaboratoryNode, { type: "inlineMath" }> => n.type === "inlineMath");
    expect(inline?.value).toBe("x^2");

    const block = result.laboratory.content.find((n): n is Extract<LaboratoryNode, { type: "math" }> => n.type === "math");
    expect(block?.value.trim()).toBe("\\frac{dx}{dt}");
  });

  it("does not translate \\(...\\) / \\[...\\] found inside a fenced code block", () => {
    const result = parseLaboratory(fixture("Ejemplo de sintaxis LaTeX:\n\n```\n\\[ \\frac{dx}{dt} \\]\n```\n"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const hasMathNode = result.laboratory.content.some((n) => n.type === "math" || n.type === "inlineMath");
    expect(hasMathNode).toBe(false);
    const code = result.laboratory.content.find((n): n is Extract<LaboratoryNode, { type: "code" }> => n.type === "code");
    expect(code?.value.trim()).toBe("\\[ \\frac{dx}{dt} \\]");
  });
});
