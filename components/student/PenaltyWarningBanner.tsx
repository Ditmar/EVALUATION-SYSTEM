export function PenaltyWarningBanner({
  penaltyCount,
  maxPenalties,
  lastMessage,
}: {
  penaltyCount: number;
  maxPenalties: number;
  lastMessage: string | null;
}) {
  if (penaltyCount === 0) return null;

  const remaining = Math.max(0, maxPenalties - penaltyCount);
  const isLast = remaining === 0;

  return (
    <div
      className={`sticky top-[52px] z-30 border-b p-3 text-sm ${
        isLast ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-800"
      }`}
    >
      <p className="font-medium">
        Penalización {Math.min(penaltyCount, maxPenalties)} de {maxPenalties}
        {isLast ? " — se alcanzó el máximo permitido." : ` — te quedan ${remaining} antes de que tu examen se envíe automáticamente.`}
      </p>
      {lastMessage && <p className="text-xs">{lastMessage}</p>}
    </div>
  );
}
