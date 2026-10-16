import type { ClickUpCustomField, ClickUpTask } from "./types";

const ms = (iso: string) => String(Date.parse(iso));
const t = (id: string) => `https://app.clickup.com/t/${id}`;

export const THREAD_URL =
  "https://anduin.slack.com/archives/C111/p1717000000000100?thread_ts=1717000000.000100&cid=C111";
export const TESTING_URL = "https://anduin.slack.com/archives/C222";

// Real field IDs and option shapes from the Digitization Squad workspace (labels → `label`, drop_down → `name`).
export const fundCustomFields: ClickUpCustomField[] = [
  { id: "d6383cc7-7921-4655-b0eb-bc5dbbc8ef23", name: "📕 [DO] Initial Target Delivery Date", type: "date", value: "1792512000000" },
  { id: "cf3b66ac-573c-4f52-8c62-323638c11967", name: "📕 [GTM] Expected Launch Date", type: "date", value: "1791147600000" },
  {
    id: "ac4b808b-9094-4219-ac14-41df4f0eac81", name: "📕 [GTM] Server", type: "labels",
    value: ["ce43cf10-3b82-42eb-b5c9-6018e320f42c"],
    type_config: { options: [
      { id: "ce6967a4-d318-4acc-af2a-27a1ea819837", label: "EU", orderindex: 0 },
      { id: "ce43cf10-3b82-42eb-b5c9-6018e320f42c", label: "Global", orderindex: 1 },
    ] },
  },
  {
    id: "3ab4b383-df56-40f2-9a84-4a00e7d9adc6", name: "🔍 [DS] Fund Structure", type: "drop_down", value: 3,
    type_config: { options: [
      { id: "d8b8adab-83b2-44fe-b775-9d07e6e786d8", name: "Master/Feeder funds", orderindex: 0 },
      { id: "dd5a15d4-5800-415e-b934-78b878bb1637", name: "Single fund", orderindex: 1 },
      { id: "91d762ac-b191-46a8-ba9c-6c7853edc501", name: "2 inclusive funds", orderindex: 2 },
      { id: "aa65ba7b-bac2-4462-aeec-f7fb6fc5fb66", name: "2 mutually exclusive funds", orderindex: 3 },
    ] },
  },
  {
    id: "91fe79b5-8500-405e-820e-4c3c1db3532b", name: "🔍 [DS] Fund jurisdictions", type: "labels",
    value: ["6c5c3cb6-ae75-443c-8087-5d90c05a276a", "864e59b6-6fea-479b-b89c-fc2f598d31d8"],
    type_config: { options: [
      { id: "6c5c3cb6-ae75-443c-8087-5d90c05a276a", label: "Delaware", orderindex: 1 },
      { id: "864e59b6-6fea-479b-b89c-fc2f598d31d8", label: "Ireland", orderindex: 9 },
    ] },
  },
  { id: "d35773c1-5023-41cf-acce-86db37cd507b", name: "🔍 [DS] Number of subdocs", type: "number", value: "2" },
  {
    id: "6a5e711f-9fa8-487e-b204-c960a7997f3e", name: "📕 Complexity Tiers", type: "drop_down", value: 1,
    type_config: { options: [
      { id: "9c6fa214-45c1-44aa-aaa1-b39f243427ed", name: "Standard", orderindex: 0 },
      { id: "adb88aed-f269-4c92-8ca5-9b52e1fdcfed", name: "Intermediate", orderindex: 1 },
    ] },
  },
];

// Target date for these fixtures: 2026-06-11 (UTC+7).
export const subFormSupport: ClickUpTask = {
  id: "sub1", name: "Fortress Lending Fund V (Unlevered) - Form Support", url: t("sub1"), parent: "fund1",
  start_date: ms("2026-06-11T02:00:00Z"), due_date: ms("2026-06-12T02:00:00Z"),
  status: { status: "in progress", color: "#4194f6" },
  priority: { priority: "high", color: "#f8ae00" },
  time_estimate: 5_400_000,
};
export const subChecklist: ClickUpTask = {
  id: "sub2", name: "Checklist Fix", url: t("sub2"), parent: "fund1",
  start_date: ms("2026-06-08T02:00:00Z"), due_date: ms("2026-06-11T02:00:00Z"),
  status: { status: "assigned ready to start", color: "#f8ae00" },
  priority: { priority: "urgent", color: "#f50000" },
  time_estimate: 3_600_000,
};
export const subUi: ClickUpTask = {
  id: "sub3", name: "UI Change", url: t("sub3"), parent: "fund2",
  start_date: ms("2026-06-09T02:00:00Z"), due_date: ms("2026-06-15T02:00:00Z"),
  status: { status: "to do", color: "#87909e" },
  priority: null,
  time_estimate: null,
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
  custom_fields: fundCustomFields,
  folder: { name: "Fortress", hidden: false },
  list: { name: "Fortress Lending Fund V - Subscription Booklet" },
};
export const fund2: ClickUpTask = {
  id: "fund2", name: "Gilde Healthcare GHPE V", url: t("fund2"), parent: null,
  start_date: null, due_date: null,
  markdown_description: "Kickoff notes only.",
  attachments: [],
  folder: { name: "hidden", hidden: true },
  list: { name: "Gilde Healthcare" },
};
