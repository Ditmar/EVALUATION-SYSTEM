export function computeExpiresAt(startedAt: Date, durationMinutes: number): Date {
  return new Date(startedAt.getTime() + durationMinutes * 60_000);
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= expiresAt.getTime();
}

export function remainingMs(expiresAt: Date, now: Date = new Date()): number {
  return Math.max(0, expiresAt.getTime() - now.getTime());
}
