import { HTMLAttributes } from "react";

type Tone = "gray" | "green" | "red" | "yellow" | "blue";

const TONE_CLASS: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  yellow: "bg-amber-100 text-amber-700",
  blue: "bg-brand-100 text-brand-700",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "gray", className = "", ...props }: BadgeProps) {
  return <span className={`badge ${TONE_CLASS[tone]} ${className}`} {...props} />;
}
