import { describe, expect, it } from "vitest";
import { evaluateRefreshRotation, type RefreshTokenRow } from "@/lib/auth/student-refresh-rotation";

const now = new Date("2026-08-12T00:00:00.000Z");

function row(overrides: Partial<RefreshTokenRow> = {}): RefreshTokenRow {
  return {
    id: "tok_1",
    studentId: "student_1",
    familyId: "family_1",
    revokedAt: null,
    expiresAt: new Date(now.getTime() + 1000),
    ...overrides,
  };
}

describe("evaluateRefreshRotation", () => {
  it("returns not-found when there is no row", () => {
    expect(evaluateRefreshRotation(null, now)).toEqual({ action: "not-found" });
  });

  it("returns reuse-detected when the row is already revoked", () => {
    const result = evaluateRefreshRotation(row({ revokedAt: new Date(now.getTime() - 1000) }), now);
    expect(result).toEqual({ action: "reuse-detected", familyId: "family_1" });
  });

  it("returns expired when past expiresAt and not revoked", () => {
    const result = evaluateRefreshRotation(row({ expiresAt: new Date(now.getTime() - 1000) }), now);
    expect(result).toEqual({ action: "expired" });
  });

  it("prioritizes reuse-detected over expired when both apply", () => {
    const result = evaluateRefreshRotation(
      row({ revokedAt: new Date(now.getTime() - 2000), expiresAt: new Date(now.getTime() - 1000) }),
      now
    );
    expect(result.action).toBe("reuse-detected");
  });

  it("returns rotate for a fresh, unrevoked, unexpired row", () => {
    const result = evaluateRefreshRotation(row(), now);
    expect(result).toEqual({ action: "rotate", studentId: "student_1", familyId: "family_1" });
  });
});
