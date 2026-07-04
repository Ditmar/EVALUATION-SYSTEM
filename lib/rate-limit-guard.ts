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
