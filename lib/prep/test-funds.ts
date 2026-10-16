import type { FundGroup, SubTask } from "./types";

/** Test builder: a fully populated sub-task; override what a test cares about. */
export function makeSubTask(overrides: Partial<SubTask> = {}): SubTask {
  return {
    id: "s1",
    name: "Fund A - Checklist Fix",
    shortName: "Checklist Fix",
    url: "https://app.clickup.com/t/s1",
    startDate: "2026-06-11",
    dueDate: "2026-06-11",
    status: { label: "in progress", color: "#4194f6" },
    priority: { label: "High", color: "#f8ae00", rank: 2 },
    estimateMs: 5_400_000,
    ...overrides,
  };
}

/** Test builder: a fully populated fund group; override what a test cares about. */
export function makeFund(overrides: Partial<FundGroup> = {}): FundGroup {
  return {
    parentId: "f1",
    name: "Fund A",
    url: "https://app.clickup.com/t/f1",
    subtasks: [makeSubTask()],
    slack: {
      cs: { url: "https://anduin.slack.com/archives/C111/p1717000000000100?thread_ts=1", isThread: true },
      testing: { url: "https://anduin.slack.com/archives/C222", isThread: false },
    },
    files: [{ title: "SubDoc_v3.pdf", url: "https://files.example/SubDoc_v3.pdf" }],
    hiddenImageCount: 0,
    loadError: false,
    client: "Fortress",
    listName: "Fund A - Subscription Booklet",
    facts: [
      { label: "Target delivery", value: "Oct 20" },
      { label: "Server", value: "Global" },
    ],
    notes: null,
    topPriority: { label: "High", color: "#f8ae00", rank: 2 },
    ...overrides,
  };
}
