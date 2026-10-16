import { describe, expect, it } from "vitest";
import { THREAD_URL, TESTING_URL, fund1, fund2, subChecklist, subFormSupport, subUi } from "@/lib/clickup/test-fixtures";
import { buildFundGroup, toSubTask } from "./build";

const OFFSET = 420;

describe("toSubTask", () => {
  it("converts timestamps and maps status, priority and estimate", () => {
    expect(toSubTask(subFormSupport, OFFSET, "Fortress Lending Fund V (Unlevered)")).toEqual({
      id: "sub1",
      name: "Fortress Lending Fund V (Unlevered) - Form Support",
      shortName: "Form Support",
      url: "https://app.clickup.com/t/sub1",
      startDate: "2026-06-11",
      dueDate: "2026-06-12",
      status: { label: "in progress", color: "#4194f6" },
      priority: { label: "High", color: "#f8ae00", rank: 2 },
      estimateMs: 5_400_000,
    });
  });

  it("uses nulls for missing status, priority and estimate", () => {
    const sub = toSubTask({ ...subUi, status: undefined }, OFFSET);
    expect(sub.status).toBeNull();
    expect(sub.priority).toBeNull();
    expect(sub.estimateMs).toBeNull();
    expect(sub.shortName).toBe("UI Change");
  });
});

describe("buildFundGroup", () => {
  it("builds a full group from its parent", () => {
    const group = buildFundGroup({ parentId: "fund1", members: [subFormSupport, subChecklist] }, fund1, OFFSET);
    expect(group.name).toBe("Fortress Lending Fund V (Unlevered)");
    expect(group.url).toBe("https://app.clickup.com/t/fund1");
    expect(group.subtasks.map((s) => s.id)).toEqual(["sub2", "sub1"]); // sorted by due date
    expect(group.slack).toEqual({
      cs: { url: THREAD_URL, isThread: true },
      testing: { url: TESTING_URL, isThread: false },
    });
    expect(group.files).toEqual([{ title: "SubDoc_v3.pdf", url: "https://t.clickup-attachments.com/a1/SubDoc_v3.pdf" }]);
    expect(group.hiddenImageCount).toBe(1);
    expect(group.loadError).toBe(false);
  });

  it("falls back to plain description when markdown is absent", () => {
    const parent = { ...fund1, markdown_description: null, description: `Testing: ${TESTING_URL}` };
    const group = buildFundGroup({ parentId: "fund1", members: [subFormSupport] }, parent, OFFSET);
    expect(group.slack.testing?.url).toBe(TESTING_URL);
  });

  it("marks a group with no parent as a load error", () => {
    const group = buildFundGroup({ parentId: "fund9", members: [subFormSupport] }, null, OFFSET);
    expect(group).toMatchObject({
      name: "Task fund9",
      url: "https://app.clickup.com/t/fund9",
      slack: { cs: null, testing: null },
      files: [],
      hiddenImageCount: 0,
      loadError: true,
    });
    expect(group.subtasks).toHaveLength(1);
  });

  it("adds client, list, facts, notes and top priority", () => {
    const group = buildFundGroup({ parentId: "fund1", members: [subFormSupport, subChecklist] }, fund1, OFFSET);
    expect(group.client).toBe("Fortress");
    expect(group.listName).toBe("Fortress Lending Fund V - Subscription Booklet");
    expect(group.facts.map((f) => f.label)).toEqual([
      "Target delivery", "Expected launch", "Server", "Structure", "Jurisdictions", "Subdocs",
    ]);
    expect(group.notes).toBeNull(); // fund1's description is only Slack links
    expect(group.topPriority).toEqual({ label: "Urgent", color: "#f50000", rank: 1 });
    expect(group.subtasks.find((s) => s.id === "sub1")?.shortName).toBe("Form Support");
  });

  it("hides a hidden folder and keeps non-Slack description text as notes", () => {
    const group = buildFundGroup({ parentId: "fund2", members: [subUi] }, fund2, OFFSET);
    expect(group.client).toBeNull();
    expect(group.listName).toBe("Gilde Healthcare");
    expect(group.notes).toBe("Kickoff notes only.");
    expect(group.facts).toEqual([]);
    expect(group.topPriority).toBeNull();
  });

  it("fills empty extras for a load-error group but keeps top priority", () => {
    const group = buildFundGroup({ parentId: "fund9", members: [subChecklist] }, null, OFFSET);
    expect(group).toMatchObject({ client: null, listName: null, facts: [], notes: null, loadError: true });
    expect(group.topPriority?.rank).toBe(1);
    expect(group.subtasks[0].shortName).toBe("Checklist Fix");
  });
});
