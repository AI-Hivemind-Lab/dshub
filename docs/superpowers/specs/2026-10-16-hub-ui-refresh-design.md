# Team Hub — UI Refresh & Task Details Design

**Date:** 2026-10-16
**Status:** Approved in brainstorming, pending spec review
**Owner:** Toai Nguyen
**Builds on:** `docs/superpowers/specs/2026-10-06-team-hub-today-view-design.md` (v1)

## 1. Purpose

v1's `/today` page works but is a single plain column. This update:

1. Gives it a polished look (the "soft & friendly" style) and uses the page width with a **list + detail** layout.
2. Groups funds by **urgency**.
3. Shows more task information: sub-task status, priority and time estimate, plus selected fund facts and the fund's description notes.

This update is presentation-only plus extra read-only fields. It makes **no writes to ClickUp** and adds no new ClickUp requests.

### Change from v1
v1 said "task status is never displayed". This spec **reverses that**: sub-task status is now shown (§5.1).

### Out of scope
- Time tracking and writing "🙆‍♂️ [PIC] Actual Working Hours" (separate spec, next)
- Complexity fields
- Keyboard arrow-key navigation
- Remembering the selected fund across visits
- Search or filtering
- Any ClickUp write

## 2. Layout

```
┌───────────────────────────────────────────────────────────────────────┐
│ Team Hub   ◀ Fri, Oct 16 ▶ [📅] today      updated 3 min ago · ⟳   Toai · Sign out │
├───────────────────────────────────────────────────────────────────────┤
│ (banners: error / stale / invalid date / unlinked account)            │
├──────────────────────┬────────────────────────────────────────────────┤
│ DUE TODAY · 2        │ <Fund title> ↗                                 │
│ ● Bain Capital …  ⚑H │ Bain Capital · <list name>                     │
│ ● PDF annotation     │ [Target delivery][Expected launch][Server]...  │
│ THIS WEEK · 1        │ YOUR SUB-TASKS                                 │
│ ● Fortress …         │  Checklist & UI Fix ↗ [status] ⚑ High 1h  today│
│ LATER · 1            │ CHANNELS  [💬 CS thread ↗] [🧪 Testing ↗]       │
│ ● Update Review      │ FILES     …                                    │
│                      │ NOTES     (only if non-empty)                  │
└──────────────────────┴────────────────────────────────────────────────┘
```

- **Top bar:** brand; date nav (◀ date ▶, a date-picker form, a "today" chip when viewing today, otherwise a "Jump to today" link); "updated N min ago" (+ " · stale" when stale) and ⟳ Refresh; user name and Sign out.
- Refresh sits in the date nav, before the "updated N min ago" label.
- **Banners:** full width, between the top bar and the panes.
- **Panes:** at ≥ 900px wide, the list is 300px, sticky, with its own scroll, and the detail panel fills the rest. Below 900px they stack (list on top, then detail).
- **Empty day:** the existing empty-state copy, centred, in place of both panes.
- The v1 summary line ("N sub-tasks · M fund tasks") is removed; group headings carry the counts.
- Missing channel links render as quiet chips: "💬 No CS channel" and "🧪 No testing channel". No files and no hidden images renders "No attachments".

## 3. Behaviour

### 3.1 Selection (client-side, instant)
- Clicking a list item swaps the detail panel instantly, with no reload. The data for all funds is already on the page.
- The selection is written to the URL as `?fund=<parentId>` with `history.replaceState`. Other query parameters are kept.
- The server reads `?fund=` and renders that fund selected, so a reload or shared link shows the same fund, and the page is readable before JavaScript runs.
- If `?fund=` is missing or not in today's list, the **first fund in list order** is selected. No error is shown.

### 3.2 Date navigation keeps the fund
The prev/next links, the "Jump to today" link, the date-picker form (hidden `fund` input) and Refresh all carry the current `fund` value. On the new date, rule §3.1 applies: it's kept if present, otherwise the first fund is selected.

### 3.3 Urgency grouping
For each fund, `earliestDue` is the minimum `dueDate` of its listed sub-tasks. Relative to the **viewed date** `D`:

| Group | Rule |
|---|---|
| **Due today** | `earliestDue == D` |
| **This week** | `D < earliestDue ≤ D + 6 days` |
| **Later** | `earliestDue > D + 6 days`, or no due date |

- Within a group, funds are sorted by `earliestDue` ascending, then by name (case-insensitive).
- Empty groups are not rendered.
- A group heading shows its count, e.g. "Due today · 2".

### 3.4 List item content
Each list item shows:
- an urgency dot (red for due today, amber for this week, grey for later);
- the fund name, truncated with "…" and the full name in a `title` tooltip;
- a sub-line with "N sub-task(s)" and, if any sub-task has a priority, the **top priority** (e.g. "⚑ High"). Priority rank: urgent > high > normal > low;
- ⚠ when the fund's details failed to load.

## 4. Visual style ("soft & friendly")

