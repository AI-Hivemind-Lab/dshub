import { parseNoisePatterns } from "@/lib/prep/noise";
import { parseOffset } from "@/lib/prep/dates";

export interface HubConfig {
  clickupToken: string;
  teamId: string;
  spaceId: string;
  allowedDomain: string;
  tzOffsetMinutes: number;
  noisePatterns: string[];
}

const REQUIRED = ["CLICKUP_TOKEN", "CLICKUP_TEAM_ID", "CLICKUP_SPACE_ID"] as const;

export function loadConfig(env: Record<string, string | undefined> = process.env): HubConfig {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  return {
    clickupToken: env.CLICKUP_TOKEN!,
    teamId: env.CLICKUP_TEAM_ID!,
    spaceId: env.CLICKUP_SPACE_ID!,
    allowedDomain: (env.ALLOWED_EMAIL_DOMAIN || "anduintransact.com").toLowerCase(),
    tzOffsetMinutes: parseOffset(env.TZ_OFFSET || "+07:00"),
    noisePatterns: parseNoisePatterns(env.NOISE_PATTERNS),
  };
}
