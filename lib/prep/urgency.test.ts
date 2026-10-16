import { describe, expect, it } from "vitest";
import { makeFund, makeSubTask } from "./test-funds";
import { groupByUrgency } from "./urgency";

const D = "2026-06-11";
const fundDue = (id: string, name: string, ...dues: (string | null)[]) =>
  makeFund({ parentId: id, name, subtasks: dues.map((d, i) => makeSubTask({ id: `${id}-${i}`, dueDate: d })) });

describe("groupByUrgency", () => {
  it("buckets by earliest due date with D+6 as the last 'This week' day", () => {
    const groups = groupByUrgency(
      [fundDue("c", "Later fund", "2026-06-18"), fundDue("b", "Week fund", "2026-06-17"), fundDue("a", "Today fund", D)],
      D,
    );
    expect(groups.map((g) => [g.key, g.label, g.funds.map((f) => f.parentId)])).toEqual([
      ["today", "Due today", ["a"]],
      ["week", "This week", ["b"]],
      ["later", "Later", ["c"]],
    ]);
  });

  it("uses the earliest sub-task due date", () => {
    const [group] = groupByUrgency([fundDue("x", "X", "2026-06-20", "2026-06-12")], D);
    expect(group.key).toBe("week");
  });

  it("sorts by earliest due, then name case-insensitively", () => {
    const groups = groupByUrgency(
      [
        fundDue("w2", "Week B", "2026-06-15"),
        fundDue("t2", "beta", D),
        fundDue("w1", "Week A", "2026-06-13"),
        fundDue("t1", "Alpha", D),
      ],
      D,
    );
    expect(groups[0].funds.map((f) => f.name)).toEqual(["Alpha", "beta"]);
    expect(groups[1].funds.map((f) => f.name)).toEqual(["Week A", "Week B"]);
  });

  it("drops empty groups and puts funds without due dates in Later", () => {
    const groups = groupByUrgency([fundDue("n", "No dates", null)], D);
    expect(groups.map((g) => g.key)).toEqual(["later"]);
  });

  it("returns nothing for no funds", () => {
    expect(groupByUrgency([], D)).toEqual([]);
  });
});
