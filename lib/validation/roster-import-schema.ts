import { z } from "zod";

export const RosterEntrySchema = z.object({
  ci: z.string().trim().min(3, "El carnet de identidad no es válido"),
  nombres: z.string().trim().min(1, "Nombres es requerido"),
  apellidos: z.string().trim().min(1, "Apellidos es requerido"),
  materia: z.string().trim().min(1, "Materia es requerida"),
});

export type RosterEntryInput = z.infer<typeof RosterEntrySchema>;

export const RosterImportSchema = z.object({
  entries: z.array(RosterEntrySchema).min(1, "Debe incluir al menos un estudiante").max(2000),
});

export type RosterImportInput = z.infer<typeof RosterImportSchema>;
