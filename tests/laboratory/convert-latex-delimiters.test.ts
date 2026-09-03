import { describe, expect, it } from "vitest";
import { convertLatexDelimiters } from "@/lib/laboratory/convert-latex-delimiters";

describe("convertLatexDelimiters", () => {
  it("translates \\[...\\] into $$...$$", () => {
    expect(convertLatexDelimiters("\\[\\frac{dx}{dt}\\]")).toBe("$$\\frac{dx}{dt}$$");
  });

  it("translates \\(...\\) into $...$", () => {
    expect(convertLatexDelimiters("velocidad \\(x^2\\) de cambio")).toBe("velocidad $x^2$ de cambio");
  });

  it("leaves already-dollar math and plain text untouched", () => {
    expect(convertLatexDelimiters("ya es $$x$$ y $y$ y texto normal")).toBe("ya es $$x$$ y $y$ y texto normal");
  });

  it("leaves the contents of a fenced code block untouched", () => {
    const source = "texto\n\n```\n\\[ \\frac{dx}{dt} \\]\n```\n\nmás texto \\(z\\)";
    expect(convertLatexDelimiters(source)).toBe("texto\n\n```\n\\[ \\frac{dx}{dt} \\]\n```\n\nmás texto $z$");
  });
});
