"use client";

let refreshPromise: Promise<boolean> | null = null;

async function refreshStudentSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/student/auth/refresh", { method: "POST" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * `fetch()` wrapper for every student-side request in the laboratory module.
 * Student access tokens last 15 minutes (`STUDENT_ACCESS_TTL_SECONDS`) —
 * fine for an exam attempt (which mints its own short-lived attempt-scoped
 * token and never touches the student session again) but not for a
 * laboratory session that can span reading + answering + autosave well
 * beyond that. On a 401 this refreshes the session once (concurrent 401s
 * share the same in-flight refresh instead of each triggering their own) and
 * retries the original request once; if the refresh itself fails, it
 * redirects to the login page rather than letting the caller silently lose
 * an autosave.
 */
export async function studentFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  const refreshed = await refreshStudentSession();
  if (!refreshed) {
    window.location.href = "/student/login";
    return response;
  }

  return fetch(input, init);
}
