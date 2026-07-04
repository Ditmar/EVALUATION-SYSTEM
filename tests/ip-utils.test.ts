import { describe, expect, it } from "vitest";
import { computePredominantIp, extractClientIp, isDifferentFromPredominant } from "@/lib/ip-utils";

function headersWith(value: string | null) {
  return { get: () => value };
}

describe("extractClientIp", () => {
  it("uses the socket address when trustProxy is false, even if x-forwarded-for is present", () => {
    const ip = extractClientIp(headersWith("1.2.3.4"), false, "10.0.0.5");
    expect(ip).toBe("10.0.0.5");
  });

  it("uses the first hop of x-forwarded-for when trustProxy is true", () => {
    const ip = extractClientIp(headersWith("1.2.3.4, 5.6.7.8"), true, "10.0.0.5");
    expect(ip).toBe("1.2.3.4");
  });

  it("falls back to socket address when trustProxy is true but header is absent", () => {
    const ip = extractClientIp(headersWith(null), true, "10.0.0.5");
    expect(ip).toBe("10.0.0.5");
  });

  it("returns null when there is no socket address either", () => {
    const ip = extractClientIp(headersWith(null), false, null);
    expect(ip).toBeNull();
  });
});

describe("computePredominantIp", () => {
  it("returns the most frequent IP", () => {
    const { predominantIp, counts } = computePredominantIp(["1.1.1.1", "1.1.1.1", "2.2.2.2"]);
    expect(predominantIp).toBe("1.1.1.1");
    expect(counts).toEqual({ "1.1.1.1": 2, "2.2.2.2": 1 });
  });

  it("breaks ties using first-seen order", () => {
    const { predominantIp } = computePredominantIp(["2.2.2.2", "1.1.1.1"]);
    expect(predominantIp).toBe("2.2.2.2");
  });

  it("handles a single-IP set", () => {
    const { predominantIp } = computePredominantIp(["9.9.9.9"]);
    expect(predominantIp).toBe("9.9.9.9");
  });

  it("returns null for an empty set", () => {
    const { predominantIp } = computePredominantIp([]);
    expect(predominantIp).toBeNull();
  });

  it("ignores null/undefined entries", () => {
    const { predominantIp } = computePredominantIp([null, "3.3.3.3", undefined]);
    expect(predominantIp).toBe("3.3.3.3");
  });
});

describe("isDifferentFromPredominant", () => {
  it("flags an IP that differs from the predominant one", () => {
    expect(isDifferentFromPredominant("9.9.9.9", "1.1.1.1")).toBe(true);
  });

  it("does not flag the predominant IP itself", () => {
    expect(isDifferentFromPredominant("1.1.1.1", "1.1.1.1")).toBe(false);
  });

  it("does not flag when there is no predominant IP yet", () => {
    expect(isDifferentFromPredominant("1.1.1.1", null)).toBe(false);
  });
});
