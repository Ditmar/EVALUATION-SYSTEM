import { describe, expect, it } from "vitest";
import { planRosterRow } from "@/lib/roster-import-plan";

const row = { ci: "1234566", nombres: "Davinia", apellidos: "Castro Loredo", materia: "Programación II" };

describe("planRosterRow", () => {
  it("creates a new student with passwordHash null when none exists", () => {
    expect(planRosterRow(null, row)).toEqual({
      action: "create",
      fields: { ci: "1234566", nombres: "Davinia", apellidos: "Castro Loredo", passwordHash: null },
    });
  });

  it("updates nombres/apellidos for an existing, not-yet-activated student", () => {
    expect(planRosterRow({ ci: "1234566", passwordHash: null }, row)).toEqual({
      action: "update",
      fields: { nombres: "Davinia", apellidos: "Castro Loredo" },
    });
  });

  it("updates nombres/apellidos without touching passwordHash for an already-activated student", () => {
    const plan = planRosterRow({ ci: "1234566", passwordHash: "hashed" }, row);
    expect(plan.action).toBe("update");
    expect(plan.fields).not.toHaveProperty("passwordHash");
    expect(plan.fields).toEqual({ nombres: "Davinia", apellidos: "Castro Loredo" });
  });
});
