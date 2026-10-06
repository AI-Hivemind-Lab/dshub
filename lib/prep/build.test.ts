import { describe, expect, it } from "vitest";
import { THREAD_URL, TESTING_URL, fund1, subChecklist, subFormSupport } from "@/lib/clickup/test-fixtures";
import { buildFundGroup, toSubTask } from "./build";

const OFFSET = 420;

describe("toSubTask", () => {
  it("converts timestamps to local dates", () => {
    expect(toSubTask(subFormSupport, OFFSET)).toEqual({
      id: "sub1",
      name: "Form Support",
      url: "https://app.clickup.com/t/sub1",
      startDate: "2026-06-11",
      dueDate: "2026-06-12",
    });
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
});
