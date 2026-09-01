import { describe, expect, it } from "vitest";
import { renderMarkdownText } from "@/lib/laboratory/render-markdown-text";

describe("renderMarkdownText", () => {
  it("returns an empty array for blank input", () => {
    expect(renderMarkdownText("")).toEqual([]);
    expect(renderMarkdownText("   \n  ")).toEqual([]);
  });

  it("parses a plain paragraph", () => {
    const nodes = renderMarkdownText("Hola mundo.");
    expect(nodes).toEqual([{ type: "paragraph", children: [{ type: "text", value: "Hola mundo." }] }]);
  });

  it("parses bold, italic, and inline code", () => {
    const nodes = renderMarkdownText("Aplica **Dependency Inversion** y *justifica* con `código`.");
    expect(nodes).toHaveLength(1);
    const paragraph = nodes[0];
    expect(paragraph.type).toBe("paragraph");
    if (paragraph.type !== "paragraph") return;
    expect(paragraph.children.some((n) => n.type === "strong")).toBe(true);
    expect(paragraph.children.some((n) => n.type === "emphasis")).toBe(true);
    expect(paragraph.children.some((n) => n.type === "inlineCode")).toBe(true);
  });

  it("parses a bullet list", () => {
    const nodes = renderMarkdownText("- Antes: acoplado\n- Ahora: desacoplado");
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: "list", ordered: false });
  });

  it("never produces a labAnswer node — free text has no placeholders", () => {
    const nodes = renderMarkdownText('Esto no es un placeholder: {{answer id="q1" type="text" points="1"}}');
    const serialized = JSON.stringify(nodes);
    expect(serialized).not.toContain("labAnswer");
  });

  it("silently drops an unsupported construct instead of throwing", () => {
    expect(() => renderMarkdownText("<div>html crudo</div>")).not.toThrow();
  });
});
