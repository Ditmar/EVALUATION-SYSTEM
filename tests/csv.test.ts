import { describe, expect, it } from "vitest";
import { buildResultsCsv, type ResultsCsvRow } from "@/lib/csv";

const baseRow: ResultsCsvRow = {
  nombres: "Juan",
  apellidos: "Pérez",
  ci: "1234567",
  correo: "juan@example.com",
  status: "SUBMITTED",
  observedIp: "10.0.0.5",
  penaltyCount: 0,
  totalAutoScore: 25,
  totalManualScore: 25,
  totalScore: 50,
  startedAt: "2026-07-10T14:00:00.000Z",
  submittedAt: "2026-07-10T15:00:00.000Z",
};

describe("buildResultsCsv", () => {
  it("includes a header row", () => {
    const csv = buildResultsCsv([]);
    expect(csv.split("\r\n")[0]).toContain("Nombres");
  });

  it("renders a data row", () => {
    const csv = buildResultsCsv([baseRow]);
    expect(csv).toContain("Juan");
    expect(csv).toContain("1234567");
  });

  it("escapes fields containing commas", () => {
    const csv = buildResultsCsv([{ ...baseRow, apellidos: "Pérez, Gómez" }]);
    expect(csv).toContain('"Pérez, Gómez"');
  });

  it("escapes fields containing quotes", () => {
    const csv = buildResultsCsv([{ ...baseRow, nombres: 'Juan "El Rápido"' }]);
    expect(csv).toContain('"Juan ""El Rápido"""');
  });

  it("escapes fields containing newlines", () => {
    const csv = buildResultsCsv([{ ...baseRow, nombres: "Juan\nCarlos" }]);
    expect(csv).toContain('"Juan\nCarlos"');
  });

  it("renders an empty rows case as header-only", () => {
    const csv = buildResultsCsv([]);
    expect(csv.trim().split("\r\n")).toHaveLength(1);
  });
});
