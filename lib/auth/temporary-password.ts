import { randomInt } from "node:crypto";

// Sin I/O para evitar confusiones con 1/0 al dictar la contraseña.
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "0123456789";

/**
 * Contraseña temporal fácil de dictar: 4 letras, guion, 4 números
 * (p. ej. `KMTR-4821`). Es de un solo uso: el login la acepta solo para
 * obligar al estudiante a crear una contraseña nueva.
 */
export function generateTemporaryPassword(): string {
  let letters = "";
  let digits = "";
  for (let i = 0; i < 4; i++) {
    letters += LETTERS[randomInt(LETTERS.length)];
    digits += DIGITS[randomInt(DIGITS.length)];
  }
  return `${letters}-${digits}`;
}

/** Tolera minúsculas y espacios al teclear la contraseña temporal. */
export function normalizeTemporaryPassword(input: string): string {
  return input.trim().toUpperCase();
}
