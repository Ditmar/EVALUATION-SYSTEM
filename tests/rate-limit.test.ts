import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  it("allows requests up to the limit within a window", () => {
    const limiter = new RateLimiter(3, 1000);
    const now = 0;
    expect(limiter.check("k", now).allowed).toBe(true);
    expect(limiter.check("k", now).allowed).toBe(true);
    expect(limiter.check("k", now).allowed).toBe(true);
  });

  it("blocks requests beyond the limit within the same window", () => {
    const limiter = new RateLimiter(2, 1000);
    const now = 0;
    expect(limiter.check("k", now).allowed).toBe(true);
    expect(limiter.check("k", now).allowed).toBe(true);
    const third = limiter.check("k", now);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.check("k", 0).allowed).toBe(true);
    expect(limiter.check("k", 500).allowed).toBe(false);
    expect(limiter.check("k", 1000).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("b", 0).allowed).toBe(true);
  });
});
