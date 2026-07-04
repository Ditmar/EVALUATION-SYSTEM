/**
 * Extracts the client IP for an incoming request.
 *
 * IMPORTANT: `x-forwarded-for` is trivially spoofable by the client unless the
 * app sits behind a proxy that overwrites/sets it itself (nginx, a load balancer,
 * Vercel, etc). Only trust it when `trustProxy` is true (TRUST_PROXY env var) —
 * otherwise fall back to the raw socket address, which cannot be spoofed by the
 * client but will show the proxy's own IP for every request if one is present
 * and TRUST_PROXY is left off by mistake. Document this trade-off for operators.
 */
export function extractClientIp(
  headers: { get(name: string): string | null },
  trustProxy: boolean,
  socketAddr: string | null
): string | null {
  if (trustProxy) {
    const forwardedFor = headers.get("x-forwarded-for");
    if (forwardedFor) {
      const firstHop = forwardedFor.split(",")[0]?.trim();
      if (firstHop) return firstHop;
    }
  }
  return socketAddr ?? null;
}

/**
 * Computes the predominant (mode) IP among a set of observed IPs, and flags any
 * IP that differs from it. Ties are broken by first-seen order, since there is
 * no meaningful way to prefer one IP over another when counts are equal.
 */
export function computePredominantIp(ips: (string | null | undefined)[]): {
  predominantIp: string | null;
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {};
  const order: string[] = [];

  for (const ip of ips) {
    if (!ip) continue;
    if (!(ip in counts)) order.push(ip);
    counts[ip] = (counts[ip] ?? 0) + 1;
  }

  if (order.length === 0) {
    return { predominantIp: null, counts };
  }

  let predominantIp = order[0];
  let bestCount = counts[predominantIp];
  for (const ip of order.slice(1)) {
    if (counts[ip] > bestCount) {
      predominantIp = ip;
      bestCount = counts[ip];
    }
  }

  return { predominantIp, counts };
}

export function isDifferentFromPredominant(ip: string | null | undefined, predominantIp: string | null): boolean {
  if (!ip || !predominantIp) return false;
  return ip !== predominantIp;
}
