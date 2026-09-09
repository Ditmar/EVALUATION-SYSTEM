const PALETTE = ["#2563eb", "#7c3aed", "#db2777", "#d97706", "#059669", "#0891b2", "#dc2626", "#4f46e5"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

/** Medium-style fallback avatar: a color circle with the author's initials, deterministic by name — no upload/URL field needed. */
export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof SIZE_CLASSES }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${SIZE_CLASSES[size]}`}
      style={{ backgroundColor: colorFor(name || "?") }}
      aria-hidden
    >
      {initials(name || "?")}
    </div>
  );
}
