import { describe, expect, it } from "vitest";
import { planRosterRow } from "@/lib/roster-import-plan";

const row = { ci: "1234566", nombres: "Davinia", apellidos: "Castro Loredo", materia: "Programación II" };
const rowWithEmail = { ...row, correo: "davinia@example.com" };

describe("planRosterRow", () => {
  it("creates a new student with passwordHash null and correo null when none provided", () => {
    expect(planRosterRow(null, row)).toEqual({
      action: "create",
      fields: { ci: "1234566", nombres: "Davinia", apellidos: "Castro Loredo", correo: null, passwordHash: null },
    });
  });

  it("creates a new student with the provided correo", () => {
    expect(planRosterRow(null, rowWithEmail)).toEqual({
      action: "create",
      fields: {
        ci: "1234566",
        nombres: "Davinia",
        apellidos: "Castro Loredo",
        correo: "davinia@example.com",
        passwordHash: null,
      },
    });
  });

  it("updates nombres/apellidos for an existing, not-yet-activated student", () => {
    expect(planRosterRow({ ci: "1234566", passwordHash: null }, row)).toEqual({
      action: "update",
      fields: { nombres: "Davinia", apellidos: "Castro Loredo" },
    });
  });

  it("does not include correo in an update when the row omits it, so it never blanks out an existing value", () => {
    const plan = planRosterRow({ ci: "1234566", passwordHash: null }, row);
    expect(plan.fields).not.toHaveProperty("correo");
  });

  it("includes correo in an update when the row provides one", () => {
    const plan = planRosterRow({ ci: "1234566", passwordHash: null }, rowWithEmail);
    expect(plan.fields).toEqual({ nombres: "Davinia", apellidos: "Castro Loredo", correo: "davinia@example.com" });
  });

  it("updates nombres/apellidos without touching passwordHash for an already-activated student", () => {
    const plan = planRosterRow({ ci: "1234566", passwordHash: "hashed" }, row);
    expect(plan.action).toBe("update");
    expect(plan.fields).not.toHaveProperty("passwordHash");
    expect(plan.fields).toEqual({ nombres: "Davinia", apellidos: "Castro Loredo" });
  });
});
