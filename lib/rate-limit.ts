interface Bucket {
  count: number;
  windowStart: number;
}

/**
 * Simple in-memory fixed-window rate limiter, keyed by an arbitrary string
 * (typically `ip:route`). Single-process only: resets on restart and does not
 * coordinate across multiple app instances — acceptable for a single-container
 * MVP deployment, not for horizontally-scaled deployments.
 */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  check(key: string, now: number = Date.now()): { allowed: boolean; remaining: number } {
    const bucket = this.buckets.get(key);

    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: this.limit - 1 };
    }

    if (bucket.count >= this.limit) {
      return { allowed: false, remaining: 0 };
    }

    bucket.count += 1;
    return { allowed: true, remaining: this.limit - bucket.count };
  }
}

export const publicApiRateLimiter = new RateLimiter(60, 60_000); // 60 req/min per ip+route
