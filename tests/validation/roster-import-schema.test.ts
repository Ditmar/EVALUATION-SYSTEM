import { describe, expect, it } from "vitest";
import { RosterImportSchema } from "@/lib/validation/roster-import-schema";

describe("RosterImportSchema", () => {
  it("accepts a valid roster", () => {
    const result = RosterImportSchema.safeParse({
      entries: [{ ci: "1234566", nombres: "Davinia", apellidos: "Castro Loredo", materia: "Programación II" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an entry missing materia", () => {
    const result = RosterImportSchema.safeParse({
      entries: [{ ci: "1234566", nombres: "Davinia", apellidos: "Castro Loredo" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty entries array", () => {
    const result = RosterImportSchema.safeParse({ entries: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a ci shorter than 3 characters", () => {
    const result = RosterImportSchema.safeParse({
      entries: [{ ci: "12", nombres: "Davinia", apellidos: "Castro Loredo", materia: "Programación II" }],
    });
    expect(result.success).toBe(false);
  });

  it("allows duplicate ci within one payload (last entry wins via upsert)", () => {
    const result = RosterImportSchema.safeParse({
      entries: [
        { ci: "1234566", nombres: "Davinia", apellidos: "Castro Loredo", materia: "Programación II" },
        { ci: "1234566", nombres: "Davinia", apellidos: "Castro Loredo", materia: "Programación III" },
      ],
    });
    expect(result.success).toBe(true);
  });
});
