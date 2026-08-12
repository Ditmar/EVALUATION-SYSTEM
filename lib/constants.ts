export const ADMIN_SESSION_COOKIE = "admin_session";

export function attemptCookieName(token: string): string {
  return `attempt_${token}`;
}

export const MAX_ATTEMPT_COOKIE_AGE_SECONDS = 60 * 60 * 12; // 12h, generous ceiling above any exam duration

export const STUDENT_ACCESS_COOKIE = "student_access";
export const STUDENT_REFRESH_COOKIE = "student_refresh";
export const STUDENT_REFRESH_COOKIE_PATH = "/api/student/auth";
export const STUDENT_ACCESS_TTL_SECONDS = 60 * 15; // 15min short-lived access token
export const STUDENT_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30d, rotated on every use
