import { randomBytes } from "node:crypto";

/**
 * Generates an unguessable public token for exam URLs.
 * 24 random bytes -> 32 url-safe base64 chars, no DB round-trip needed to be "unique enough".
 */
export function generatePublicToken(): string {
  return randomBytes(24).toString("base64url");
}
