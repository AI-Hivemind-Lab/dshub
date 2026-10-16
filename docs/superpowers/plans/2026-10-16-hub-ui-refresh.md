# Hub UI Refresh & Task Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `/today` as a soft-styled list + detail layout grouped by urgency, and show sub-task status/priority/estimate plus fund facts and notes.

**Architecture:** All new logic is pure functions in `lib/prep` and `lib/hub`, unit-tested in Vitest's node environment. The UI keeps its server-rendered page. `app/today/today-screen.tsx` becomes the single `"use client"` boundary: it holds the selected fund and syncs it to `?fund=` with `history.replaceState`. The other components are pure and render with `react-dom/server`'s `renderToStaticMarkup` in tests. The data comes from ClickUp responses the app already fetches, so there are no new requests and no writes.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vitest 5 (node environment, `@/` alias → repo root, config in `vitest.config.mts`), plain CSS.

**Spec:** `docs/superpowers/specs/2026-10-16-hub-ui-refresh-design.md`

## Global Constraints

- No new ClickUp requests, no ClickUp writes, no new npm dependencies.
- Fact field IDs (verbatim):
  - Target delivery: `d6383cc7-7921-4655-b0eb-bc5dbbc8ef23` (date)
  - Expected launch: `cf3b66ac-573c-4f52-8c62-323638c11967` (date)
  - Server: `ac4b808b-9094-4219-ac14-41df4f0eac81` (labels)
  - Structure: `3ab4b383-df56-40f2-9a84-4a00e7d9adc6` (drop_down)
  - Jurisdictions: `91fe79b5-8500-405e-820e-4c3c1db3532b` (labels)
  - Subdocs: `d35773c1-5023-41cf-acce-86db37cd507b` (number)
- ClickUp REST shapes (verified 2026-10-16):
  - `labels` options carry their text in `label`; `drop_down` options carry it in `name`.
  - A drop_down value is the option's numeric `orderindex`.
  - Date and number values are strings.
- Urgency groups relative to the viewed date D, using each fund's earliest sub-task due date:
  - `Due today`: due == D
  - `This week`: D < due ≤ D+6
  - `Later`: due > D+6, or no due date
- Within a group, funds sort by earliest due, then name (case-insensitive). Empty groups are not rendered.
- Priority rank: urgent (1) > high (2) > normal (3) > low (4).
- UI copy (verbatim):
  - `Nothing in flight for this date. Only open tasks are shown.`
  - `Couldn't load details`
  - `Your Google account (<email>) isn't linked to a ClickUp member.`
  - `No attachments`
  - `(N images hidden)`
  - `💬 No CS channel`
  - `🧪 No testing channel`
  - `Due today`, `This week`, `Later`
  - `Jump to today`, `today`
  - `Your sub-tasks`, `Channels`, `Files`, `Notes`
  - `Team Hub`
- Layout: two panes at ≥ 900px wide (list 300px, sticky); stacked below 900px. The fact grid has 4 columns at ≥ 900px and 2 below.
- Only `app/today/today-screen.tsx` may contain `"use client"`.
- Do not mention any external skill or tool that inspired the rules in code, comments or docs.
- Every commit message ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (passed as a second `-m`).

## File Structure

```
lib/prep/format.ts         formatEstimate(ms)                         (new)
lib/prep/names.ts          shortSubtaskName(name, parentName)         (new)
lib/prep/notes.ts          extractNotes(text), toNoteParts(notes)     (new)
lib/clickup/types.ts       + status, priority, time_estimate, custom_fields, folder, list
lib/prep/facts.ts          FACT_FIELDS, extractFundFacts(parent, off) (new)
lib/clickup/test-fixtures.ts  + realistic custom fields, statuses, priorities, folder/list
lib/prep/types.ts          SubTask/FundGroup gain fields; Priority, TaskStatus, FundFact, UrgencyGroup
lib/prep/priority.ts       safeColor, toPriority, topPriority         (new)
lib/prep/build.ts          fills the new fields
lib/prep/urgency.ts        groupByUrgency(funds, date)                (new)
lib/prep/test-funds.ts     makeSubTask/makeFund test builders         (new, used by tests only)
lib/hub/fund-param.ts      withFundParam(href, id), pickSelectedFund  (new)
app/today/fund-detail.tsx  pure detail panel                          (new)
app/today/fund-browser.tsx pure list + detail (controlled)            (new)
app/today/today-screen.tsx "use client" shell: top bar, banners, selection state (rewritten)
app/today/page.tsx         passes ?fund= and the userArea node
app/globals.css            soft style tokens + layout (rewritten)
```

---

### Task 1: Pure text helpers (estimate, short names, notes)

**Files:**
- Create: `lib/prep/format.ts`, `lib/prep/names.ts`, `lib/prep/notes.ts`
- Test: `lib/prep/format.test.ts`, `lib/prep/names.test.ts`, `lib/prep/notes.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `formatEstimate(ms: number | null | undefined): string`. Returns `""` for null, undefined or ≤ 0. Otherwise it rounds to minutes (at least 1) and returns `"45m"`, `"2h"` or `"1h 30m"`.
  - `shortSubtaskName(name: string, parentName: string | null): string`
  - `extractNotes(text: string | null | undefined): string | null`
  - `type NotePart = { text: string } | { label: string; url: string }`
  - `toNoteParts(notes: string): NotePart[]`

- [ ] **Step 1: Write the failing tests**

`lib/prep/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatEstimate } from "./format";

const min = (n: number) => n * 60_000;

describe("formatEstimate", () => {
  it("formats minutes, whole hours and mixed", () => {
    expect(formatEstimate(min(45))).toBe("45m");
    expect(formatEstimate(min(60))).toBe("1h");
    expect(formatEstimate(min(120))).toBe("2h");
    expect(formatEstimate(min(90))).toBe("1h 30m");
  });
  it("rounds to the nearest minute, minimum 1m", () => {
    expect(formatEstimate(min(89) + 29_000)).toBe("1h 29m");
    expect(formatEstimate(min(89) + 31_000)).toBe("1h 30m");
    expect(formatEstimate(20_000)).toBe("1m");
  });
  it("returns empty for missing or non-positive values", () => {
    expect(formatEstimate(null)).toBe("");
    expect(formatEstimate(undefined)).toBe("");
    expect(formatEstimate(0)).toBe("");
    expect(formatEstimate(-5)).toBe("");
  });
});
```

`lib/prep/names.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { shortSubtaskName } from "./names";

const PARENT = "Update - Bain Capital Global Special Situations III - Subscription Booklet - Items 1-4, 6-7";

describe("shortSubtaskName", () => {
  it("strips the parent name and the separator", () => {
    expect(shortSubtaskName(`${PARENT} - Checklist & UI Fix`, PARENT)).toBe("Checklist & UI Fix");
  });
  it("handles en dash, em dash and colon separators", () => {
    expect(shortSubtaskName("Fund A – UI Change", "Fund A")).toBe("UI Change");
    expect(shortSubtaskName("Fund A — UI Change", "Fund A")).toBe("UI Change");
    expect(shortSubtaskName("Fund A: UI Change", "Fund A")).toBe("UI Change");
  });
  it("keeps the full name when there is no matching prefix", () => {
    expect(shortSubtaskName("PDF annotation", "Fund A")).toBe("PDF annotation");
  });
  it("only strips at a separator boundary", () => {
    expect(shortSubtaskName("Fund VI - Form Support", "Fund V")).toBe("Fund VI - Form Support");
  });
  it("keeps the full name when nothing would remain", () => {
    expect(shortSubtaskName("Fund A", "Fund A")).toBe("Fund A");
    expect(shortSubtaskName("Fund A - ", "Fund A")).toBe("Fund A - ");
  });
  it("keeps the full name without a parent", () => {
    expect(shortSubtaskName("Form Support", null)).toBe("Form Support");
  });
});
```

`lib/prep/notes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { extractNotes, toNoteParts } from "./notes";

const CS = "[CS channel](https://anduin.slack.com/archives/C0354FJ3UGL/p1791997922825769?thread_ts=1790133217.354219&cid=C0354FJ3UGL)";
const TEST = "[Testing channel](https://anduin.slack.com/archives/C0C437AK9BQ)";

describe("extractNotes", () => {
  it("returns null when the description is only Slack links", () => {
    expect(extractNotes(`${CS}\n\n${TEST}`)).toBeNull();
  });
  it("keeps other text, drops Slack lines, collapses blank runs", () => {
    expect(extractNotes(`Kickoff notes.\n\n${CS}\n\n\n\nReuse checklist v3.\n${TEST}\n`)).toBe(
      "Kickoff notes.\n\nReuse checklist v3.",
    );
  });
  it("returns null for empty input", () => {
    expect(extractNotes(null)).toBeNull();
    expect(extractNotes(undefined)).toBeNull();
    expect(extractNotes("  \n ")).toBeNull();
  });
});

