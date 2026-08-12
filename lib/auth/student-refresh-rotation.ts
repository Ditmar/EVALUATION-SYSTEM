export interface RefreshTokenRow {
  id: string;
  studentId: string;
  familyId: string;
  revokedAt: Date | null;
  expiresAt: Date;
}

export type RotationDecision =
  | { action: "rotate"; studentId: string; familyId: string }
  | { action: "reuse-detected"; familyId: string }
  | { action: "expired" }
  | { action: "not-found" };

/**
 * Decides what to do with a presented refresh token, given its DB row.
 * Pure and DB-agnostic so the reuse-detection rule can be unit tested without
 * Postgres: a revoked row being presented again means the token was already
 * rotated out (or stolen and replayed), so the caller must revoke the entire
 * `familyId` chain rather than just rejecting this one request.
 */
export function evaluateRefreshRotation(row: RefreshTokenRow | null, now: Date): RotationDecision {
  if (!row) return { action: "not-found" };
  if (row.revokedAt) return { action: "reuse-detected", familyId: row.familyId };
  if (row.expiresAt.getTime() <= now.getTime()) return { action: "expired" };
  return { action: "rotate", studentId: row.studentId, familyId: row.familyId };
}
