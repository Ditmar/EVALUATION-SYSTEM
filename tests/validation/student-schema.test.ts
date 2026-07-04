import { describe, expect, it } from "vitest";
import { StudentRegistrationSchema } from "@/lib/validation/student-schema";

const valid = {
  nombres: "Juan",
  apellidos: "Pérez",
  ci: "1234567",
  correo: "juan.perez@example.com",
  acceptTerms: true as const,
};

describe("StudentRegistrationSchema", () => {
  it("parses a valid registration", () => {
    expect(StudentRegistrationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = StudentRegistrationSchema.safeParse({ ...valid, correo: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty CI", () => {
    const result = StudentRegistrationSchema.safeParse({ ...valid, ci: "" });
    expect(result.success).toBe(false);
  });

  it("rejects when acceptTerms is false", () => {
    const result = StudentRegistrationSchema.safeParse({ ...valid, acceptTerms: false });
    expect(result.success).toBe(false);
  });

  it("rejects when acceptTerms is missing", () => {
    const { acceptTerms, ...rest } = valid;
    const result = StudentRegistrationSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("trims whitespace from names", () => {
    const result = StudentRegistrationSchema.safeParse({ ...valid, nombres: "  Juan  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.nombres).toBe("Juan");
  });
});
