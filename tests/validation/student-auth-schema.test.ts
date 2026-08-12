import { describe, expect, it } from "vitest";
import { StudentActivateSchema, StudentLoginSchema } from "@/lib/validation/student-auth-schema";

describe("StudentActivateSchema", () => {
  it("accepts a valid ci + password", () => {
    expect(StudentActivateSchema.safeParse({ ci: "1234566", password: "supersecret" }).success).toBe(true);
  });

  it("rejects a short ci", () => {
    expect(StudentActivateSchema.safeParse({ ci: "12", password: "supersecret" }).success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(StudentActivateSchema.safeParse({ ci: "1234566", password: "short" }).success).toBe(false);
  });
});

describe("StudentLoginSchema", () => {
  it("accepts a valid ci + password", () => {
    expect(StudentLoginSchema.safeParse({ ci: "1234566", password: "x" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(StudentLoginSchema.safeParse({ ci: "1234566", password: "" }).success).toBe(false);
  });
});
