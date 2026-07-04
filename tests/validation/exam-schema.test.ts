import { describe, expect, it } from "vitest";
import { ExamImportSchema } from "@/lib/validation/exam-schema";

const validExam = {
  metadata: {
    title: "Primer Parcial de Programación II",
    career: "Ingeniería de Sistemas",
    academicTerm: "Gestión 2026",
    subject: "Programación II",
    examDate: "2026-07-10",
    durationMinutes: 90,
    instructions: "Lea cuidadosamente cada pregunta antes de responder.",
    evaluationType: "Examen parcial",
  },
  settings: {
    maxPenalties: 3,
    onMaxPenalties: "auto_submit",
    trackFocusEvents: true,
    monitorExternalIps: true,
    differentIpPolicy: "warn_only",
    allowAiCodeEvaluation: true,
  },
  questions: [
    {
      id: "q1",
      type: "single_choice",
      statement: "¿Cuál es la complejidad temporal de una búsqueda binaria?",
      points: 10,
      options: [
        { id: "a", text: "O(n)" },
        { id: "b", text: "O(log n)" },
        { id: "c", text: "O(n²)" },
        { id: "d", text: "O(1)" },
      ],
      correctAnswer: "b",
    },
    {
      id: "q2",
      type: "multiple_choice",
      statement: "Seleccione las estructuras de datos lineales.",
      points: 15,
      options: [
        { id: "a", text: "Pila" },
        { id: "b", text: "Cola" },
        { id: "c", text: "Árbol binario" },
        { id: "d", text: "Lista enlazada" },
      ],
      correctAnswers: ["a", "b", "d"],
    },
    {
      id: "q3",
      type: "code",
      statement: "Implemente una función recursiva para calcular el factorial de un número.",
      points: 25,
      language: "javascript",
      expectedSolution: "function factorial(n) { ... }",
      rubric: "Debe usar recursividad, manejar el caso base y devolver el valor correcto.",
      enableAiEvaluation: true,
    },
  ],
};

describe("ExamImportSchema", () => {
  it("parses a valid exam contract", () => {
    const result = ExamImportSchema.safeParse(validExam);
    expect(result.success).toBe(true);
  });

  it("applies default settings when settings is omitted", () => {
    const { settings, ...rest } = validExam;
    const result = ExamImportSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.settings.maxPenalties).toBe(3);
      expect(result.data.settings.onMaxPenalties).toBe("auto_submit");
    }
  });

  it("rejects malformed examDate", () => {
    const bad = { ...validExam, metadata: { ...validExam.metadata, examDate: "10/07/2026" } };
    const result = ExamImportSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects missing required metadata fields", () => {
    const { title, ...restMetadata } = validExam.metadata;
    const bad = { ...validExam, metadata: restMetadata };
    const result = ExamImportSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects single_choice correctAnswer not referencing an existing option", () => {
    const bad = structuredClone(validExam);
    (bad.questions[0] as any).correctAnswer = "z";
    const result = ExamImportSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects multiple_choice correctAnswers referencing unknown option ids", () => {
    const bad = structuredClone(validExam);
    (bad.questions[1] as any).correctAnswers = ["a", "z"];
    const result = ExamImportSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate question ids", () => {
    const bad = structuredClone(validExam);
    (bad.questions[1] as any).id = "q1";
    const result = ExamImportSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("requires a valid language enum for code questions", () => {
    const bad = structuredClone(validExam);
    (bad.questions[2] as any).language = "python";
    const result = ExamImportSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects an exam with zero questions", () => {
    const bad = { ...validExam, questions: [] };
    const result = ExamImportSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
