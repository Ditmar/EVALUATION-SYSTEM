export const ADMIN_SESSION_COOKIE = "admin_session";

export function attemptCookieName(token: string): string {
  return `attempt_${token}`;
}

export const MAX_ATTEMPT_COOKIE_AGE_SECONDS = 60 * 60 * 12; // 12h, generous ceiling above any exam duration
