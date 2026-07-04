import { z } from "zod";

export const StudentRegistrationSchema = z.object({
  nombres: z.string().trim().min(1, "Nombres es requerido"),
  apellidos: z.string().trim().min(1, "Apellidos es requerido"),
  ci: z.string().trim().min(3, "El carnet de identidad no es válido"),
  correo: z.string().trim().email("El correo electrónico no es válido"),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Debe aceptar los términos y condiciones de evaluación" }),
  }),
});

export type StudentRegistrationInput = z.infer<typeof StudentRegistrationSchema>;
