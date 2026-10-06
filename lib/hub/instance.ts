import { TtlCache } from "@/lib/cache/ttl-cache";
import { createClickUpClient } from "@/lib/clickup/client";
import type { ClickUpMember, ClickUpTask } from "@/lib/clickup/types";
import { loadConfig, type HubConfig } from "@/lib/config";
import { createDayViewService, type DayViewResult, type DayViewService } from "./day-view";
import { createMemberResolver } from "./members";

const FIVE_MINUTES = 5 * 60_000;
const ONE_HOUR = 60 * 60_000;

export interface Hub {
  config: HubConfig;
  dayViews: DayViewService;
  resolveMember: (email: string) => Promise<ClickUpMember | null>;
}

// Stored on globalThis so dev-mode hot reloads don't drop the caches.
const holder = globalThis as unknown as { __teamHub?: Hub };

export function getHub(): Hub {
  if (!holder.__teamHub) {
    const config = loadConfig();
    const client = createClickUpClient({
      token: config.clickupToken,
      teamId: config.teamId,
      spaceId: config.spaceId,
    });
    holder.__teamHub = {
      config,
      dayViews: createDayViewService({
        client,
        config,
        dayCache: new TtlCache<DayViewResult>(FIVE_MINUTES),
        taskCache: new TtlCache<ClickUpTask>(FIVE_MINUTES),
      }),
      resolveMember: createMemberResolver(client, new TtlCache<ClickUpMember[]>(ONE_HOUR)),
    };
  }
  return holder.__teamHub;
}
