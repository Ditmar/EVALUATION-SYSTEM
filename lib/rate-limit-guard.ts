import { NextRequest, NextResponse } from "next/server";
import { extractClientIp } from "@/lib/ip-utils";
import { publicApiRateLimiter } from "@/lib/rate-limit";

/**
 * Applies the in-memory rate limiter to a public route. Returns a 429
 * NextResponse when the caller should be rejected, or null to continue.
 */
export function checkPublicRateLimit(request: NextRequest, routeName: string): NextResponse | null {
  const trustProxy = process.env.TRUST_PROXY === "true";
  const ip = extractClientIp(request.headers, trustProxy, request.ip ?? null) ?? "unknown";
  const { allowed } = publicApiRateLimiter.check(`${ip}:${routeName}`);

  if (!allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Intenta de nuevo en un momento." }, { status: 429 });
  }

  return null;
}

/**
 * Rate limit keyed by an authenticated identity (e.g. an exam attempt id)
 * instead of by IP. Used by the in-exam routes: a whole classroom behind one
 * NAT — or every client when the runtime can't see the real IP and falls back
 * to "unknown" — must not share a single bucket, or legitimate answer saves
 * start failing with 429 as soon as ~60 requests/minute arrive class-wide.
 */
export function checkRateLimitByKey(key: string, routeName: string): NextResponse | null {
  const { allowed } = publicApiRateLimiter.check(`${key}:${routeName}`);
  if (!allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Intenta de nuevo en un momento." }, { status: 429 });
  }
  return null;
}
