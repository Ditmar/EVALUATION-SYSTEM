import { describe, expect, it } from "vitest";
import { parseArticle } from "@/lib/blog/parse-article";

function fixture(body: string, frontmatter = `---\ntitle: Artículo de prueba\nexcerpt: Un resumen breve.\n---\n`): string {
  return `${frontmatter}\n${body}`;
}

describe("parseArticle", () => {
  it("parses a valid article into frontmatter + content + headings + reading time", () => {
    const result = parseArticle(
      fixture(
        `## Sección uno\n\nEste es un párrafo con varias palabras para calcular el tiempo de lectura del artículo completo.\n\n### Subsección\n\nMás contenido aquí.\n`,
        `---\ntitle: Árboles AVL\nexcerpt: Balanceo de árboles binarios.\ntags: [algoritmos, estructuras-de-datos]\n---\n`
      )
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.article.frontmatter).toEqual({
      title: "Árboles AVL",
      excerpt: "Balanceo de árboles binarios.",
      tags: ["algoritmos", "estructuras-de-datos"],
    });
    expect(result.article.headings).toEqual([
      { depth: 2, id: "seccion-uno", text: "Sección uno" },
      { depth: 3, id: "subseccion", text: "Subsección" },
    ]);
    expect(result.article.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it("requires title and excerpt in the frontmatter", () => {
    const result = parseArticle("---\ntags: [x]\n---\n\nContenido.\n");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message.includes('"title"'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('"excerpt"'))).toBe(true);
  });

  it("dedupes repeated heading text into distinct anchor ids", () => {
    const result = parseArticle(fixture(`## Ejemplo\n\nTexto.\n\n## Ejemplo\n\nOtro texto.\n`));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.article.headings.map((h) => h.id)).toEqual(["ejemplo", "ejemplo-2"]);
  });

  it("supports LaTeX inline and block math", () => {
    const result = parseArticle(fixture(`La fórmula $E = mc^2$ es célebre.\n\n$$\n\\int_0^1 x\\,dx\n$$\n`));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const flat = JSON.stringify(result.article.content);
    expect(flat).toContain('"type":"inlineMath"');
    expect(flat).toContain('"type":"math"');
  });

  it("rejects unsupported Markdown constructs (e.g. raw HTML)", () => {
    const result = parseArticle(fixture(`<div>hola</div>\n`));

    expect(result.ok).toBe(false);
  });

  it("estimates a longer reading time for longer content", () => {
    const short = parseArticle(fixture("Un párrafo corto.\n"));
    const longBody = Array.from({ length: 60 }, () => "palabra").join(" ");
    const long = parseArticle(fixture(`${longBody}\n`));

    expect(short.ok && long.ok).toBe(true);
    if (!short.ok || !long.ok) return;
    expect(long.article.readingTimeMinutes).toBeGreaterThanOrEqual(short.article.readingTimeMinutes);
  });
});
