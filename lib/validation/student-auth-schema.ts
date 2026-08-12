import { z } from "zod";

const ci = z.string().trim().min(3, "El carnet de identidad no es válido");
const password = z.string().min(8, "La contraseña debe tener al menos 8 caracteres");

export const StudentActivateSchema = z.object({ ci, password });
export type StudentActivateInput = z.infer<typeof StudentActivateSchema>;

export const StudentLoginSchema = z.object({ ci, password: z.string().min(1, "La contraseña es requerida") });
export type StudentLoginInput = z.infer<typeof StudentLoginSchema>;