describe("toNoteParts", () => {
  it("splits markdown links into link parts", () => {
    expect(toNoteParts("See [spec](https://x.example/a) now")).toEqual([
      { text: "See " },
      { label: "spec", url: "https://x.example/a" },
      { text: " now" },
    ]);
  });
  it("leaves plain text and non-http links as text", () => {
    expect(toNoteParts("plain")).toEqual([{ text: "plain" }]);
    expect(toNoteParts("[x](javascript:alert(1))")).toEqual([{ text: "[x](javascript:alert(1))" }]);
  });
  it("handles a link at the very start and end", () => {
    expect(toNoteParts("[a](https://a.example)")).toEqual([{ label: "a", url: "https://a.example" }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/prep/format lib/prep/names lib/prep/notes`
Expected: FAIL. Cannot find modules `./format`, `./names`, `./notes`.

- [ ] **Step 3: Implement**

`lib/prep/format.ts`:
```ts
/** ClickUp time estimate (ms) → "45m", "2h" or "1h 30m"; "" when missing or ≤ 0. */
export function formatEstimate(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "";
  const totalMin = Math.max(1, Math.round(ms / 60_000));
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
```

`lib/prep/names.ts`:
```ts
const SEPARATOR_START = /^[\s\-–—:]/;
const SEPARATORS = /^[\s\-–—:]+/;

/** Drops a leading copy of the parent's name (at a separator boundary) from a sub-task name. */
export function shortSubtaskName(name: string, parentName: string | null): string {
  if (!parentName || !name.startsWith(parentName)) return name;
  const rest = name.slice(parentName.length);
  if (!SEPARATOR_START.test(rest)) return name;
  const short = rest.replace(SEPARATORS, "");
  return short || name;
}
```

`lib/prep/notes.ts`:
```ts
const SLACK_URL = /https?:\/\/[a-z0-9-]+\.slack\.com\//i;
const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export type NotePart = { text: string } | { label: string; url: string };

/** Fund description minus its Slack-link lines; null when nothing else is left. */
export function extractNotes(text: string | null | undefined): string | null {
  if (!text) return null;
  const kept = text
    .split("\n")
    .filter((line) => !SLACK_URL.test(line))
    .join("\n");
  const tidy = kept.replace(/\n{3,}/g, "\n\n").trim();
  return tidy === "" ? null : tidy;
}

/** Splits notes into text and http(s) markdown-link parts for rendering. */
export function toNoteParts(notes: string): NotePart[] {
  const parts: NotePart[] = [];
  let last = 0;
  for (const match of notes.matchAll(MD_LINK)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: notes.slice(last, index) });
    parts.push({ label: match[1], url: match[2] });
    last = index + match[0].length;
  }
  if (last < notes.length) parts.push({ text: notes.slice(last) });
  return parts;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/prep/format lib/prep/names lib/prep/notes`
Expected: PASS (3 files).

- [ ] **Step 5: Commit**

```bash
git add lib/prep/format.ts lib/prep/names.ts lib/prep/notes.ts lib/prep/format.test.ts lib/prep/names.test.ts lib/prep/notes.test.ts
git commit -m "feat: add estimate, short-name and notes helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: ClickUp field types, fund facts, fixtures

**Files:**
- Modify: `lib/clickup/types.ts`, `lib/prep/types.ts` (add `FundFact` only), `lib/clickup/test-fixtures.ts`
- Create: `lib/prep/facts.ts`
- Test: `lib/prep/facts.test.ts`

**Interfaces:**
- Consumes: `formatShortDate(date: string): string` and `toLocalDate(ms: number, offsetMin: number): string` from `lib/prep/dates.ts` (existing)
- Produces:
  - `interface ClickUpCustomFieldOption { id: string; name?: string; label?: string; orderindex: number | string }`
  - `interface ClickUpCustomField { id: string; name: string; type: string; value?: unknown; type_config?: { options?: ClickUpCustomFieldOption[] } }`
  - `ClickUpTask` gains optional `status?: { status: string; color: string }`, `priority?: { priority: string; color: string } | null`, `time_estimate?: number | null`, `custom_fields?: ClickUpCustomField[]`, `folder?: { name: string; hidden?: boolean }` and `list?: { name: string }`.
  - `interface FundFact { label: string; value: string }` in `lib/prep/types.ts`
  - `FACT_FIELDS` and `extractFundFacts(parent: Pick<ClickUpTask, "custom_fields">, offsetMin: number): FundFact[]`
  - Fixtures: `fundCustomFields: ClickUpCustomField[]`. `fund1` gains `custom_fields: fundCustomFields`, `folder: { name: "Fortress", hidden: false }` and `list: { name: "Fortress Lending Fund V - Subscription Booklet" }`. `fund2` gains `folder: { name: "hidden", hidden: true }` and `list: { name: "Gilde Healthcare" }`. `subFormSupport`, `subChecklist` and `subUi` gain status, priority and estimate (values below).

- [ ] **Step 1: Extend the ClickUp types** — in `lib/clickup/types.ts`, replace the `ClickUpTask` interface and add the two new interfaces above it:

```ts
export interface ClickUpCustomFieldOption {
  id: string;
  name?: string;
  label?: string;
  orderindex: number | string;
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value?: unknown;
  type_config?: { options?: ClickUpCustomFieldOption[] };
}

export interface ClickUpTask {
  id: string;
  name: string;
  url: string;
  parent: string | null;
  start_date: string | null;
  due_date: string | null;
  description?: string | null;
  markdown_description?: string | null;
  attachments?: ClickUpAttachment[];
  status?: { status: string; color: string };
  priority?: { priority: string; color: string } | null;
  time_estimate?: number | null;
  custom_fields?: ClickUpCustomField[];
  folder?: { name: string; hidden?: boolean };
  list?: { name: string };
}
```

- [ ] **Step 2: Add `FundFact`** — append to `lib/prep/types.ts`:

```ts
export interface FundFact {
  label: string;
  value: string;
}
```

- [ ] **Step 3: Extend the fixtures** — in `lib/clickup/test-fixtures.ts`:

Change the first import line to:
```ts
import type { ClickUpCustomField, ClickUpTask } from "./types";
```

Replace the `subFormSupport`, `subChecklist` and `subUi` definitions with:
```ts
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
```

Add, above `fund1`:
```ts
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
```

In `fund1`, after the `attachments` array, add:
```ts
  custom_fields: fundCustomFields,
  folder: { name: "Fortress", hidden: false },
  list: { name: "Fortress Lending Fund V - Subscription Booklet" },
```

In `fund2`, after `attachments: [],`, add:
```ts
  folder: { name: "hidden", hidden: true },
  list: { name: "Gilde Healthcare" },
```

Note: renaming `subFormSupport`'s `name` does not affect existing tests. They assert on IDs, and `build.test.ts`'s `toSubTask` expectation is rewritten in Task 3. Check with `grep -rn '"Form Support"' lib app`. If any assertion relies on the old name, update its expected string to the new name.

- [ ] **Step 4: Write the failing facts test** — `lib/prep/facts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ClickUpCustomField } from "@/lib/clickup/types";
import { fundCustomFields } from "@/lib/clickup/test-fixtures";
import { extractFundFacts } from "./facts";

const OFFSET = 420;
const withField = (id: string, patch: Partial<ClickUpCustomField>) =>
  fundCustomFields.map((f) => (f.id === id ? { ...f, ...patch } : f));

const TARGET = "d6383cc7-7921-4655-b0eb-bc5dbbc8ef23";
const LAUNCH = "cf3b66ac-573c-4f52-8c62-323638c11967";
const SERVER = "ac4b808b-9094-4219-ac14-41df4f0eac81";
const STRUCTURE = "3ab4b383-df56-40f2-9a84-4a00e7d9adc6";
const JURIS = "91fe79b5-8500-405e-820e-4c3c1db3532b";
const SUBDOCS = "d35773c1-5023-41cf-acce-86db37cd507b";

describe("extractFundFacts", () => {
  it("extracts the six facts in order and ignores other fields", () => {
    expect(extractFundFacts({ custom_fields: fundCustomFields }, OFFSET)).toEqual([
      { label: "Target delivery", value: "Oct 20" },
      { label: "Expected launch", value: "Oct 5" },
      { label: "Server", value: "Global" },
      { label: "Structure", value: "2 mutually exclusive funds" },
      { label: "Jurisdictions", value: "Delaware, Ireland" },
      { label: "Subdocs", value: "2" },
    ]);
  });

  it("keeps the fixed order regardless of field order", () => {
    const reversed = [...fundCustomFields].reverse();
    expect(extractFundFacts({ custom_fields: reversed }, OFFSET).map((f) => f.label)).toEqual([
      "Target delivery", "Expected launch", "Server", "Structure", "Jurisdictions", "Subdocs",
    ]);
  });

  it("converts dates using the timezone offset", () => {
    // 1791147600000 = 2026-10-04T17:00Z → Oct 5 in UTC+7, Oct 4 in UTC
    expect(extractFundFacts({ custom_fields: fundCustomFields }, 0)[1]).toEqual({ label: "Expected launch", value: "Oct 4" });
  });

  it("returns nothing without custom fields", () => {
    expect(extractFundFacts({}, OFFSET)).toEqual([]);
  });

  it("omits null, empty and empty-array values", () => {
    const fields = withField(TARGET, { value: null })
      .map((f) => (f.id === SERVER ? { ...f, value: [] } : f))
      .map((f) => (f.id === SUBDOCS ? { ...f, value: "" } : f));
    const labels = extractFundFacts({ custom_fields: fields }, OFFSET).map((f) => f.label);
    expect(labels).toEqual(["Expected launch", "Structure", "Jurisdictions"]);
  });

  it("omits an unknown drop_down option", () => {
    const labels = extractFundFacts({ custom_fields: withField(STRUCTURE, { value: 42 }) }, OFFSET).map((f) => f.label);
    expect(labels).not.toContain("Structure");
  });

  it("drops unknown label ids, and omits the fact if none resolve", () => {
    const partial = withField(JURIS, { value: ["6c5c3cb6-ae75-443c-8087-5d90c05a276a", "nope"] });
    expect(extractFundFacts({ custom_fields: partial }, OFFSET).find((f) => f.label === "Jurisdictions")?.value).toBe("Delaware");
    const none = withField(JURIS, { value: ["nope"] });
    expect(extractFundFacts({ custom_fields: none }, OFFSET).map((f) => f.label)).not.toContain("Jurisdictions");
  });

  it("omits a field whose type is not the expected one", () => {
    const labels = extractFundFacts({ custom_fields: withField(SUBDOCS, { type: "short_text" }) }, OFFSET).map((f) => f.label);
    expect(labels).not.toContain("Subdocs");
  });

  it("omits a non-numeric date", () => {
    const labels = extractFundFacts({ custom_fields: withField(LAUNCH, { value: "soon" }) }, OFFSET).map((f) => f.label);
    expect(labels).not.toContain("Expected launch");
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run lib/prep/facts`
Expected: FAIL. Cannot find module `./facts`.

- [ ] **Step 6: Implement** — `lib/prep/facts.ts`:

```ts
import type { ClickUpCustomField, ClickUpCustomFieldOption, ClickUpTask } from "@/lib/clickup/types";
import { formatShortDate, toLocalDate } from "./dates";
import type { FundFact } from "./types";

type FactKind = "date" | "labels" | "drop_down" | "number";

/** Fund facts shown in the detail panel, matched by ClickUp custom-field ID (stable across renames). */
export const FACT_FIELDS: ReadonlyArray<{ label: string; id: string; kind: FactKind }> = [
  { label: "Target delivery", id: "d6383cc7-7921-4655-b0eb-bc5dbbc8ef23", kind: "date" },
  { label: "Expected launch", id: "cf3b66ac-573c-4f52-8c62-323638c11967", kind: "date" },
  { label: "Server", id: "ac4b808b-9094-4219-ac14-41df4f0eac81", kind: "labels" },
  { label: "Structure", id: "3ab4b383-df56-40f2-9a84-4a00e7d9adc6", kind: "drop_down" },
  { label: "Jurisdictions", id: "91fe79b5-8500-405e-820e-4c3c1db3532b", kind: "labels" },
  { label: "Subdocs", id: "d35773c1-5023-41cf-acce-86db37cd507b", kind: "number" },
];

// labels options carry their text in `label`, drop_down options in `name`.
const optionText = (o: ClickUpCustomFieldOption): string | null => o.label ?? o.name ?? null;

function formatValue(field: ClickUpCustomField, kind: FactKind, offsetMin: number): string | null {
  if (field.type !== kind) return null;
  const value = field.value;
  if (value === null || value === undefined || value === "") return null;
  const options = field.type_config?.options ?? [];
  switch (kind) {
    case "date": {
      const ms = Number(value);
      return Number.isFinite(ms) ? formatShortDate(toLocalDate(ms, offsetMin)) : null;
    }
    case "number": {
      const n = Number(value);
      return Number.isFinite(n) ? String(n) : null;
    }
    case "drop_down": {
      const option = options.find((o) => Number(o.orderindex) === Number(value));
      return option ? optionText(option) : null;
    }
    case "labels": {
      if (!Array.isArray(value)) return null;
      const names = value
        .map((id) => options.find((o) => o.id === id))
        .map((o) => (o ? optionText(o) : null))
        .filter((s): s is string => Boolean(s));
      return names.length > 0 ? names.join(", ") : null;
    }
  }
}

export function extractFundFacts(parent: Pick<ClickUpTask, "custom_fields">, offsetMin: number): FundFact[] {
  const byId = new Map((parent.custom_fields ?? []).map((f) => [f.id, f]));
  const facts: FundFact[] = [];
  for (const spec of FACT_FIELDS) {
    const field = byId.get(spec.id);
    const value = field ? formatValue(field, spec.kind, offsetMin) : null;
    if (value) facts.push({ label: spec.label, value });
  }
  return facts;
}
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run lib/prep/facts && npm test && npx tsc --noEmit`
Expected: the facts test passes, the full suite passes, and tsc reports no errors.

- [ ] **Step 8: Commit**

```bash
git add lib/clickup/types.ts lib/prep/types.ts lib/clickup/test-fixtures.ts lib/prep/facts.ts lib/prep/facts.test.ts
git commit -m "feat: read fund facts from ClickUp custom fields" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: View-model fields (status, priority, estimate, client, facts, notes)

**Files:**
- Modify: `lib/prep/types.ts`, `lib/prep/build.ts`, `lib/prep/build.test.ts`, `app/today/today-screen.test.tsx` (fixture literal only)
- Create: `lib/prep/priority.ts`
- Test: `lib/prep/priority.test.ts`, `lib/prep/build.test.ts`

**Interfaces:**
- Consumes: `shortSubtaskName` (Task 1), `extractNotes` (Task 1), `extractFundFacts` (Task 2), the fixtures (Task 2), `FundFact` (Task 2)
- Produces:
  - `interface TaskStatus { label: string; color: string }`
  - `interface Priority { label: string; color: string; rank: number }`. `label` is capitalised ("High"); `rank` is 1 for urgent through 4 for low.
  - `SubTask` = `{ id; name; shortName: string; url; startDate; dueDate; status: TaskStatus | null; priority: Priority | null; estimateMs: number | null }`
  - `FundGroup` adds `client: string | null; listName: string | null; facts: FundFact[]; notes: string | null; topPriority: Priority | null`
  - `type UrgencyKey = "today" | "week" | "later"` and `interface UrgencyGroup { key: UrgencyKey; label: string; funds: FundGroup[] }` (defined here, used in Task 4)
  - `safeColor(color: string | null | undefined): string`. Returns the input if it matches `/^#[0-9a-f]{3,8}$/i`, otherwise `"#8a8478"`.
  - `toPriority(raw: ClickUpTask["priority"]): Priority | null`
  - `topPriority(subtasks: Pick<SubTask, "priority">[]): Priority | null`
  - `toSubTask(task: ClickUpTask, offsetMin: number, parentName?: string | null): SubTask`
  - `buildFundGroup(group, parent, offsetMin)` (signature unchanged) fills the new fields.

- [ ] **Step 1: Update the view-model types** — in `lib/prep/types.ts`, replace the `SubTask` and `FundGroup` interfaces and add the new ones (keep the `FundFact` from Task 2):

```ts
export interface TaskStatus {
  label: string;
  color: string;
}

export interface Priority {
  label: string;
  color: string;
  rank: number;
}

export interface SubTask {
  id: string;
  name: string;
  shortName: string;
  url: string;
  startDate: string | null;
  dueDate: string | null;
  status: TaskStatus | null;
  priority: Priority | null;
  estimateMs: number | null;
}
```

```ts
export interface FundGroup {
  parentId: string;
  name: string;
  url: string;
  subtasks: SubTask[];
  slack: SlackLinks;
  files: FileLink[];
  hiddenImageCount: number;
  loadError: boolean;
  client: string | null;
  listName: string | null;
  facts: FundFact[];
  notes: string | null;
  topPriority: Priority | null;
}

export type UrgencyKey = "today" | "week" | "later";

export interface UrgencyGroup {
  key: UrgencyKey;
  label: string;
  funds: FundGroup[];
}
```

- [ ] **Step 2: Write the failing priority test** — `lib/prep/priority.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { safeColor, toPriority, topPriority } from "./priority";

describe("safeColor", () => {
  it("passes hex colours and replaces anything else", () => {
    expect(safeColor("#f8ae00")).toBe("#f8ae00");
    expect(safeColor("#FFF")).toBe("#FFF");
    expect(safeColor("red; background:url(x)")).toBe("#8a8478");
    expect(safeColor(null)).toBe("#8a8478");
  });
});

describe("toPriority", () => {
  it("maps ClickUp priorities to label and rank", () => {
    expect(toPriority({ priority: "urgent", color: "#f50000" })).toEqual({ label: "Urgent", color: "#f50000", rank: 1 });
    expect(toPriority({ priority: "high", color: "#f8ae00" })).toEqual({ label: "High", color: "#f8ae00", rank: 2 });
    expect(toPriority({ priority: "normal", color: "#6fddff" })?.rank).toBe(3);
    expect(toPriority({ priority: "LOW", color: "#d8d8d8" })).toEqual({ label: "Low", color: "#d8d8d8", rank: 4 });
  });
  it("returns null for missing or unknown priorities", () => {
    expect(toPriority(null)).toBeNull();
    expect(toPriority(undefined)).toBeNull();
    expect(toPriority({ priority: "someday", color: "#000" })).toBeNull();
  });
});

describe("topPriority", () => {
  it("picks the most urgent", () => {
    const high = { label: "High", color: "#f8ae00", rank: 2 };
    const urgent = { label: "Urgent", color: "#f50000", rank: 1 };
    expect(topPriority([{ priority: high }, { priority: null }, { priority: urgent }])).toEqual(urgent);
  });
  it("returns null when none have a priority", () => {
    expect(topPriority([{ priority: null }])).toBeNull();
    expect(topPriority([])).toBeNull();
  });
});
```

- [ ] **Step 3: Rewrite the `toSubTask` test and add new build tests** — in `lib/prep/build.test.ts`, replace the whole `describe("toSubTask", ...)` block with:

```ts
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
```

Change the file's fixture import line to:
```ts
import { THREAD_URL, TESTING_URL, fund1, fund2, subChecklist, subFormSupport, subUi } from "@/lib/clickup/test-fixtures";
```

Inside `describe("buildFundGroup", ...)`, add these tests after the existing ones:
```ts
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run lib/prep/priority lib/prep/build`
Expected: FAIL. Cannot find module `./priority`, and the build tests fail on missing fields.

- [ ] **Step 5: Implement priority** — `lib/prep/priority.ts`:

```ts
import type { ClickUpTask } from "@/lib/clickup/types";
import type { Priority, SubTask } from "./types";

const RANK: Record<string, number> = { urgent: 1, high: 2, normal: 3, low: 4 };
const FALLBACK_COLOR = "#8a8478";

/** Only plain hex colours from ClickUp reach inline styles. */
export function safeColor(color: string | null | undefined): string {
  return color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : FALLBACK_COLOR;
}

export function toPriority(raw: ClickUpTask["priority"]): Priority | null {
  if (!raw?.priority) return null;
  const key = raw.priority.toLowerCase();
  const rank = RANK[key];
  if (!rank) return null;
  return { label: key.charAt(0).toUpperCase() + key.slice(1), color: safeColor(raw.color), rank };
}

export function topPriority(subtasks: Pick<SubTask, "priority">[]): Priority | null {
  let best: Priority | null = null;
  for (const s of subtasks) {
    if (s.priority && (!best || s.priority.rank < best.rank)) best = s.priority;
  }
  return best;
}
```

- [ ] **Step 6: Update the builder** — replace `lib/prep/build.ts` with:

```ts
import type { ClickUpTask } from "@/lib/clickup/types";
import { filterAttachments } from "./attachments";
import { toLocalDate } from "./dates";
import { extractFundFacts } from "./facts";
import { shortSubtaskName } from "./names";
import { extractNotes } from "./notes";
import { safeColor, toPriority, topPriority } from "./priority";
import { parseSlackLinks } from "./slack";
import type { FundGroup, SubTask, TaskGroup } from "./types";

export function toSubTask(task: ClickUpTask, offsetMin: number, parentName: string | null = null): SubTask {
  return {
    id: task.id,
    name: task.name,
    shortName: shortSubtaskName(task.name, parentName),
    url: task.url,
    startDate: task.start_date ? toLocalDate(Number(task.start_date), offsetMin) : null,
    dueDate: task.due_date ? toLocalDate(Number(task.due_date), offsetMin) : null,
    status: task.status ? { label: task.status.status, color: safeColor(task.status.color) } : null,
    priority: toPriority(task.priority),
    estimateMs: task.time_estimate && task.time_estimate > 0 ? task.time_estimate : null,
  };
}

function byDueDate(a: SubTask, b: SubTask): number {
  if (a.dueDate === b.dueDate) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

export function buildFundGroup(group: TaskGroup, parent: ClickUpTask | null, offsetMin: number): FundGroup {
  const subtasks = group.members.map((m) => toSubTask(m, offsetMin, parent?.name ?? null)).sort(byDueDate);
  const top = topPriority(subtasks);
  if (!parent) {
    return {
      parentId: group.parentId,
      name: `Task ${group.parentId}`,
      url: `https://app.clickup.com/t/${group.parentId}`,
      subtasks,
      slack: { cs: null, testing: null },
      files: [],
      hiddenImageCount: 0,
      loadError: true,
      client: null,
      listName: null,
      facts: [],
      notes: null,
      topPriority: top,
    };
  }
  const description = parent.markdown_description || parent.description || "";
  const { files, hiddenImageCount } = filterAttachments(parent.attachments ?? []);
  return {
    parentId: group.parentId,
    name: parent.name,
    url: parent.url,
    subtasks,
    slack: parseSlackLinks(description),
    files,
    hiddenImageCount,
    loadError: false,
    client: parent.folder && !parent.folder.hidden ? parent.folder.name : null,
    listName: parent.list?.name ?? null,
    facts: extractFundFacts(parent, offsetMin),
    notes: extractNotes(description),
    topPriority: top,
  };
}
```

- [ ] **Step 7: Keep the existing screen test compiling** — in `app/today/today-screen.test.tsx`, replace the `fortress` constant with the following. It will be rewritten in Task 6, and this change only keeps tsc green:

```ts
const fortress: FundGroup = {
  parentId: "fund1",
  name: "Fortress Lending Fund V (Unlevered)",
  url: "https://app.clickup.com/t/fund1",
  subtasks: [
    { id: "sub2", name: "Checklist Fix", shortName: "Checklist Fix", url: "https://app.clickup.com/t/sub2", startDate: "2026-06-08", dueDate: "2026-06-11", status: null, priority: null, estimateMs: null },
    { id: "sub1", name: "Form Support", shortName: "Form Support", url: "https://app.clickup.com/t/sub1", startDate: "2026-06-11", dueDate: "2026-06-11", status: null, priority: null, estimateMs: null },
  ],
  slack: {
    cs: { url: "https://anduin.slack.com/archives/C111/p1717000000000100?thread_ts=1", isThread: true },
    testing: null,
  },
  files: [{ title: "SubDoc_v3.pdf", url: "https://files/SubDoc_v3.pdf" }],
  hiddenImageCount: 2,
  loadError: false,
  client: null,
  listName: null,
  facts: [],
  notes: null,
  topPriority: null,
};
```

- [ ] **Step 8: Run tests and typecheck**

Run: `npx vitest run lib/prep && npm test && npx tsc --noEmit`
Expected: everything passes, and tsc reports no errors.

- [ ] **Step 9: Commit**

```bash
git add lib/prep/types.ts lib/prep/priority.ts lib/prep/priority.test.ts lib/prep/build.ts lib/prep/build.test.ts app/today/today-screen.test.tsx
git commit -m "feat: add status, priority, estimate, facts and notes to the view model" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Urgency grouping and fund selection helpers

**Files:**
- Create: `lib/prep/urgency.ts`, `lib/prep/test-funds.ts`, `lib/hub/fund-param.ts`
- Test: `lib/prep/urgency.test.ts`, `lib/hub/fund-param.test.ts`

**Interfaces:**
- Consumes: `FundGroup`, `SubTask`, `UrgencyGroup`, `UrgencyKey` (Task 3); `addDays(date: string, n: number): string` from `lib/prep/dates.ts` (existing)
- Produces:
  - `groupByUrgency(funds: FundGroup[], date: string): UrgencyGroup[]`. Group order is today, week, later; empty groups are dropped. Labels are `"Due today"`, `"This week"` and `"Later"`.
  - `makeSubTask(overrides?: Partial<SubTask>): SubTask` and `makeFund(overrides?: Partial<FundGroup>): FundGroup` in `lib/prep/test-funds.ts`. These are test builders (the defaults are below) and are reused by Tasks 5 and 6.
  - `withFundParam(href: string, fundId: string | null): string`. Returns `pathname + search` with `fund` set or removed; other parameters are kept.
  - `pickSelectedFund(groups: UrgencyGroup[], requested: string | null | undefined): string | null`

- [ ] **Step 1: Create the test builders** — `lib/prep/test-funds.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing tests**

`lib/prep/urgency.test.ts`:
```ts
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
```

`lib/hub/fund-param.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { makeFund } from "@/lib/prep/test-funds";
import type { UrgencyGroup } from "@/lib/prep/types";
import { pickSelectedFund, withFundParam } from "./fund-param";

describe("withFundParam", () => {
  it("adds, replaces and removes the fund parameter", () => {
    expect(withFundParam("/today?date=2026-06-10", "f1")).toBe("/today?date=2026-06-10&fund=f1");
    expect(withFundParam("/today?date=2026-06-10&fund=old", "f1")).toBe("/today?date=2026-06-10&fund=f1");
    expect(withFundParam("/today?date=2026-06-10&fund=f1", null)).toBe("/today?date=2026-06-10");
  });
  it("keeps other parameters and accepts absolute URLs", () => {
    expect(withFundParam("/today?date=2026-06-10&refresh=1", "f1")).toBe("/today?date=2026-06-10&refresh=1&fund=f1");
    expect(withFundParam("http://localhost:3000/today?date=2026-06-10", "f1")).toBe("/today?date=2026-06-10&fund=f1");
  });
});

describe("pickSelectedFund", () => {
  const groups: UrgencyGroup[] = [
    { key: "today", label: "Due today", funds: [makeFund({ parentId: "f1" })] },
    { key: "later", label: "Later", funds: [makeFund({ parentId: "f2" })] },
  ];
  it("returns the requested fund when it is listed", () => {
    expect(pickSelectedFund(groups, "f2")).toBe("f2");
  });
  it("falls back to the first fund in list order", () => {
    expect(pickSelectedFund(groups, "gone")).toBe("f1");
    expect(pickSelectedFund(groups, null)).toBe("f1");
    expect(pickSelectedFund(groups, undefined)).toBe("f1");
  });
  it("returns null when there are no funds", () => {
    expect(pickSelectedFund([], "f1")).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/prep/urgency lib/hub/fund-param`
Expected: FAIL. Cannot find modules `./urgency` and `./fund-param`.

- [ ] **Step 4: Implement**

`lib/prep/urgency.ts`:
```ts
import { addDays } from "./dates";
import type { FundGroup, UrgencyGroup, UrgencyKey } from "./types";

const ORDER: UrgencyKey[] = ["today", "week", "later"];
const LABELS: Record<UrgencyKey, string> = { today: "Due today", week: "This week", later: "Later" };

function earliestDue(fund: FundGroup): string | null {
  let earliest: string | null = null;
  for (const s of fund.subtasks) {
    if (s.dueDate && (earliest === null || s.dueDate < earliest)) earliest = s.dueDate;
  }
  return earliest;
}

function urgencyOf(due: string | null, date: string): UrgencyKey {
  if (!due || due > addDays(date, 6)) return "later";
  return due <= date ? "today" : "week";
}

export function groupByUrgency(funds: FundGroup[], date: string): UrgencyGroup[] {
  const entries = funds.map((fund) => ({ fund, due: earliestDue(fund) }));
  return ORDER.map((key) => ({
    key,
    label: LABELS[key],
    funds: entries
      .filter((e) => urgencyOf(e.due, date) === key)
      .sort((a, b) => {
        const da = a.due ?? "9999-12-31";
        const db = b.due ?? "9999-12-31";
        if (da !== db) return da < db ? -1 : 1;
        return a.fund.name.localeCompare(b.fund.name, undefined, { sensitivity: "base" });
      })
      .map((e) => e.fund),
  })).filter((g) => g.funds.length > 0);
}
```

`lib/hub/fund-param.ts`:
```ts
import type { UrgencyGroup } from "@/lib/prep/types";

/** Returns `pathname + search` of `href` with `fund` set (or removed when null); other params are kept. */
export function withFundParam(href: string, fundId: string | null): string {
  const url = new URL(href, "http://localhost");
  if (fundId) url.searchParams.set("fund", fundId);
  else url.searchParams.delete("fund");
  return `${url.pathname}${url.search}`;
}

/** The requested fund if it is listed, otherwise the first fund in list order. */
export function pickSelectedFund(groups: UrgencyGroup[], requested: string | null | undefined): string | null {
  const funds = groups.flatMap((g) => g.funds);
  if (requested && funds.some((f) => f.parentId === requested)) return requested;
  return funds[0]?.parentId ?? null;
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run lib/prep/urgency lib/hub/fund-param && npx tsc --noEmit`
Expected: both test files pass, and tsc reports no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/prep/urgency.ts lib/prep/urgency.test.ts lib/prep/test-funds.ts lib/hub/fund-param.ts lib/hub/fund-param.test.ts
git commit -m "feat: group funds by urgency and resolve the selected fund" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Fund detail panel

**Files:**
- Create: `app/today/fund-detail.tsx`
- Test: `app/today/fund-detail.test.tsx`

**Interfaces:**
- Consumes: `FundGroup`, `SubTask`, `SlackLink` (Task 3); `formatEstimate` and `toNoteParts` (Task 1); `formatShortDate` (existing); `makeFund` and `makeSubTask` (Task 4)
- Produces:
  - `FundDetail({ fund }: { fund: FundGroup }): JSX.Element`. It is pure, with no hooks.
  - `dateRange(start: string | null, due: string | null): string`
  - CSS classes used (styled in Task 7):
    - `detail`, `detail-title`, `detail-sub`, `detail-error`
    - `facts`, `fact`, `section-label`
    - `subtask-list`, `subtask`, `subtask-name`
    - `status-pill` (with inline `--status`), `priority`, `estimate`, `dates`
    - `chips`, `chip`, `chip-cs`, `chip-test`, `chip-file`, `chip-off`
    - `images-hidden`, `notes`

- [ ] **Step 1: Write the failing test** — `app/today/fund-detail.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeFund, makeSubTask } from "@/lib/prep/test-funds";
import { FundDetail } from "./fund-detail";

const render = (el: React.ReactElement) =>
  renderToStaticMarkup(el).replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");

describe("FundDetail", () => {
  it("renders the header, facts, sub-task row, channels and files", () => {
    const html = render(<FundDetail fund={makeFund()} />);
    expect(html).toContain('href="https://app.clickup.com/t/f1"');
    expect(html).toContain("Fund A ↗");
    expect(html).toContain("Fortress · Fund A - Subscription Booklet");
    expect(html).toContain("<dt>Target delivery</dt><dd>Oct 20</dd>");
    expect(html).toContain("<dt>Server</dt><dd>Global</dd>");
    expect(html).toContain("Your sub-tasks");
    expect(html).toContain("Checklist Fix ↗");
    expect(html).toContain('title="Fund A - Checklist Fix"');
    expect(html).toContain('style="--status:#4194f6"');
    expect(html).toContain("in progress");
    expect(html).toContain("⚑ High");
    expect(html).toContain("⏱ 1h 30m");
    expect(html).toContain("due Jun 11");
    expect(html).toContain("💬 CS channel (thread) ↗");
    expect(html).toContain("🧪 Testing channel ↗");
    expect(html).toContain("📎 SubDoc_v3.pdf ↗");
    expect(html).not.toContain("Notes");
  });

  it("shows a date range and omits empty status, priority and estimate", () => {
    const sub = makeSubTask({ startDate: "2026-06-08", dueDate: "2026-06-11", status: null, priority: null, estimateMs: null });
    const html = render(<FundDetail fund={makeFund({ subtasks: [sub] })} />);
    expect(html).toContain("Jun 8 → Jun 11");
    expect(html).not.toContain("status-pill");
    expect(html).not.toContain("⚑");
    expect(html).not.toContain("⏱");
  });

  it("uses quiet chips for missing channels and files", () => {
    const html = render(
      <FundDetail fund={makeFund({ slack: { cs: null, testing: null }, files: [], hiddenImageCount: 0 })} />,
    );
    expect(html).toContain("💬 No CS channel");
    expect(html).toContain("🧪 No testing channel");
    expect(html).toContain("No attachments");
  });

  it("counts hidden images instead of 'No attachments'", () => {
    const html = render(<FundDetail fund={makeFund({ files: [], hiddenImageCount: 2 })} />);
    expect(html).toContain("(2 images hidden)");
    expect(html).not.toContain("No attachments");
  });

  it("renders notes with clickable markdown links", () => {
    const html = render(<FundDetail fund={makeFund({ notes: "Reuse [checklist v3](https://x.example/c3).\nThanks" })} />);
    expect(html).toContain("Notes");
    expect(html).toContain('<a href="https://x.example/c3" target="_blank" rel="noreferrer">checklist v3</a>');
    expect(html).toContain("Thanks");
  });

  it("hides the fact grid and the sub-line when empty", () => {
    const html = render(<FundDetail fund={makeFund({ facts: [], client: null, listName: null })} />);
    expect(html).not.toContain('class="facts"');
    expect(html).not.toContain("detail-sub");
  });

  it("shows only the error, link and sub-tasks for a load-error fund", () => {
    const html = render(
      <FundDetail fund={makeFund({ loadError: true, name: "Task f9", url: "https://app.clickup.com/t/f9" })} />,
    );
    expect(html).toContain("Couldn't load details");
    expect(html).toContain('href="https://app.clickup.com/t/f9"');
    expect(html).toContain("Checklist Fix");
    expect(html).not.toContain("Channels");
    expect(html).not.toContain('class="facts"');
    expect(html).not.toContain("Files");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/today/fund-detail`
Expected: FAIL. Cannot find module `./fund-detail`.

- [ ] **Step 3: Implement** — `app/today/fund-detail.tsx`:

```tsx
import type { CSSProperties } from "react";
import { formatShortDate } from "@/lib/prep/dates";
import { formatEstimate } from "@/lib/prep/format";
import { toNoteParts } from "@/lib/prep/notes";
import type { FundGroup, SlackLink, SubTask } from "@/lib/prep/types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function dateRange(start: string | null, due: string | null): string {
  if (!due) return "";
  if (!start || start === due) return `due ${formatShortDate(due)}`;
  return `${formatShortDate(start)} → ${formatShortDate(due)}`;
}

function SlackChip(props: { icon: string; label: string; missingLabel: string; link: SlackLink | null; className: string }) {
  const { icon, label, missingLabel, link, className } = props;
  if (!link) return <span className="chip chip-off">{icon} {missingLabel}</span>;
  return (
    <a className={`chip ${className}`} href={link.url} target="_blank" rel="noreferrer">
      {icon} {label}{link.isThread ? " (thread)" : ""} ↗
    </a>
  );
}

function Files({ fund }: { fund: FundGroup }) {
  const hidden = fund.hiddenImageCount;
  if (fund.files.length === 0 && hidden === 0) {
    return (
      <div className="chips">
        <span className="chip chip-off">No attachments</span>
      </div>
    );
  }
  return (
    <div className="chips">
      {fund.files.map((f) => (
        <a key={f.url} className="chip chip-file" href={f.url} target="_blank" rel="noreferrer">
          📎 {f.title} ↗
        </a>
      ))}
      {hidden > 0 && <span className="images-hidden">({plural(hidden, "image")} hidden)</span>}
    </div>
  );
}

function SubTaskRow({ sub }: { sub: SubTask }) {
  const estimate = formatEstimate(sub.estimateMs);
  return (
    <li className="subtask">
      <a className="subtask-name" href={sub.url} target="_blank" rel="noreferrer" title={sub.name}>
        {sub.shortName} ↗
      </a>
      {sub.status && (
        <span className="status-pill" style={{ "--status": sub.status.color } as CSSProperties}>
          {sub.status.label}
        </span>
      )}
      {sub.priority && (
        <span className="priority" style={{ color: sub.priority.color }}>
          ⚑ {sub.priority.label}
        </span>
      )}
      {estimate && <span className="estimate">⏱ {estimate}</span>}
      <span className="dates">{dateRange(sub.startDate, sub.dueDate)}</span>
    </li>
  );
}

function Notes({ notes }: { notes: string }) {
  return (
    <p className="notes">
      {toNoteParts(notes).map((part, i) =>
        "url" in part ? (
          <a key={i} href={part.url} target="_blank" rel="noreferrer">{part.label}</a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

export function FundDetail({ fund }: { fund: FundGroup }) {
  const subline = [fund.client, fund.listName].filter(Boolean).join(" · ");
  return (
    <article className="detail">
      <header>
        <h2 className="detail-title">
          <a href={fund.url} target="_blank" rel="noreferrer">{fund.name} ↗</a>
        </h2>
        {subline && <p className="detail-sub">{subline}</p>}
      </header>
      {fund.loadError && <p className="detail-error">Couldn&apos;t load details</p>}
      {!fund.loadError && fund.facts.length > 0 && (
        <dl className="facts">
          {fund.facts.map((f) => (
            <div className="fact" key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <h3 className="section-label">Your sub-tasks</h3>
      <ul className="subtask-list">
        {fund.subtasks.map((s) => (
          <SubTaskRow key={s.id} sub={s} />
        ))}
      </ul>
      {!fund.loadError && (
        <>
          <h3 className="section-label">Channels</h3>
          <div className="chips">
            <SlackChip icon="💬" label="CS channel" missingLabel="No CS channel" link={fund.slack.cs} className="chip-cs" />
            <SlackChip icon="🧪" label="Testing channel" missingLabel="No testing channel" link={fund.slack.testing} className="chip-test" />
          </div>
          <h3 className="section-label">Files</h3>
          <Files fund={fund} />
          {fund.notes && (
            <>
              <h3 className="section-label">Notes</h3>
              <Notes notes={fund.notes} />
            </>
          )}
        </>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run app/today/fund-detail && npx tsc --noEmit`
Expected: PASS (7 tests), and tsc reports no errors.

- [ ] **Step 5: Commit**

```bash
git add app/today/fund-detail.tsx app/today/fund-detail.test.tsx
git commit -m "feat: add fund detail panel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: List + detail browser, client shell, page wiring

**Files:**
- Create: `app/today/fund-browser.tsx`
- Rewrite: `app/today/today-screen.tsx`, `app/today/today-screen.test.tsx`
- Modify: `app/today/page.tsx`
- Test: `app/today/fund-browser.test.tsx`, `app/today/today-screen.test.tsx`

**Interfaces:**
- Consumes:
  - `FundDetail` (Task 5)
  - `groupByUrgency` (Task 4)
  - `withFundParam` and `pickSelectedFund` (Task 4)
  - `makeFund` and `makeSubTask` (Task 4)
  - `UrgencyGroup` (Task 3)
  - `DayViewResult` (existing, from `lib/hub/day-view.ts`)
  - `addDays` and `formatLongDate` (existing)
- Produces:
  - `FundBrowser({ groups, selectedId, onSelect }: { groups: UrgencyGroup[]; selectedId: string | null; onSelect: (id: string) => void })`. It is pure and controlled.
  - `TodayScreen(props: { date: string; today: string; notice: string | null; result: DayViewResult | null; unmappedEmail: string | null; nowMs: number; initialFundId: string | null; userArea: ReactNode })`. Its file starts with `"use client"`.
  - CSS classes used (styled in Task 7):
    - Top bar: `topbar`, `brand`, `date-nav`, `today-chip`, `today-link`, `date-form`, `refresh`, `updated`
    - Banners and empty state: `banner`, `banner-error`, `banner-notice`, `empty-state`
    - List: `browser`, `fund-list`, `fund-group`, `group-label`, `fund-item`, `is-selected`, `urgency-dot`, `urgency-today`, `urgency-week`, `urgency-later`, `fund-item-name`, `fund-item-meta`
    - Page (in `page.tsx`): `page`, `user-area`, `user`, `link-button`

- [ ] **Step 1: Write the failing tests**

`app/today/fund-browser.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeFund, makeSubTask } from "@/lib/prep/test-funds";
import type { UrgencyGroup } from "@/lib/prep/types";
import { FundBrowser } from "./fund-browser";

const render = (el: React.ReactElement) =>
  renderToStaticMarkup(el).replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");

const groups: UrgencyGroup[] = [
  {
    key: "today",
    label: "Due today",
    funds: [
      makeFund({ parentId: "f1", name: "Bain Capital GSS III", subtasks: [makeSubTask({ id: "a" }), makeSubTask({ id: "b" })] }),
      makeFund({ parentId: "f2", name: "PDF annotation", topPriority: null, loadError: true }),
    ],
  },
  { key: "later", label: "Later", funds: [makeFund({ parentId: "f3", name: "Update Review" })] },
];

describe("FundBrowser", () => {
  it("renders urgency groups with counts and dots", () => {
    const html = render(<FundBrowser groups={groups} selectedId="f1" onSelect={() => {}} />);
    expect(html).toContain("Due today · 2");
    expect(html).toContain("Later · 1");
    expect(html).toContain("urgency-dot urgency-today");
    expect(html).toContain("urgency-dot urgency-later");
    expect(html.indexOf("Due today")).toBeLessThan(html.indexOf("Later"));
  });

  it("shows sub-task count, top priority and the load-error mark", () => {
    const html = render(<FundBrowser groups={groups} selectedId="f1" onSelect={() => {}} />);
    expect(html).toContain("2 sub-tasks");
    expect(html).toContain(" · ⚑ High");
    expect(html).toContain(" · ⚠");
    expect(html).toContain('title="Bain Capital GSS III"');
  });

  it("marks the selected fund and shows its detail", () => {
    const html = render(<FundBrowser groups={groups} selectedId="f3" onSelect={() => {}} />);
    expect(html).toMatch(/class="fund-item is-selected" aria-current="true" title="Update Review"/);
    expect(html.match(/is-selected/g)).toHaveLength(1);
    expect(html).toContain('<h2 class="detail-title"><a href="https://app.clickup.com/t/f1" target="_blank" rel="noreferrer">Update Review ↗</a>');
  });
});
```

Note: `makeFund` defaults `url` to `https://app.clickup.com/t/f1`, so the detail title for "Update Review" links to `/t/f1`. The last assertion relies on this on purpose.

`app/today/today-screen.test.tsx` (replace the whole file):
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DayViewResult } from "@/lib/hub/day-view";
import { makeFund, makeSubTask } from "@/lib/prep/test-funds";
import type { FundGroup } from "@/lib/prep/types";
import { TodayScreen, type TodayScreenProps } from "./today-screen";

const render = (el: React.ReactElement) =>
  renderToStaticMarkup(el).replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");

const NOW = Date.parse("2026-06-11T03:00:00Z");
const D = "2026-06-11";

const due = (id: string, name: string, dueDate: string) =>
  makeFund({ parentId: id, name, subtasks: [makeSubTask({ id: `${id}-s`, dueDate })] });

const result = (groups: FundGroup[], extra: Partial<DayViewResult> = {}): DayViewResult => ({
  view: { date: D, subtaskCount: groups.reduce((n, g) => n + g.subtasks.length, 0), groups },
  fetchedAt: NOW - 2 * 60_000,
  stale: false,
  error: null,
  ...extra,
});

const funds = [due("f1", "Today fund", D), due("f2", "Week fund", "2026-06-14"), due("f3", "Later fund", "2026-06-30")];

const base: TodayScreenProps = {
  date: D,
  today: D,
  notice: null,
  result: result(funds),
  unmappedEmail: null,
  nowMs: NOW,
  initialFundId: null,
  userArea: <span className="user-area">USER-AREA</span>,
};

describe("TodayScreen", () => {
  it("renders the top bar with brand, date, updated label and user area", () => {
    const html = render(<TodayScreen {...base} />);
    expect(html).toContain("Team Hub");
    expect(html).toContain("Thu, Jun 11, 2026");
    expect(html).toContain('<span class="today-chip">today</span>');
    expect(html).toContain("updated 2 min ago");
    expect(html).toContain("USER-AREA");
  });

  it("groups funds by urgency in order", () => {
    const html = render(<TodayScreen {...base} />);
    const [a, b, c] = ["Due today · 1", "This week · 1", "Later · 1"].map((s) => html.indexOf(s));
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("selects the requested fund, or falls back to the first", () => {
    expect(render(<TodayScreen {...base} initialFundId="f2" />)).toMatch(/is-selected" aria-current="true" title="Week fund"/);
    expect(render(<TodayScreen {...base} initialFundId="gone" />)).toMatch(/is-selected" aria-current="true" title="Today fund"/);
  });

  it("carries the selected fund in every date link", () => {
    const html = render(<TodayScreen {...base} initialFundId="f2" />);
    expect(html).toContain('href="/today?date=2026-06-10&fund=f2"');
    expect(html).toContain('href="/today?date=2026-06-12&fund=f2"');
    expect(html).toContain('href="/today?date=2026-06-11&refresh=1&fund=f2"');
    // React's server renderer emits `value` after the other attributes, so match loosely.
    expect(html).toMatch(/<input type="hidden" name="fund"[^>]*value="f2"/);
  });

  it("offers 'Jump to today' when viewing another day", () => {
    const html = render(<TodayScreen {...base} date="2026-06-12" initialFundId="f1" />);
    expect(html).toContain('<a class="today-link" href="/today?date=2026-06-11&fund=f1">Jump to today</a>');
    expect(html).not.toContain("today-chip");
  });

  it("shows the empty state for a quiet day", () => {
    const html = render(<TodayScreen {...base} result={result([])} />);
    expect(html).toContain("Nothing in flight for this date. Only open tasks are shown.");
    expect(html).not.toContain("fund-list");
    expect(html).not.toContain('name="fund"');
  });

  it("shows banners for notice, unlinked account, error and stale data", () => {
    const html = render(
      <TodayScreen
        {...base}
        notice={`"2026-13-01" isn't a valid date, showing today instead.`}
        result={result(funds, { stale: true, error: "Couldn't reach ClickUp (unavailable)" })}
      />,
    );
    expect(html).toContain('class="banner banner-notice"');
    expect(html).toContain("isn't a valid date");
    expect(html).toContain('class="banner banner-error"');
    expect(html).toContain("Couldn't reach ClickUp (unavailable)");
    expect(html).toContain("updated 2 min ago · stale");

    const unmapped = render(<TodayScreen {...base} result={null} unmappedEmail="new@anduintransact.com" />);
    expect(unmapped).toContain("Your Google account (new@anduintransact.com) isn't linked to a ClickUp member.");
    expect(unmapped).not.toContain("updated");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/today/fund-browser app/today/today-screen`
Expected: FAIL. Cannot find module `./fund-browser`, and the `today-screen` tests fail on the new props and markup.

- [ ] **Step 3: Implement the browser** — `app/today/fund-browser.tsx`:

```tsx
import type { UrgencyGroup } from "@/lib/prep/types";
import { FundDetail } from "./fund-detail";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export interface FundBrowserProps {
  groups: UrgencyGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FundBrowser({ groups, selectedId, onSelect }: FundBrowserProps) {
  const selected = groups.flatMap((g) => g.funds).find((f) => f.parentId === selectedId) ?? null;
  return (
    <div className="browser">
      <nav className="fund-list" aria-label="Fund tasks">
        {groups.map((group) => (
          <section className="fund-group" key={group.key}>
            <h2 className="group-label">{group.label} · {group.funds.length}</h2>
            <ul>
              {group.funds.map((fund) => {
                const isSelected = fund.parentId === selectedId;
                return (
                  <li key={fund.parentId}>
                    <button
                      type="button"
                      className={isSelected ? "fund-item is-selected" : "fund-item"}
                      aria-current={isSelected ? "true" : undefined}
                      title={fund.name}
                      onClick={() => onSelect(fund.parentId)}
                    >
                      <span className={`urgency-dot urgency-${group.key}`} aria-hidden="true" />
                      <span className="fund-item-name">{fund.name}</span>
                      <span className="fund-item-meta">
                        {plural(fund.subtasks.length, "sub-task")}
                        {fund.topPriority && (
                          <span style={{ color: fund.topPriority.color }}> · ⚑ {fund.topPriority.label}</span>
                        )}
                        {fund.loadError && <span title="Couldn't load details"> · ⚠</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
      {selected && <FundDetail fund={selected} />}
    </div>
  );
}
```

- [ ] **Step 4: Implement the client shell** — replace `app/today/today-screen.tsx` with:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import type { DayViewResult } from "@/lib/hub/day-view";
import { pickSelectedFund, withFundParam } from "@/lib/hub/fund-param";
import { addDays, formatLongDate } from "@/lib/prep/dates";
import { groupByUrgency } from "@/lib/prep/urgency";
import { FundBrowser } from "./fund-browser";

export interface TodayScreenProps {
  date: string;
  today: string;
  notice: string | null;
  result: DayViewResult | null;
  unmappedEmail: string | null;
  nowMs: number;
  initialFundId: string | null;
  userArea: ReactNode;
}

function updatedLabel(fetchedAt: number, nowMs: number): string {
  const minutes = Math.floor((nowMs - fetchedAt) / 60_000);
  return minutes < 1 ? "updated just now" : `updated ${minutes} min ago`;
}

function DateNav({ date, today, fundId }: { date: string; today: string; fundId: string | null }) {
  const link = (d: string, extra = "") => withFundParam(`/today?date=${d}${extra}`, fundId);
  return (
    <nav className="date-nav" aria-label="Date">
      <a href={link(addDays(date, -1))} aria-label="Previous day">◀</a>
      <strong>{formatLongDate(date)}</strong>
      <a href={link(addDays(date, 1))} aria-label="Next day">▶</a>
      {date === today ? (
        <span className="today-chip">today</span>
      ) : (
        <a className="today-link" href={link(today)}>Jump to today</a>
      )}
      <form method="get" action="/today" className="date-form">
        <input type="date" name="date" defaultValue={date} aria-label="Pick a date" />
        {fundId && <input type="hidden" name="fund" value={fundId} readOnly />}
        <button type="submit">Go</button>
      </form>
      <a className="refresh" href={link(date, "&refresh=1")}>⟳ Refresh</a>
    </nav>
  );
}

export function TodayScreen(props: TodayScreenProps) {
  const { date, today, notice, result, unmappedEmail, nowMs, initialFundId, userArea } = props;
  const groups = result?.view ? groupByUrgency(result.view.groups, date) : [];
  const [selectedId, setSelectedId] = useState<string | null>(() => pickSelectedFund(groups, initialFundId));

  function handleSelect(id: string) {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("refresh");
    window.history.replaceState(null, "", withFundParam(`${url.pathname}${url.search}`, id));
  }

  return (
    <>
      <header className="topbar">
        <span className="brand">Team Hub</span>
        <DateNav date={date} today={today} fundId={selectedId} />
        {result?.view && (
          <span className="updated">
            {updatedLabel(result.fetchedAt, nowMs)}
            {result.stale ? " · stale" : ""}
          </span>
        )}
        {userArea}
      </header>
      {notice && <p className="banner banner-notice">{notice}</p>}
      {unmappedEmail && (
        <p className="banner banner-error">
          Your Google account ({unmappedEmail}) isn&apos;t linked to a ClickUp member.
        </p>
      )}
      {result?.error && <p className="banner banner-error">{result.error}</p>}
      {result?.view &&
        (groups.length === 0 ? (
          <div className="empty-state">
            <p>Nothing in flight for this date. Only open tasks are shown.</p>
          </div>
        ) : (
          <FundBrowser groups={groups} selectedId={selectedId} onSelect={handleSelect} />
        ))}
    </>
  );
}
```

- [ ] **Step 5: Wire the page** — in `app/today/page.tsx`:

Change the `SearchParams` type to:
```ts
type SearchParams = Promise<{ date?: string; refresh?: string; fund?: string }>;
```

Replace the whole `return (...)` block at the end of `TodayPage` with:
```tsx
  const userArea = (
    <div className="user-area">
      <span className="user">{session?.user?.name ?? email}</span>
      <form action={signOutAction}>
        <button type="submit" className="link-button">Sign out</button>
      </form>
    </div>
  );

  return (
    <main className="page">
      <TodayScreen
        date={date}
        today={today}
        notice={notice}
        result={result}
        unmappedEmail={unmappedEmail}
        nowMs={Date.now()}
        initialFundId={params.fund ?? null}
        userArea={userArea}
      />
    </main>
  );
```

- [ ] **Step 6: Run tests, typecheck and build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all tests pass, tsc is clean, and the build succeeds with `/today` dynamic (ƒ). The output is clean, with no React warnings.

- [ ] **Step 7: Commit**

```bash
git add app/today/fund-browser.tsx app/today/fund-browser.test.tsx app/today/today-screen.tsx app/today/today-screen.test.tsx app/today/page.tsx
git commit -m "feat: list + detail browser with urgency groups and instant fund switching" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Soft style CSS

**Files:**
- Rewrite: `app/globals.css`

**Interfaces:**
- Consumes: every class name listed in Tasks 5 and 6
- Produces: the visual style from spec §4. There are no code interfaces.

- [ ] **Step 1: Replace `app/globals.css`** with:

```css
:root {
  --bg: #f6f4ef;
  --sidebar: #efece5;
  --surface: #ffffff;
  --surface-2: #f6f4ef;
  --text: #2b2a27;
  --muted: #8a8478;
  --border: #e2ddd2;
  --accent: #3451b2;
  --chip-cs-bg: #e3ecff;
  --chip-cs-fg: #3451b2;
  --chip-test-bg: #e6f4ea;
  --chip-test-fg: #256a3a;
  --chip-file-bg: #f0eee9;
  --chip-file-fg: #4a463f;
  --chip-off-bg: #f0eee9;
  --chip-off-fg: #b0aa9f;
  --urg-today: #e5534b;
  --urg-week: #e0a33b;
  --urg-later: #c4bfb4;
  --error-bg: #fbe9e7;
  --error-fg: #9b2c22;
  --notice-bg: #fff4d9;
  --notice-fg: #7a5600;
  --shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  --radius-panel: 14px;
  --radius-row: 10px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1c1b19;
    --sidebar: #24221f;
    --surface: #2b2926;
    --surface-2: #24221f;
    --text: #ece9e2;
    --muted: #9d978b;
    --border: #3a3733;
    --accent: #a9bcf5;
    --chip-cs-bg: #25304d;
    --chip-cs-fg: #a9bcf5;
    --chip-test-bg: #1f3527;
    --chip-test-fg: #9fd3ae;
    --chip-file-bg: #2f2d29;
    --chip-file-fg: #d6d1c7;
    --chip-off-bg: #2f2d29;
    --chip-off-fg: #7a756b;
    --urg-today: #f0766f;
    --urg-week: #e8b65e;
    --urg-later: #6f6a61;
    --error-bg: #3a201d;
    --error-fg: #ffb4aa;
    --notice-bg: #3a3020;
    --notice-fg: #f3d48a;
    --shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  }
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 13px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
a { color: var(--accent); }
a:focus-visible, button:focus-visible, input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Page + top bar */
.page { max-width: 1400px; margin: 0 auto; padding: 12px 16px 32px; }
.topbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 4px 0 12px; }
.brand { font-weight: 700; font-size: 15px; }
.date-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.date-nav a { text-decoration: none; }
.date-nav strong { font-size: 14px; }
.today-chip { font-size: 11px; color: var(--muted); background: var(--surface); border-radius: 999px; padding: 1px 8px; box-shadow: var(--shadow); }
.today-link { font-size: 12px; }
.date-form { display: flex; gap: 6px; }
.date-form input, .date-form button {
  font: inherit; color: inherit; background: var(--surface);
  border: 1px solid var(--border); border-radius: 8px; padding: 2px 8px;
}
.date-form button { cursor: pointer; }
.refresh { font-size: 12px; }
.updated { margin-left: auto; color: var(--muted); font-size: 12px; }
.user-area { display: flex; align-items: center; gap: 10px; }
.user { color: var(--muted); }
.link-button { background: none; border: 0; color: var(--accent); cursor: pointer; font: inherit; padding: 0; }

/* Banners + empty state */
.banner { margin: 0 0 10px; padding: 10px 14px; border-radius: var(--radius-row); }
.banner-error { background: var(--error-bg); color: var(--error-fg); }
.banner-notice { background: var(--notice-bg); color: var(--notice-fg); }
.empty-state {
  display: flex; align-items: center; justify-content: center; min-height: 50vh; padding: 24px;
  text-align: center; color: var(--muted); background: var(--surface);
  border-radius: var(--radius-panel); box-shadow: var(--shadow);
}

/* List */
.browser { display: grid; gap: 12px; }
.fund-list { background: var(--sidebar); border-radius: var(--radius-panel); padding: 6px 0 10px; }
.group-label {
  margin: 10px 14px 4px; font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted);
}
.fund-group ul { list-style: none; margin: 0; padding: 0; }
.fund-item {
  display: grid; grid-template-columns: 8px minmax(0, 1fr); column-gap: 8px; align-items: baseline;
  width: calc(100% - 16px); margin: 2px 8px; padding: 8px 10px; text-align: left;
  background: transparent; border: 0; border-radius: var(--radius-row);
  color: inherit; font: inherit; cursor: pointer;
}
.fund-item:hover { background: color-mix(in srgb, var(--surface) 60%, transparent); }
.fund-item.is-selected { background: var(--surface); box-shadow: var(--shadow); }
.urgency-dot { grid-row: span 2; align-self: start; width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; }
.urgency-today { background: var(--urg-today); }
.urgency-week { background: var(--urg-week); }
.urgency-later { background: var(--urg-later); }
.fund-item-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fund-item-meta { color: var(--muted); font-size: 12px; }

/* Detail */
.detail { min-width: 0; padding: 18px 22px; background: var(--surface); border-radius: var(--radius-panel); box-shadow: var(--shadow); }
.detail-title { margin: 0; font-size: 17px; font-weight: 600; overflow-wrap: anywhere; }
.detail-title a { color: inherit; text-decoration: none; }
.detail-title a:hover { text-decoration: underline; }
.detail-sub { margin: 2px 0 0; color: var(--muted); }
.detail-error { margin: 12px 0 0; padding: 8px 12px; color: var(--error-fg); background: var(--error-bg); border-radius: var(--radius-row); }
.facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 14px 0 0; }
.fact { padding: 8px 10px; background: var(--surface-2); border-radius: var(--radius-row); }
.fact dt { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.fact dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
.section-label {
  margin: 18px 0 6px; font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted);
}
.subtask-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.subtask {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px;
  padding: 8px 12px; background: var(--surface-2); border-radius: var(--radius-row);
}
.subtask-name { margin-right: auto; font-weight: 500; color: inherit; text-decoration: none; }
.subtask-name:hover { text-decoration: underline; }
.status-pill {
  --status: var(--muted);
  padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
  color: var(--status); background: color-mix(in srgb, var(--status) 15%, transparent);
}
.priority { font-size: 11.5px; font-weight: 600; white-space: nowrap; }
.estimate, .dates { font-size: 12px; color: var(--muted); white-space: nowrap; }
.chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 12px; text-decoration: none; }
.chip-cs { background: var(--chip-cs-bg); color: var(--chip-cs-fg); }
.chip-test { background: var(--chip-test-bg); color: var(--chip-test-fg); }
.chip-file { background: var(--chip-file-bg); color: var(--chip-file-fg); }
.chip-off { background: var(--chip-off-bg); color: var(--chip-off-fg); }
.images-hidden { font-size: 12px; color: var(--muted); }
.notes {
  margin: 0; padding: 10px 12px; white-space: pre-wrap; overflow-wrap: anywhere;
  background: var(--surface-2); border: 1px dashed var(--border); border-radius: var(--radius-row);
}

/* Two panes on wide screens */
@media (min-width: 900px) {
  .browser { grid-template-columns: 300px minmax(0, 1fr); align-items: start; }
  .fund-list { position: sticky; top: 12px; max-height: calc(100vh - 24px); overflow-y: auto; }
  .facts { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
```

- [ ] **Step 2: Check that no class is left unstyled**

Run:
```bash
for c in topbar brand date-nav today-chip today-link date-form refresh updated user-area user link-button banner banner-error banner-notice empty-state browser fund-list fund-group group-label fund-item is-selected urgency-dot urgency-today urgency-week urgency-later fund-item-name fund-item-meta detail detail-title detail-sub detail-error facts fact section-label subtask-list subtask subtask-name status-pill priority estimate dates chips chip chip-cs chip-test chip-file chip-off images-hidden notes page; do grep -q "\.$c\b" app/globals.css || echo "missing: $c"; done
```
Expected: no output.

- [ ] **Step 3: Run tests and build**

Run: `npm test && npm run build`
Expected: all tests pass, and the build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "style: soft list + detail theme with dark mode" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Manual verification (done by the controller in the preview browser, with real data)**
  - At about 1400px wide: two panes, a sticky list, and the fact grid in 4 columns.
  - At about 700px wide: the panes stack and the facts are in 2 columns.
  - Clicking a fund swaps the panel without reloading, and `?fund=` updates. Reloading keeps the selection.
  - ◀ ▶ and Refresh keep `fund`. After a Refresh click, selecting another fund drops `refresh=1` from the URL.
  - In dark mode, the warm palette is readable.
  - The data for Oct 16 matches ClickUp: the Bain fund shows Target delivery Oct 20, Expected launch Oct 5, Server Global, Structure "2 mutually exclusive funds", Jurisdictions "Delaware, Ireland", Subdocs 2. Its sub-tasks show "assigned ready to start", ⚑ High and ⏱ 1h, and there is no Notes section.
