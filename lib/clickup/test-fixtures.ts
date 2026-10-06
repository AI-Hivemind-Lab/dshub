import type { ClickUpTask } from "./types";

const ms = (iso: string) => String(Date.parse(iso));
const t = (id: string) => `https://app.clickup.com/t/${id}`;

export const THREAD_URL =
  "https://anduin.slack.com/archives/C111/p1717000000000100?thread_ts=1717000000.000100&cid=C111";
export const TESTING_URL = "https://anduin.slack.com/archives/C222";

// Target date for these fixtures: 2026-06-11 (UTC+7).
export const subFormSupport: ClickUpTask = {
  id: "sub1", name: "Form Support", url: t("sub1"), parent: "fund1",
  start_date: ms("2026-06-11T02:00:00Z"), due_date: ms("2026-06-12T02:00:00Z"),
};
export const subChecklist: ClickUpTask = {
  id: "sub2", name: "Checklist Fix", url: t("sub2"), parent: "fund1",
  start_date: ms("2026-06-08T02:00:00Z"), due_date: ms("2026-06-11T02:00:00Z"),
};
export const subUi: ClickUpTask = {
  id: "sub3", name: "UI Change", url: t("sub3"), parent: "fund2",
  start_date: ms("2026-06-09T02:00:00Z"), due_date: ms("2026-06-15T02:00:00Z"),
};
export const subOverdue: ClickUpTask = {
  id: "sub4", name: "Old Fix", url: t("sub4"), parent: "fund2",
  start_date: ms("2026-06-01T02:00:00Z"), due_date: ms("2026-06-10T02:00:00Z"),
};
export const noiseTask: ClickUpTask = {
  id: "sub5", name: "Update Request - Fortress", url: t("sub5"), parent: "fund1",
  start_date: ms("2026-06-11T02:00:00Z"), due_date: ms("2026-06-11T02:00:00Z"),
};

export const fund1: ClickUpTask = {
  id: "fund1", name: "Fortress Lending Fund V (Unlevered)", url: t("fund1"), parent: null,
  start_date: null, due_date: null,
  markdown_description: `CS channel: [link](${THREAD_URL})\nTesting channel: ${TESTING_URL}`,
  attachments: [
    { id: "a1", title: "SubDoc_v3.pdf", url: "https://t.clickup-attachments.com/a1/SubDoc_v3.pdf", extension: "pdf", mimetype: "application/pdf" },
    { id: "a2", title: "image.png", url: "https://t.clickup-attachments.com/a2/image.png", extension: "png", mimetype: "image/png" },
  ],
};
export const fund2: ClickUpTask = {
  id: "fund2", name: "Gilde Healthcare GHPE V", url: t("fund2"), parent: null,
  start_date: null, due_date: null,
  markdown_description: "Kickoff notes only.",
  attachments: [],
};
