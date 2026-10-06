import type { TtlCache } from "@/lib/cache/ttl-cache";
import { ClickUpError, type ClickUpClient } from "@/lib/clickup/client";
import type { ClickUpTask } from "@/lib/clickup/types";
import type { HubConfig } from "@/lib/config";
import { buildFundGroup } from "@/lib/prep/build";
import { isNoise } from "@/lib/prep/noise";
import { rollUp } from "@/lib/prep/rollup";
import type { DayView } from "@/lib/prep/types";
import { inWindow } from "@/lib/prep/window";
import { mapLimit } from "./map-limit";

const PARENT_CONCURRENCY = 5;

export interface DayViewResult {
  view: DayView | null;
  fetchedAt: number;
  stale: boolean;
  error: string | null;
}

export function describeError(err: unknown): string {
  if (err instanceof ClickUpError && (err.status === 401 || err.status === 403)) {
    return "Couldn't reach ClickUp (auth error)";
  }
  return "Couldn't reach ClickUp (unavailable)";
}

export interface DayViewDeps {
  client: Pick<ClickUpClient, "listUserTasks" | "getTask">;
  config: Pick<HubConfig, "tzOffsetMinutes" | "noisePatterns">;
  dayCache: TtlCache<DayViewResult>;
  taskCache: TtlCache<ClickUpTask>;
  now?: () => number;
}

export function createDayViewService(deps: DayViewDeps) {
  const { client, config, dayCache, taskCache } = deps;
  const now = deps.now ?? Date.now;

  async function getParent(id: string, refresh: boolean): Promise<ClickUpTask | null> {
    const cached = refresh ? undefined : taskCache.get(id);
    if (cached) return cached;
    try {
      const task = await client.getTask(id);
      taskCache.set(id, task);
      return task;
    } catch {
      return null; // client already logged the failure
    }
  }

  async function getDayView(userId: number, date: string, opts: { refresh: boolean }): Promise<DayViewResult> {
    const key = `${userId}:${date}`;
    if (!opts.refresh) {
      const hit = dayCache.get(key);
      if (hit) return hit;
    }
    try {
      const tasks = await client.listUserTasks(userId);
      const matching = tasks.filter(
        (t) => inWindow(t, date, config.tzOffsetMinutes) && !isNoise(t.name, config.noisePatterns),
      );
      const groups = await mapLimit(rollUp(matching), PARENT_CONCURRENCY, async (group) =>
        buildFundGroup(group, await getParent(group.parentId, opts.refresh), config.tzOffsetMinutes),
      );
      const result: DayViewResult = {
        view: { date, subtaskCount: matching.length, groups },
        fetchedAt: now(),
        stale: false,
        error: null,
      };
      dayCache.set(key, result);
      return result;
    } catch (err) {
      const error = describeError(err);
      const previous = dayCache.peek(key);
      if (previous?.view) return { ...previous, stale: true, error };
      return { view: null, fetchedAt: now(), stale: false, error };
    }
  }

  return { getDayView };
}

export type DayViewService = ReturnType<typeof createDayViewService>;
