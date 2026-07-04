"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  deadline: number; // epoch ms, computed once from server-provided remainingMs
  onExpire: () => void;
}

function format(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [minutes.toString().padStart(2, "0"), seconds.toString().padStart(2, "0")];
  if (hours > 0) parts.unshift(hours.toString());
  return parts.join(":");
}

export function CountdownTimer({ deadline, onExpire }: Props) {
  const [remaining, setRemaining] = useState(() => deadline - Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = deadline - Date.now();
      setRemaining(next);
      if (next <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  const isLow = remaining <= 5 * 60_000;

  return (
    <div
      className={`sticky top-0 z-40 flex items-center justify-center gap-2 border-b py-2 text-lg font-semibold ${
        isLow ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      Tiempo restante: <span className="font-mono">{format(remaining)}</span>
    </div>
  );
}
