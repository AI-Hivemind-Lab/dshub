import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TtlCache } from "@/lib/cache/ttl-cache";
import { ClickUpError } from "@/lib/clickup/client";
import type { ClickUpTask } from "@/lib/clickup/types";
import {
  fund1, fund2, noiseTask, subChecklist, subFormSupport, subOverdue, subUi,
} from "@/lib/clickup/test-fixtures";
import { DEFAULT_NOISE_PATTERNS } from "@/lib/prep/noise";
import { createDayViewService, describeError, type DayViewResult } from "./day-view";

const DATE = "2026-06-11";
const parents: Record<string, ClickUpTask> = { fund1, fund2 };

function setup(overrides: { listUserTasks?: () => Promise<ClickUpTask[]>; getTask?: (id: string) => Promise<ClickUpTask> } = {}) {
  let now = 0;
  const listUserTasks = vi.fn(overrides.listUserTasks ?? (async () => [subFormSupport, subChecklist, subUi, subOverdue, noiseTask]));
  const getTask = vi.fn(overrides.getTask ?? (async (id: string) => parents[id]));
  const service = createDayViewService({
    client: { listUserTasks, getTask },
    config: { tzOffsetMinutes: 420, noisePatterns: DEFAULT_NOISE_PATTERNS },
    dayCache: new TtlCache<DayViewResult>(300_000, () => now),
    taskCache: new TtlCache<ClickUpTask>(300_000, () => now),
    now: () => now,
  });
  return { service, listUserTasks, getTask, advance: (ms: number) => { now += ms; } };
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("getDayView", () => {
  it("filters, rolls up and enriches tasks", async () => {
    const { service } = setup();
    const result = await service.getDayView(42, DATE, { refresh: false });
    expect(result.error).toBeNull();
    expect(result.stale).toBe(false);
    expect(result.view?.subtaskCount).toBe(3); // overdue + noise excluded
    expect(result.view?.groups.map((g) => g.parentId)).toEqual(["fund1", "fund2"]);
    const [g1, g2] = result.view!.groups;
    expect(g1.subtasks.map((s) => s.id)).toEqual(["sub2", "sub1"]);
    expect(g1.slack.cs?.isThread).toBe(true);
    expect(g1.files).toHaveLength(1);
    expect(g1.hiddenImageCount).toBe(1);
    expect(g2.subtasks.map((s) => s.id)).toEqual(["sub3"]);
    expect(g2.slack).toEqual({ cs: null, testing: null });
  });

  it("serves the day view from cache, and refresh bypasses it", async () => {
    const { service, listUserTasks, getTask } = setup();
    await service.getDayView(42, DATE, { refresh: false });
    await service.getDayView(42, DATE, { refresh: false });
    expect(listUserTasks).toHaveBeenCalledTimes(1);
    await service.getDayView(42, DATE, { refresh: true });
    expect(listUserTasks).toHaveBeenCalledTimes(2);
    expect(getTask).toHaveBeenCalledTimes(4); // refresh also refetches parents
  });

  it("shares cached parent tasks across users and dates", async () => {
    const { service, getTask } = setup();
    await service.getDayView(42, DATE, { refresh: false });
    await service.getDayView(7, DATE, { refresh: false });
    expect(getTask).toHaveBeenCalledTimes(2);
  });

  it("marks only the failing group when a parent fetch fails", async () => {
    const { service } = setup({
      getTask: async (id) => {
        if (id === "fund2") throw new ClickUpError(500, "/task/fund2", "boom");
        return parents[id];
      },
    });
    const result = await service.getDayView(42, DATE, { refresh: false });
    expect(result.error).toBeNull();
    expect(result.view!.groups[0].loadError).toBe(false);
    expect(result.view!.groups[1]).toMatchObject({
      loadError: true,
      name: "Task fund2",
      url: "https://app.clickup.com/t/fund2",
    });
  });

  it("returns an error with no view when nothing is cached", async () => {
    const { service } = setup({ listUserTasks: async () => { throw new ClickUpError(503, "/team/T1/task", "down"); } });
    const result = await service.getDayView(42, DATE, { refresh: false });
    expect(result).toMatchObject({ view: null, stale: false, error: "Couldn't reach ClickUp (unavailable)" });
    expect(vi.mocked(console.error)).not.toHaveBeenCalled();
  });

  it("logs non-ClickUp errors in day-view service", async () => {
    const { service } = setup({ listUserTasks: async () => { throw new TypeError("bad shape"); } });
    const result = await service.getDayView(42, DATE, { refresh: false });
    expect(result).toMatchObject({ view: null, stale: false, error: "Couldn't reach ClickUp (unavailable)" });
    expect(vi.mocked(console.error)).toHaveBeenCalledWith(
      expect.stringContaining("day_view_error"),
    );
    const calls = vi.mocked(console.error).mock.calls;
    expect(calls[0][0]).toContain("bad shape");
  });

  it("serves a stale view when ClickUp fails after the cache expires", async () => {
    let fail = false;
    const { service, advance } = setup({
      listUserTasks: async () => {
        if (fail) throw new ClickUpError(401, "/team/T1/task", "unauthorized");
        return [subFormSupport];
      },
    });
    await service.getDayView(42, DATE, { refresh: false });
    advance(301_000);
    fail = true;
    const result = await service.getDayView(42, DATE, { refresh: false });
    expect(result.stale).toBe(true);
    expect(result.error).toBe("Couldn't reach ClickUp (auth error)");
    expect(result.view?.subtaskCount).toBe(1);
  });

  it("returns an empty view for a quiet day", async () => {
    const { service } = setup({ listUserTasks: async () => [] });
    const result = await service.getDayView(42, DATE, { refresh: false });
    expect(result.view).toEqual({ date: DATE, subtaskCount: 0, groups: [] });
  });
});

describe("describeError", () => {
  it("distinguishes auth errors", () => {
    expect(describeError(new ClickUpError(403, "/x", "no"))).toBe("Couldn't reach ClickUp (auth error)");
    expect(describeError(new Error("other"))).toBe("Couldn't reach ClickUp (unavailable)");
  });
});
