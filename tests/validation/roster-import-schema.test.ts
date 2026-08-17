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

  it("accepts an entry without correo (optional)", () => {
    const result = RosterImportSchema.safeParse({
      entries: [{ ci: "1234566", nombres: "Davinia", apellidos: "Castro Loredo", materia: "Programación II" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entries[0].correo).toBeUndefined();
    }
  });

  it("normalizes correo to lowercase and trims it", () => {
    const result = RosterImportSchema.safeParse({
      entries: [
        {
          ci: "1234566",
          nombres: "Davinia",
          apellidos: "Castro Loredo",
          correo: "  Davinia@Example.com  ",
          materia: "Programación II",
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entries[0].correo).toBe("davinia@example.com");
    }
  });

  it("treats an empty-string correo as absent instead of rejecting it", () => {
    const result = RosterImportSchema.safeParse({
      entries: [{ ci: "1234566", nombres: "Davinia", apellidos: "Castro Loredo", correo: "", materia: "Programación II" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entries[0].correo).toBeUndefined();
    }
  });

  it("rejects a malformed correo", () => {
    const result = RosterImportSchema.safeParse({
      entries: [
        { ci: "1234566", nombres: "Davinia", apellidos: "Castro Loredo", correo: "not-an-email", materia: "Programación II" },
      ],
    });
    expect(result.success).toBe(false);
  });
});
