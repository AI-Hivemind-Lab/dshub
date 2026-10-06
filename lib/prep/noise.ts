export const DEFAULT_NOISE_PATTERNS = [
  "estimation",
  "update request",
  "availability",
  "slotting",
  "team sync",
];

export function parseNoisePatterns(raw?: string): string[] {
  if (raw === undefined || raw.trim() === "") return [...DEFAULT_NOISE_PATTERNS];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isNoise(name: string, patterns: string[]): boolean {
  const lower = name.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}
