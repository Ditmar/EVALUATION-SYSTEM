import { describe, expect, it } from "vitest";
import { parsePlaceholder } from "@/lib/laboratory/parse-placeholder";
import { detectImageFormat, formatFileSize, imageTooLargeMessage, normalizeImageFormat } from "@/lib/laboratory/image-upload";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("detectImageFormat", () => {
  it("recognizes known formats by their magic bytes", () => {
    expect(detectImageFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(detectImageFormat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(detectImageFormat(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("gif");
    expect(detectImageFormat(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe("webp");
  });

  it("rejects anything else, including SVG and renamed files", () => {
    expect(detectImageFormat(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageFormat(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(detectImageFormat(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("image question placeholder", () => {
  it("defaults to 1 MB, every format and manual grading", () => {
    const result = parsePlaceholder({ id: "img", type: "image", points: "5" });
    expect(result).toEqual({
      question: expect.objectContaining({ id: "img", type: "image", maxSizeMb: 1, formats: ["jpg", "png", "gif", "webp"], evaluator: "manual" }),
    });
  });

  it("reads max-size and formats (jpeg as an alias of jpg)", () => {
    const result = parsePlaceholder({ id: "img", type: "image", points: "5", "max-size": "2.5", formats: "PNG|jpeg" });
    expect(result).toEqual({ question: expect.objectContaining({ maxSizeMb: 2.5, formats: ["png", "jpg"] }) });
  });

  it.each([["0"], ["-1"], ["abc"], ["50"]])("rejects max-size=%s", (size) => {
    const result = parsePlaceholder({ id: "img", type: "image", points: "5", "max-size": size });
    expect("errors" in result).toBe(true);
  });

  it("rejects unknown formats and non-manual evaluators", () => {
    expect("errors" in parsePlaceholder({ id: "img", type: "image", points: "5", formats: "png|svg" })).toBe(true);
    expect("errors" in parsePlaceholder({ id: "img", type: "image", points: "5", evaluator: "ai" })).toBe(true);
    expect("errors" in parsePlaceholder({ id: "img", type: "image", points: "5", evaluator: "automatic" })).toBe(true);
  });
});

describe("helpers", () => {
  it("formats sizes and builds the too-large message", () => {
    expect(formatFileSize(512 * 1024)).toBe("512 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1 MB");
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe("2.4 MB");
    expect(imageTooLargeMessage(2.4 * 1024 * 1024, 1)).toContain("2.4 MB y el máximo permitido es 1 MB");
    expect(normalizeImageFormat("JPEG")).toBe("jpg");
    expect(normalizeImageFormat("bmp")).toBeNull();
  });
});