All colours are CSS variables in `app/globals.css`, with a warm dark theme under `prefers-color-scheme: dark`.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f6f4ef` | `#1c1b19` |
| `--sidebar` | `#efece5` | `#24221f` |
| `--surface` | `#ffffff` | `#2b2926` |
| `--text` / `--muted` | `#2b2a27` / `#6b655a` | `#ece9e2` / `#9d978b` |
| `--chip-cs-bg` / `--chip-cs-fg` | `#e3ecff` / `#3451b2` | `#25304d` / `#a9bcf5` |
| `--chip-test-bg` / `--chip-test-fg` | `#e6f4ea` / `#256a3a` | `#1f3527` / `#9fd3ae` |
| `--chip-off-bg` / `--chip-off-fg` | `#f0eee9` / `#6f695e` | `#2f2d29` / `#9a9488` |
| `--urg-today` / `--urg-week` / `--urg-later` | `#e5534b` / `#e0a33b` / `#c4bfb4` | `#f0766f` / `#e8b65e` / `#6f6a61` |

- **Type:** system font stack. Fund title 17px/600, body 13px, section labels 10px uppercase with letter-spacing, muted.
- **Shape:** panels 14px radius, rows and fact tiles 10px, chips fully rounded. Soft shadow `0 1px 4px rgba(0,0,0,.06)`.
- **Selected list item:** `--surface` background plus a soft shadow. It also shows a 3px accent bar on its left edge.
- **Status pill:** the text is the ClickUp status colour mixed 35% toward `--text` (`color-mix`), on a tint of that colour at about 15% opacity, so it stays readable in both themes.
- **Priority flag:** "⚑ <Priority>" in ClickUp's priority colour, likewise mixed 35% toward `--text` for readability in both themes.
- **Focus:** a visible focus outline on every interactive element. List items are `<button>` elements.
- **External links:** `target="_blank" rel="noreferrer"`, marked with ↗.
- **Fact grid:** 4 columns at ≥ 900px, 2 columns below.
- **Dependencies:** none new. Plain CSS.

## 5. Task information

### 5.1 Sub-task row
Shown in this order:
1. **Short name** (link to the ClickUp task).
2. **Status pill:** `status.status` text with `status.color`. Hidden if there's no status.
3. **Priority flag:** `priority.priority`, capitalised, with `priority.color`. Hidden if `priority` is null.
4. **Estimate:** from `time_estimate` (ms), formatted per §5.4. Hidden if null or 0.
5. **Dates:** as v1 ("due Oct 16" or "Oct 12 → Oct 23").

**Short name:** if the sub-task name starts with the parent fund's name, remove that prefix and any following separator characters (spaces, `-`, `–`, `—`, `:`). If the result is empty, use the full name. Groups with no parent (the task is its own group), and funds whose parent failed to load, show the full name.

### 5.2 Fund detail header
- Title: the fund name with a ClickUp link ↗.
- Sub-line: `<client> · <list>`, where client = `folder.name` (omitted when the folder is hidden/folderless, i.e. `folder.hidden === true`) and list = `list.name`. Missing parts are omitted, and so is the sub-line if both are missing.

### 5.3 Fund facts
These are read from the parent task's `custom_fields`, **matched by field ID**:

| Label | Field (as named in ClickUp) | Field ID | Type → display |
|---|---|---|---|
| Target delivery | 📕 [DO] Initial Target Delivery Date | `d6383cc7-7921-4655-b0eb-bc5dbbc8ef23` | date (ms string) → local short date "Oct 21" (UTC+7) |
| Expected launch | 📕 [GTM] Expected Launch Date | `cf3b66ac-573c-4f52-8c62-323638c11967` | date → "Oct 5" |
| Server | 📕 [GTM] Server | `ac4b808b-9094-4219-ac14-41df4f0eac81` | labels (array of option IDs) → option `label`s joined ", " |
| Structure | 🔍 [DS] Fund Structure | `3ab4b383-df56-40f2-9a84-4a00e7d9adc6` | drop_down (value = option `orderindex`, a number) → option `name` |
| Jurisdictions | 🔍 [DS] Fund jurisdictions | `91fe79b5-8500-405e-820e-4c3c1db3532b` | labels → option `label`s joined ", " |
| Subdocs | 🔍 [DS] Number of subdocs | `d35773c1-5023-41cf-acce-86db37cd507b` | number → as text |

Rules:
- Facts appear in the table's order.
- A fact is **omitted** when the field is absent, its value is null or empty, an option can't be resolved, or its type isn't the one expected. A labels field drops IDs it can't resolve, and is omitted only if none resolve.
- If no facts remain, the grid is hidden.
- The field IDs live in one constant in `lib/prep/facts.ts`.

### 5.4 Estimate format
`ms` is rounded to the nearest minute:
- under 60 min → `"45m"`;
- whole hours → `"2h"`;
- otherwise → `"1h 30m"`.

### 5.5 Notes
- Source: the parent's `markdown_description`, or `description` if that's empty.
- Remove every line that contains a Slack URL (`*.slack.com`), trim, and collapse three or more consecutive newlines to two. If nothing is left, there are no notes and the section is hidden.
- Render as text with line breaks preserved. Markdown links `[label](http…)` become anchors showing `label`. Everything else is plain text, escaped by React. Only `http`/`https` URLs become links.

