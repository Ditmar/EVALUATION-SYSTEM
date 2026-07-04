export type PenaltyEventType =
  | "tab_hidden"
  | "window_blur"
  | "fullscreen_exit"
  | "heartbeat"
  | "reconnect"
  | "other";

export type OnMaxPenalties = "auto_submit" | "warn_only" | "lock_exam";

export type PenaltyAction = "none" | "warn" | "lock" | "auto_submit";

const PENALTY_EVENT_TYPES: ReadonlySet<PenaltyEventType> = new Set([
  "tab_hidden",
  "window_blur",
  "fullscreen_exit",
]);

export function isPenaltyEvent(type: PenaltyEventType): boolean {
  return PENALTY_EVENT_TYPES.has(type);
}

export interface PenaltyResult {
  newCount: number;
  action: PenaltyAction;
}

/**
 * Pure penalty-threshold logic. Only "real" incident types (tab hidden, window
 * blur, fullscreen exit) increment the counter — heartbeat/reconnect are purely
 * informational and never counted. Once `newCount` reaches `maxPenalties`, the
 * configured `onMaxPenalties` behavior kicks in; below the threshold the action
 * is always "warn" for a real incident (so the student sees "penalización X de N"
 * every time), and "none" for informational events.
 */
export function applyPenaltyEvent(
  currentCount: number,
  maxPenalties: number,
  eventType: PenaltyEventType,
  onMaxPenalties: OnMaxPenalties
): PenaltyResult {
  if (!isPenaltyEvent(eventType)) {
    return { newCount: currentCount, action: "none" };
  }

  const newCount = currentCount + 1;

  if (newCount < maxPenalties) {
    return { newCount, action: "warn" };
  }

  switch (onMaxPenalties) {
    case "auto_submit":
      return { newCount, action: "auto_submit" };
    case "lock_exam":
      return { newCount, action: "lock" };
    case "warn_only":
    default:
      return { newCount, action: "warn" };
  }
}
