import { describe, expect, it } from "vitest";
import { applyPenaltyEvent } from "@/lib/penalties";

describe("applyPenaltyEvent", () => {
  it("does not increment the counter for informational events", () => {
    expect(applyPenaltyEvent(0, 3, "heartbeat", "auto_submit")).toEqual({ newCount: 0, action: "none" });
    expect(applyPenaltyEvent(2, 3, "reconnect", "auto_submit")).toEqual({ newCount: 2, action: "none" });
  });

  it("warns below the threshold", () => {
    expect(applyPenaltyEvent(0, 3, "tab_hidden", "auto_submit")).toEqual({ newCount: 1, action: "warn" });
    expect(applyPenaltyEvent(1, 3, "window_blur", "auto_submit")).toEqual({ newCount: 2, action: "warn" });
  });

  it("auto-submits at the threshold when onMaxPenalties=auto_submit", () => {
    expect(applyPenaltyEvent(2, 3, "fullscreen_exit", "auto_submit")).toEqual({
      newCount: 3,
      action: "auto_submit",
    });
  });

  it("locks at the threshold when onMaxPenalties=lock_exam", () => {
    expect(applyPenaltyEvent(2, 3, "tab_hidden", "lock_exam")).toEqual({ newCount: 3, action: "lock" });
  });

  it("keeps warning at the threshold when onMaxPenalties=warn_only", () => {
    expect(applyPenaltyEvent(2, 3, "tab_hidden", "warn_only")).toEqual({ newCount: 3, action: "warn" });
  });

  it("never decrements the counter", () => {
    const result = applyPenaltyEvent(5, 3, "tab_hidden", "auto_submit");
    expect(result.newCount).toBe(6);
  });

  it("respects a custom maxPenalties threshold", () => {
    expect(applyPenaltyEvent(0, 1, "tab_hidden", "auto_submit")).toEqual({ newCount: 1, action: "auto_submit" });
  });
});
