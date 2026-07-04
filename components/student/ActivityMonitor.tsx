"use client";

import { useEffect, useRef } from "react";

type PenaltyAction = "none" | "warn" | "lock" | "auto_submit";

interface ActivityResult {
  penaltyCount: number;
  remaining: number;
  action: PenaltyAction;
}

interface Props {
  token: string;
  enabled: boolean;
  onResult: (result: ActivityResult, eventLabel: string) => void;
}

const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Invisible component that wires up best-effort browser signals (tab
 * visibility, window focus, fullscreen exit, a heartbeat, and beforeunload)
 * and reports them to the server as "supervision alerts" — not proof of
 * cheating, just signals a teacher can review.
 */
export function ActivityMonitor({ token, enabled, onResult }: Props) {
  const wasFullscreenRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    async function postEvent(type: string, detail?: string) {
      try {
        const res = await fetch(`/api/public/exams/${token}/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, detail }),
        });
        if (!res.ok) return;
        const data: ActivityResult = await res.json();
        onResult(data, type);
      } catch {
        // Best-effort; a failed report should never block the student's exam.
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        postEvent("tab_hidden");
      }
    }

    function handleBlur() {
      // Avoid double-counting the common case where switching tabs fires both
      // visibilitychange and blur for the same physical action.
      if (!document.hidden) {
        postEvent("window_blur");
      }
    }

    function handleFullscreenChange() {
      const isFullscreen = Boolean(document.fullscreenElement);
      if (wasFullscreenRef.current && !isFullscreen) {
        postEvent("fullscreen_exit");
      }
      wasFullscreenRef.current = isFullscreen;
    }

    function handleBeforeUnload() {
      navigator.sendBeacon?.(
        `/api/public/exams/${token}/activity`,
        new Blob([JSON.stringify({ type: "other", detail: "beforeunload" })], { type: "application/json" })
      );
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    const heartbeat = setInterval(() => postEvent("heartbeat"), HEARTBEAT_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(heartbeat);
    };
  }, [token, enabled, onResult]);

  return null;
}