### 5.6 Load-error fund
Shows ⚠ in the list. The panel shows "Couldn't load details" plus the ClickUp link and the sub-task rows. Facts, channels, files and notes are hidden.

## 6. Architecture & units

There are no changes to the ClickUp client's requests, the caching or the day-view service. The new fields come from responses the app already fetches: sub-task fields from the filtered team tasks list, and fund fields from `GET /task/{id}`. **Verify at the start of implementation** that the list response includes `status`, `priority` and `time_estimate`, and that the task response includes `custom_fields[].type_config.options`, `folder` and `list`. If any is missing, stop and revisit the design rather than adding requests.

| Unit | Change |
|---|---|
| `lib/clickup/types.ts` | Add optional fields to `ClickUpTask`: `status?: { status: string; color: string }`, `priority?: { priority: string; color: string } \| null`, `time_estimate?: number \| null`, `custom_fields?: ClickUpCustomField[]`, `folder?: { name: string; hidden?: boolean }`, `list?: { name: string }`. Add `ClickUpCustomField { id; name; type; value?; type_config?: { options?: { id; name?; label?; orderindex }[] } }`. In the REST API, `labels` options carry their text in `label` and `drop_down` options in `name` (verified 2026-10-16); the data assumptions above were also verified that day. |
| `lib/prep/types.ts` | `SubTask` gains `shortName`, `status: { label; color } \| null`, `priority: { label; color; rank } \| null` and `estimateMs: number \| null`. `FundGroup` gains `client: string \| null`, `listName: string \| null`, `facts: FundFact[]`, `notes: string \| null` and `topPriority: { label; color } \| null`. Add `FundFact { label: string; value: string }` and `UrgencyGroup { key: "today" \| "week" \| "later"; label: string; funds: FundGroup[] }`. |
| `lib/prep/facts.ts` (new) | `FACT_FIELDS` constant; `extractFundFacts(parent, offsetMin): FundFact[]`. |
| `lib/prep/notes.ts` (new) | `extractNotes(text): string \| null`; `toNoteParts(notes): Array<{ text: string } \| { label: string; url: string }>`. |
| `lib/prep/names.ts` (new) | `shortSubtaskName(name, parentName): string`. |
| `lib/prep/format.ts` (new) | `formatEstimate(ms): string`. |
| `lib/prep/urgency.ts` (new) | `groupByUrgency(funds, date): UrgencyGroup[]`. |
| `lib/prep/priority.ts` (new) | `toPriority(raw)`, `topPriority(subtasks)`, `safeColor(c)` (only `#hex` colours pass; others fall back to the muted colour). |
| `lib/prep/build.ts` | Fill the new `SubTask` and `FundGroup` fields from the raw tasks. |
| `lib/hub/fund-param.ts` (new) | `withFundParam(href, fundId): string`; `pickSelectedFund(groups, requested): string \| null`. |
| `app/today/fund-detail.tsx` (new) | Pure view of one `FundGroup`: header, facts, sub-task rows, channels, files, notes, load-error state. |
| `app/today/fund-browser.tsx` (new) | Controlled view: renders the urgency-grouped list and `<FundDetail>` for `selectedId`; calls `onSelect(id)` on click. |
| `app/today/today-screen.tsx` (`"use client"`) | The single client boundary. Holds `selectedId` state (initial value from `pickSelectedFund`), so the top-bar date links and `<FundBrowser>` share it. Renders the top bar (brand, date nav, updated, `userArea` slot), banners, and `<FundBrowser>` or the empty state. On select it updates `?fund=` with `history.replaceState` and drops a sticky `refresh=1`. |
| `app/today/page.tsx` | Reads `searchParams.fund` and passes it through. It builds the `userArea` node (name plus the Sign out form with its server action) and passes it to `TodayScreen`. |
| `app/globals.css` | Rewritten with the §4 tokens and layout. |

## 7. Testing

- **Unit:**
  - `extractFundFacts`: each type; missing, null and empty values; unknown option; wrong type; partial labels; order.
  - `extractNotes` and `toNoteParts`: links only gives `null`; mixed text; markdown links; non-http links stay text.
  - `shortSubtaskName`: prefix with each separator; no prefix; empty result.
  - `formatEstimate`: 45m, 1h, 1h 30m, rounding.
  - `groupByUrgency`: boundaries at D, D+6, D+7; sorting; empty groups dropped.
  - `topPriority`.
  - `withFundParam`, `pickSelectedFund`.
- **Render** (`renderToStaticMarkup`):
  - `FundDetail`: full fund, load-error fund, fund with no facts and no notes.
  - `TodayScreen` / `FundBrowser` initial render: groups and counts; selected item from `fund`; fallback to the first fund; date links carry `fund`; empty state; banners.
- **Fixtures:** extend `lib/clickup/test-fixtures.ts` with status, priority, estimate, custom fields (using the real field IDs and option shapes above), folder and list.
- **Manual (preview browser):**
  - Click-to-switch is instant and updates `?fund=`.
  - Reload keeps the selection.
  - Layout at about 1400px and about 700px.
  - Dark mode.
  - Real data for Oct 16 matches ClickUp.
