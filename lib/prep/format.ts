/** ClickUp time estimate (ms) → "45m", "2h" or "1h 30m"; "" when missing or ≤ 0. */
export function formatEstimate(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "";
  const totalMin = Math.max(1, Math.round(ms / 60_000));
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
