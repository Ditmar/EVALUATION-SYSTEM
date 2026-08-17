import type { RosterEntryInput } from "@/lib/validation/roster-import-schema";

export interface ExistingStudentRow {
  ci: string;
  passwordHash: string | null;
}

export type StudentUpsertPlan =
  | {
      action: "create";
      fields: { ci: string; nombres: string; apellidos: string; correo: string | null; passwordHash: null };
    }
  | { action: "update"; fields: { nombres: string; apellidos: string; correo?: string } };

/**
 * Decides how a single roster row should be applied. Never includes
 * `passwordHash` in an update, so re-importing the same roster is idempotent
 * and can't clobber a student who already activated their account. `correo`
 * is only included in an update when the row actually provides one, so
 * omitting it on a re-import doesn't blank out an existing value.
 */
export function planRosterRow(
  existing: ExistingStudentRow | null,
  row: RosterEntryInput
): StudentUpsertPlan {
  if (existing) {
    return {
      action: "update",
      fields: {
        nombres: row.nombres,
        apellidos: row.apellidos,
        ...(row.correo !== undefined ? { correo: row.correo } : {}),
      },
    };
  }
  return {
    action: "create",
    fields: { ci: row.ci, nombres: row.nombres, apellidos: row.apellidos, correo: row.correo ?? null, passwordHash: null },
  };
}
