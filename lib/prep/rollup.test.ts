import { describe, expect, it } from "vitest";
import type { ClickUpTask } from "@/lib/clickup/types";
import { rollUp } from "./rollup";

const task = (id: string, parent: string | null): ClickUpTask => ({
  id,
  name: id,
  url: `https://app.clickup.com/t/${id}`,
  parent,
  start_date: null,
  due_date: null,
});

describe("rollUp", () => {
  it("groups sub-tasks by parent in first-seen order", () => {
    const groups = rollUp([task("a", "P1"), task("b", "P2"), task("c", "P1")]);
    expect(groups.map((g) => g.parentId)).toEqual(["P1", "P2"]);
    expect(groups[0].members.map((m) => m.id)).toEqual(["a", "c"]);
  });
  it("de-duplicates repeated tasks", () => {
    const groups = rollUp([task("a", "P1"), task("a", "P1")]);
    expect(groups[0].members).toHaveLength(1);
  });
  it("makes a parentless task its own group", () => {
    const groups = rollUp([task("solo", null)]);
    expect(groups).toEqual([{ parentId: "solo", members: [task("solo", null)] }]);
  });
});
