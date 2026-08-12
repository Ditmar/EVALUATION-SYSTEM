import { describe, expect, it } from "vitest";
import { parseStatement } from "@/lib/statement";

describe("parseStatement", () => {
  it("returns a single text segment when there is no code fence", () => {
    expect(parseStatement("¿Cuál es la complejidad de una búsqueda binaria?")).toEqual([
      { type: "text", content: "¿Cuál es la complejidad de una búsqueda binaria?" },
    ]);
  });

  it("extracts a fenced code block with its language", () => {
    const statement = "Observe el código:\n```java\nclass Animal {}\n```\n¿Qué se imprime?";
    expect(parseStatement(statement)).toEqual([
      { type: "text", content: "Observe el código:\n" },
      { type: "code", content: "class Animal {}", language: "java" },
      { type: "text", content: "\n¿Qué se imprime?" },
    ]);
  });

  it("defaults to javascript when the fence has no language hint", () => {
    const statement = "```\nconsole.log(1)\n```";
    expect(parseStatement(statement)).toEqual([
      { type: "code", content: "console.log(1)", language: "javascript" },
    ]);
  });

  it("supports multiple code blocks in one statement", () => {
    const statement = "Antes\n```python\nx = 1\n```\nEntre\n```python\ny = 2\n```\nDespués";
    expect(parseStatement(statement)).toEqual([
      { type: "text", content: "Antes\n" },
      { type: "code", content: "x = 1", language: "python" },
      { type: "text", content: "\nEntre\n" },
      { type: "code", content: "y = 2", language: "python" },
      { type: "text", content: "\nDespués" },
    ]);
  });
});
