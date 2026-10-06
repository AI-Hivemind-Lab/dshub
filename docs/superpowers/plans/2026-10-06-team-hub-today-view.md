# Team Hub "Today" View (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Google-SSO-protected Next.js web page that shows each Digitization Squad member their ClickUp sub-tasks in flight on a chosen date. Sub-tasks are rolled up under their fund task, with CS/testing Slack links and non-image attachments.

**Architecture:** A single Next.js App Router app in one Docker container on Dokploy, with no database. Each page load fetches live from the ClickUp REST API v2 through a typed client and passes the data through pure business-rule functions (`lib/prep`). Results are cached in memory for 5 minutes. All logic lives in small, unit-tested modules, and the page is a thin server component.

**Tech Stack:** Next.js (App Router, latest, ≥15), React (latest), TypeScript, Auth.js v5 (`next-auth` 5.x) with Google provider, Vitest, Node 22, Docker.

**Spec:** `docs/superpowers/specs/2026-10-06-team-hub-today-view-design.md`

## Global Constraints

- No database, no Supabase. Deploy target is the company Dokploy (single container).
- All dates are evaluated in UTC+7 (`TZ_OFFSET`, default `+07:00`). ClickUp timestamps are Unix-ms strings in UTC.
- Sign-in: Google only, restricted to `ALLOWED_EMAIL_DOMAIN` (default `anduintransact.com`).
- Only open tasks are fetched (`include_closed=false`). Task status is never displayed.
- Default noise patterns (case-insensitive substring of task name): `estimation`, `update request`, `availability`, `slotting`, `team sync`.
- Cache TTLs: day view 5 min (key `userId:date`), parent task 5 min (key task ID, shared across users), members list 1 h.
- Parent-task fetch concurrency: 5. 429 handling: one retry, then fail.
- UI copy (verbatim): `Nothing in flight for this date. Only open tasks are shown.` · `Couldn't reach ClickUp (auth error)` · `Couldn't reach ClickUp (unavailable)` · `Couldn't load details` · `Your Google account (<email>) isn't linked to a ClickUp member.` · `not found` · `No attachments` · `(N images hidden)`.
- Do not mention any external skill or tool that inspired the rules in code, comments, or docs; the rules are the hub's own requirements.
- Every commit message ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (passed as a second `-m`).

## File Structure

```
package.json, tsconfig.json, next.config.ts, vitest.config.ts   tooling
.env.example, Dockerfile, .dockerignore, README.md              deploy/docs
auth.ts                                                         Auth.js config (Google, domain check)
app/layout.tsx, app/globals.css, app/page.tsx                   shell, styles, "/" → "/today"
app/api/health/route.ts                                         health check
app/api/auth/[...nextauth]/route.ts                             Auth.js handlers
app/today/page.tsx                                              server page: session → hub → TodayScreen
app/today/today-screen.tsx                                      presentational view (pure props → markup)
lib/config.ts                                                   env → HubConfig
lib/auth/domain.ts                                              isAllowedEmail
lib/clickup/types.ts                                            ClickUp API shapes
lib/clickup/client.ts                                           REST client, ClickUpError, retryDelayMs
lib/clickup/test-fixtures.ts                                    sample API objects for tests
lib/prep/types.ts                                               view-model types
lib/prep/dates.ts                                               offset parsing, local dates, formatting
lib/prep/window.ts                                              inWindow
lib/prep/noise.ts                                               noise patterns, isNoise
lib/prep/rollup.ts                                              rollUp
lib/prep/slack.ts                                               parseSlackLinks
lib/prep/attachments.ts                                         filterAttachments
lib/prep/build.ts                                               toSubTask, buildFundGroup
lib/cache/ttl-cache.ts                                          TtlCache
lib/hub/map-limit.ts                                            bounded-concurrency map
lib/hub/members.ts                                              email → ClickUp member resolver
lib/hub/day-view.ts                                             getDayView orchestration, describeError
lib/hub/instance.ts                                             process-wide singletons
```

Tests are colocated as `*.test.ts(x)` next to each module.

---

### Task 1: Project scaffold, tooling, health check

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `app/api/health/route.ts`
- Modify: `.gitignore`
- Test: `app/api/health/route.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `GET /api/health` → `200 {"ok":true}`; `npm test` runs Vitest; `@/` import alias maps to the repo root; `app/globals.css` CSS classes used by Task 10.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "team-hub",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install next@latest react@latest react-dom@latest
npm install -D typescript @types/node @types/react @types/react-dom vitest
npm ls next vitest
```
Expected: `next` ≥ 15.x and `vitest` are listed without errors.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

(Next may rewrite `jsx` or add entries on first build. Accept its changes.)

- [ ] **Step 4: Create `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
```

- [ ] **Step 6: Replace `.gitignore`**

```
.DS_Store
node_modules/
.next/
out/
next-env.d.ts
*.tsbuildinfo
.env*
!.env.example
```

- [ ] **Step 7: Write the failing health test** — `app/api/health/route.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns 200 with ok:true", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx vitest run app/api/health`
Expected: FAIL. Cannot resolve `./route`.

- [ ] **Step 9: Implement** — `app/api/health/route.ts`

```ts
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({ ok: true });
}
```

- [ ] **Step 10: Create the app shell**

`app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Hub",
  description: "Your ClickUp work for the day, with its Slack channels and files.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/today");
}
```

`app/globals.css`:
```css
:root {
  --bg: #f7f7f5;
  --surface: #ffffff;
  --text: #1d1d1b;
  --muted: #6b6b66;
  --border: #e3e3de;
  --accent: #2f5bd3;
  --error-bg: #fdecec;
  --error-text: #8a1c1c;
  --notice-bg: #fff6dc;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #161615;
    --surface: #20201e;
    --text: #ecece8;
    --muted: #a3a39d;
    --border: #34342f;
    --accent: #8aa8ff;
    --error-bg: #3a1d1d;
    --error-text: #ffb4b4;
    --notice-bg: #3a3320;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
a { color: var(--accent); }
.page { max-width: 860px; margin: 0 auto; padding: 16px; }
.topbar { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.brand { font-weight: 700; }
.user { margin-left: auto; color: var(--muted); }
.link-button { background: none; border: 0; color: var(--accent); cursor: pointer; font: inherit; padding: 0; }
.date-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 16px 0 4px; }
.date-nav a { text-decoration: none; }
.today-tag { font-size: 12px; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 0 8px; }
.date-form { display: flex; gap: 6px; }
.refresh { margin-left: auto; }
.updated { margin: 0 0 12px; color: var(--muted); font-size: 13px; }
.banner { padding: 8px 12px; border-radius: 6px; }
.banner.error { background: var(--error-bg); color: var(--error-text); }
.banner.notice { background: var(--notice-bg); }
.summary { color: var(--muted); }
.empty { padding: 24px 0; color: var(--muted); }
.card { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 8px; padding: 12px 16px; margin: 12px 0; }
.card h2 { font-size: 17px; margin: 0 0 6px; }
.card-error { color: var(--error-text); margin: 4px 0; }
.subtasks { margin: 4px 0; padding-left: 18px; }
.dates { color: var(--muted); font-size: 13px; }
.slack { display: flex; flex-wrap: wrap; gap: 16px; margin: 6px 0; }
.missing { color: var(--muted); }
.files { margin: 6px 0 0; overflow-wrap: anywhere; }
```

- [ ] **Step 11: Run tests and build**

Run: `npm test && npm run build`
Expected: 1 test passes, and the build completes with routes `/`, `/api/health`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and health check" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared types, date utilities, date window

**Files:**
- Create: `lib/clickup/types.ts`, `lib/prep/types.ts`, `lib/prep/dates.ts`, `lib/prep/window.ts`
- Test: `lib/prep/dates.test.ts`, `lib/prep/window.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `ClickUpTask`, `ClickUpAttachment`, `ClickUpMember` (types below)
  - `SubTask`, `SlackLink`, `SlackLinks`, `FileLink`, `FundGroup`, `DayView`, `TaskGroup` (types below)
  - `parseOffset(raw?: string): number` (minutes), `toLocalDate(ms: number, offsetMin: number): string` (`YYYY-MM-DD`), `todayLocal(offsetMin: number, now?: number): string`, `isValidDate(s: string | undefined): s is string`, `addDays(date: string, n: number): string`, `formatLongDate(date: string): string` (e.g. `Thu, Jun 11, 2026`), `formatShortDate(date: string): string` (e.g. `Jun 11`)
  - `inWindow(task: Pick<ClickUpTask, "start_date" | "due_date">, date: string, offsetMin: number): boolean`

- [ ] **Step 1: Create the type files**

`lib/clickup/types.ts`:
```ts
export interface ClickUpAttachment {
  id: string;
  title: string;
  url: string;
  extension?: string | null;
  mimetype?: string | null;
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
}

export interface ClickUpMember {
  id: number;
  username: string;
  email: string;
}
```

`lib/prep/types.ts`:
```ts
import type { ClickUpTask } from "@/lib/clickup/types";

export interface SubTask {
  id: string;
  name: string;
  url: string;
  startDate: string | null;
  dueDate: string | null;
}

export interface SlackLink {
  url: string;
  isThread: boolean;
}

export interface SlackLinks {
  cs: SlackLink | null;
  testing: SlackLink | null;
}

export interface FileLink {
  title: string;
  url: string;
}

export interface TaskGroup {
  parentId: string;
  members: ClickUpTask[];
}

export interface FundGroup {
  parentId: string;
  name: string;
  url: string;
  subtasks: SubTask[];
  slack: SlackLinks;
  files: FileLink[];
  hiddenImageCount: number;
  loadError: boolean;
}

export interface DayView {
  date: string;
  subtaskCount: number;
  groups: FundGroup[];
}
```

- [ ] **Step 2: Write failing tests** — `lib/prep/dates.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  addDays,
  formatLongDate,
  formatShortDate,
  isValidDate,
  parseOffset,
  toLocalDate,
  todayLocal,
} from "./dates";

describe("parseOffset", () => {
  it("parses positive and negative offsets to minutes", () => {
    expect(parseOffset("+07:00")).toBe(420);
    expect(parseOffset("-05:30")).toBe(-330);
  });
  it("defaults to +07:00", () => {
    expect(parseOffset()).toBe(420);
  });
  it("throws on bad input", () => {
    expect(() => parseOffset("7")).toThrow("Invalid TZ_OFFSET");
  });
});

describe("toLocalDate", () => {
  it("09:00 UTC+7 is 02:00 UTC on the same day", () => {
    expect(toLocalDate(Date.parse("2026-06-11T02:00:00Z"), 420)).toBe("2026-06-11");
  });
  it("23:30 local stays on that day", () => {
    expect(toLocalDate(Date.parse("2026-06-11T16:30:00Z"), 420)).toBe("2026-06-11");
  });
  it("18:00 UTC rolls over to the next local day", () => {
    expect(toLocalDate(Date.parse("2026-06-11T18:00:00Z"), 420)).toBe("2026-06-12");
  });
});

describe("todayLocal", () => {
  it("uses the offset", () => {
    expect(todayLocal(420, Date.parse("2026-10-05T20:00:00Z"))).toBe("2026-10-06");
  });
});

describe("isValidDate", () => {
  it("accepts real dates only", () => {
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-2-3")).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });
});

describe("addDays", () => {
  it("crosses month boundaries", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("formatting", () => {
  it("formats long and short dates", () => {
    expect(formatLongDate("2026-06-11")).toBe("Thu, Jun 11, 2026");
    expect(formatShortDate("2026-06-11")).toBe("Jun 11");
  });
});
```

`lib/prep/window.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { inWindow } from "./window";

const ms = (iso: string) => String(Date.parse(iso));
const OFFSET = 420;
const DATE = "2026-06-11";

describe("inWindow", () => {
  it("includes a task that starts on the date", () => {
    expect(inWindow({ start_date: ms("2026-06-11T02:00:00Z"), due_date: ms("2026-06-13T02:00:00Z") }, DATE, OFFSET)).toBe(true);
  });
  it("includes a task due on the date", () => {
    expect(inWindow({ start_date: ms("2026-06-08T02:00:00Z"), due_date: ms("2026-06-11T10:00:00Z") }, DATE, OFFSET)).toBe(true);
  });
  it("includes a task spanning the date", () => {
    expect(inWindow({ start_date: ms("2026-06-08T02:00:00Z"), due_date: ms("2026-06-15T02:00:00Z") }, DATE, OFFSET)).toBe(true);
  });
  it("excludes an overdue task", () => {
    expect(inWindow({ start_date: ms("2026-06-01T02:00:00Z"), due_date: ms("2026-06-10T02:00:00Z") }, DATE, OFFSET)).toBe(false);
  });
  it("excludes a task that starts later", () => {
    expect(inWindow({ start_date: ms("2026-06-12T02:00:00Z"), due_date: ms("2026-06-14T02:00:00Z") }, DATE, OFFSET)).toBe(false);
  });
  it("respects the timezone at day boundaries", () => {
    // due 2026-06-10 18:00 UTC = 2026-06-11 01:00 local → still due on the 11th
    expect(inWindow({ start_date: null, due_date: ms("2026-06-10T18:00:00Z") }, DATE, OFFSET)).toBe(true);
  });
  it("treats a missing start as the due date", () => {
    expect(inWindow({ start_date: null, due_date: ms("2026-06-11T02:00:00Z") }, DATE, OFFSET)).toBe(true);
    expect(inWindow({ start_date: null, due_date: ms("2026-06-12T02:00:00Z") }, DATE, OFFSET)).toBe(false);
  });
  it("excludes a task with no due date", () => {
    expect(inWindow({ start_date: ms("2026-06-01T02:00:00Z"), due_date: null }, DATE, OFFSET)).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/prep`
Expected: FAIL. Cannot resolve `./dates` / `./window`.

- [ ] **Step 4: Implement** — `lib/prep/dates.ts`

```ts
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseOffset(raw = "+07:00"): number {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(raw.trim());
  if (!m) throw new Error(`Invalid TZ_OFFSET: ${raw}`);
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -minutes : minutes;
}

export function toLocalDate(ms: number, offsetMin: number): string {
  return new Date(ms + offsetMin * 60_000).toISOString().slice(0, 10);
}

export function todayLocal(offsetMin: number, now: number = Date.now()): string {
  return toLocalDate(now, offsetMin);
}

export function isValidDate(s: string | undefined): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function formatLongDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
```

`lib/prep/window.ts`:
```ts
import type { ClickUpTask } from "@/lib/clickup/types";
import { toLocalDate } from "./dates";

/** True when start ≤ date ≤ due (local dates). Missing start = due; missing due = excluded. */
export function inWindow(
  task: Pick<ClickUpTask, "start_date" | "due_date">,
  date: string,
  offsetMin: number,
): boolean {
  if (!task.due_date) return false;
  const due = toLocalDate(Number(task.due_date), offsetMin);
  const start = task.start_date ? toLocalDate(Number(task.start_date), offsetMin) : due;
  return start <= date && date <= due;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/prep`
Expected: PASS (all tests in `dates.test.ts` and `window.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add lib
git commit -m "feat: add shared types, date utilities and date window rule" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Noise filter and roll-up

**Files:**
- Create: `lib/prep/noise.ts`, `lib/prep/rollup.ts`
- Test: `lib/prep/noise.test.ts`, `lib/prep/rollup.test.ts`

**Interfaces:**
- Consumes: `ClickUpTask` (Task 2), `TaskGroup` (Task 2)
- Produces:
  - `DEFAULT_NOISE_PATTERNS: string[]`
  - `parseNoisePatterns(raw?: string): string[]`
  - `isNoise(name: string, patterns: string[]): boolean`
  - `rollUp(tasks: ClickUpTask[]): TaskGroup[]` (first-seen order; members de-duplicated by `id`; orphan → its own group with `parentId = task.id`)

- [ ] **Step 1: Write failing tests**

`lib/prep/noise.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_NOISE_PATTERNS, isNoise, parseNoisePatterns } from "./noise";

describe("parseNoisePatterns", () => {
  it("uses defaults when unset or blank", () => {
    expect(parseNoisePatterns(undefined)).toEqual(DEFAULT_NOISE_PATTERNS);
    expect(parseNoisePatterns("  ")).toEqual(DEFAULT_NOISE_PATTERNS);
  });
  it("splits, trims and lowercases a custom list", () => {
    expect(parseNoisePatterns(" Foo , BAR baz,,")).toEqual(["foo", "bar baz"]);
  });
});

describe("isNoise", () => {
  it("matches default patterns case-insensitively", () => {
    for (const name of [
      "Estimation queue - Fortress",
      "UPDATE REQUEST: Gilde",
      "Availability for Q4",
      "Slotting week 41",
      "Team Sync",
    ]) {
      expect(isNoise(name, DEFAULT_NOISE_PATTERNS)).toBe(true);
    }
  });
  it("keeps real work", () => {
    expect(isNoise("Form Support", DEFAULT_NOISE_PATTERNS)).toBe(false);
    expect(isNoise("Checklist Fix", DEFAULT_NOISE_PATTERNS)).toBe(false);
  });
});
```

`lib/prep/rollup.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/prep/noise lib/prep/rollup`
Expected: FAIL. Modules not found.

- [ ] **Step 3: Implement**

`lib/prep/noise.ts`:
```ts
export const DEFAULT_NOISE_PATTERNS = [
  "estimation",
  "update request",
  "availability",
  "slotting",
  "team sync",
];

export function parseNoisePatterns(raw?: string): string[] {
  if (raw === undefined || raw.trim() === "") return [...DEFAULT_NOISE_PATTERNS];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isNoise(name: string, patterns: string[]): boolean {
  const lower = name.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}
```

`lib/prep/rollup.ts`:
```ts
import type { ClickUpTask } from "@/lib/clickup/types";
import type { TaskGroup } from "./types";

export function rollUp(tasks: ClickUpTask[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const parentId = task.parent ?? task.id;
    let group = groups.get(parentId);
    if (!group) {
      group = { parentId, members: [] };
      groups.set(parentId, group);
    }
    if (!group.members.some((m) => m.id === task.id)) group.members.push(task);
  }
  return [...groups.values()];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/prep`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prep
git commit -m "feat: add noise filter and sub-task roll-up" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Slack link parsing and attachment filtering

**Files:**
- Create: `lib/prep/slack.ts`, `lib/prep/attachments.ts`
- Test: `lib/prep/slack.test.ts`, `lib/prep/attachments.test.ts`

**Interfaces:**
- Consumes: `SlackLinks`, `SlackLink`, `FileLink` (Task 2), `ClickUpAttachment` (Task 2)
- Produces:
  - `parseSlackLinks(text: string): SlackLinks`
  - `filterAttachments(list: ClickUpAttachment[]): { files: FileLink[]; hiddenImageCount: number }`

Rules (from spec §5): a link is classified by the text between the start of its line (or the end of the previous Slack URL on that line) and the URL. A label matching `/test|qa/` means Testing. A label matching `/\bcs\b|customer|client|support/` means CS. The first link of each kind wins. Unlabeled links fill empty slots in order: CS, then Testing. Duplicate URLs are ignored. Trailing `.,;` is stripped from URLs. A link is a thread link if it has `thread_ts=` or a `/p<digits>` message path.

- [ ] **Step 1: Write failing tests**

`lib/prep/slack.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseSlackLinks } from "./slack";

const C111 = "https://anduin.slack.com/archives/C111";
const C222 = "https://anduin.slack.com/archives/C222";

describe("parseSlackLinks", () => {
  it("classifies plain labeled links", () => {
    expect(parseSlackLinks(`CS channel: ${C111}\nTesting channel: ${C222}`)).toEqual({
      cs: { url: C111, isThread: false },
      testing: { url: C222, isThread: false },
    });
  });

  it("handles markdown links and thread deep links", () => {
    const thread = "https://anduin.slack.com/archives/C111/p1717000000000100?thread_ts=1717000000.000100&cid=C111";
    const result = parseSlackLinks(`[CS thread](${thread})\n[Testing](${C222})`);
    expect(result.cs).toEqual({ url: thread, isThread: true });
    expect(result.testing).toEqual({ url: C222, isThread: false });
  });

  it("returns null for a missing kind", () => {
    expect(parseSlackLinks(`CS channel: ${C111}`).testing).toBeNull();
  });

  it("fills unlabeled links CS first, then Testing", () => {
    expect(parseSlackLinks(`Links:\n${C111}\n${C222}`)).toEqual({
      cs: { url: C111, isThread: false },
      testing: { url: C222, isThread: false },
    });
  });

  it("returns nulls when there are no Slack links", () => {
    expect(parseSlackLinks("Kickoff notes only. https://example.com")).toEqual({ cs: null, testing: null });
  });

  it("strips trailing punctuation", () => {
    expect(parseSlackLinks(`Testing: ${C222}.`).testing?.url).toBe(C222);
  });

  it("ignores a duplicate URL used as its own markdown label", () => {
    expect(parseSlackLinks(`CS: [${C111}](${C111})`)).toEqual({
      cs: { url: C111, isThread: false },
      testing: null,
    });
  });

  it("does not treat words like 'docs' as CS", () => {
    expect(parseSlackLinks(`Docs and testing: ${C222}`).testing?.url).toBe(C222);
  });
});
```

`lib/prep/attachments.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { filterAttachments } from "./attachments";

describe("filterAttachments", () => {
  it("keeps documents and counts hidden images", () => {
    const result = filterAttachments([
      { id: "1", title: "SubDoc_v3.pdf", url: "u1", extension: "pdf", mimetype: "application/pdf" },
      { id: "2", title: "image.png", url: "u2", extension: "png", mimetype: "image/png" },
      { id: "3", title: "Checklist.xlsx", url: "u3", extension: null, mimetype: null },
      { id: "4", title: "screenshot.JPG", url: "u4" },
      { id: "5", title: "scan", url: "u5", mimetype: "image/heic" },
    ]);
    expect(result.files).toEqual([
      { title: "SubDoc_v3.pdf", url: "u1" },
      { title: "Checklist.xlsx", url: "u3" },
    ]);
    expect(result.hiddenImageCount).toBe(3);
  });

  it("handles an empty list", () => {
    expect(filterAttachments([])).toEqual({ files: [], hiddenImageCount: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/prep/slack lib/prep/attachments`
Expected: FAIL. Modules not found.

- [ ] **Step 3: Implement**

`lib/prep/slack.ts`:
```ts
import type { SlackLink, SlackLinks } from "./types";

const SLACK_URL = /https?:\/\/[a-z0-9-]+\.slack\.com\/[^\s)\]>"'<|]+/gi;

type Kind = "cs" | "testing";

function classify(label: string): Kind | null {
  const l = label.toLowerCase();
  if (/test|qa/.test(l)) return "testing";
  if (/\bcs\b|customer|client|support/.test(l)) return "cs";
  return null;
}

function isThreadLink(url: string): boolean {
  return /thread_ts=/.test(url) || /\/p\d{10,}/.test(url);
}

export function parseSlackLinks(text: string): SlackLinks {
  const result: SlackLinks = { cs: null, testing: null };
  const unlabeled: SlackLink[] = [];
  const seen = new Set<string>();
  let prevEnd = 0;

  for (const match of text.matchAll(SLACK_URL)) {
    const index = match.index ?? 0;
    const url = match[0].replace(/[.,;]+$/, "");
    const lineStart = text.lastIndexOf("\n", index - 1) + 1;
    const label = text.slice(Math.max(lineStart, prevEnd), index);
    prevEnd = index + match[0].length;

    if (seen.has(url)) continue;
    seen.add(url);

    const link: SlackLink = { url, isThread: isThreadLink(url) };
    const kind = classify(label);
    if (kind) {
      if (!result[kind]) result[kind] = link;
    } else {
      unlabeled.push(link);
    }
  }

  for (const link of unlabeled) {
    if (!result.cs) result.cs = link;
    else if (!result.testing) result.testing = link;
  }
  return result;
}
```

`lib/prep/attachments.ts`:
```ts
import type { ClickUpAttachment } from "@/lib/clickup/types";
import type { FileLink } from "./types";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic", "tif", "tiff"]);

function extensionOf(a: ClickUpAttachment): string {
  const raw = a.extension ?? (a.title.includes(".") ? a.title.split(".").pop() : "") ?? "";
  return raw.toLowerCase().replace(/^\./, "");
}

export function filterAttachments(list: ClickUpAttachment[]): {
  files: FileLink[];
  hiddenImageCount: number;
} {
  const files: FileLink[] = [];
  let hiddenImageCount = 0;
  for (const a of list) {
    if (a.mimetype?.startsWith("image/") || IMAGE_EXTENSIONS.has(extensionOf(a))) {
      hiddenImageCount++;
    } else {
      files.push({ title: a.title, url: a.url });
    }
  }
  return { files, hiddenImageCount };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/prep`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prep
git commit -m "feat: parse Slack channel links and filter image attachments" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Fund-group builder and test fixtures

**Files:**
- Create: `lib/prep/build.ts`, `lib/clickup/test-fixtures.ts`
- Test: `lib/prep/build.test.ts`

**Interfaces:**
- Consumes: `toLocalDate` (Task 2), `parseSlackLinks`, `filterAttachments` (Task 4), types (Task 2)
- Produces:
  - `toSubTask(task: ClickUpTask, offsetMin: number): SubTask`
  - `buildFundGroup(group: TaskGroup, parent: ClickUpTask | null, offsetMin: number): FundGroup`. Sub-tasks are sorted by `dueDate` ascending (nulls last). A `null` parent gives `loadError: true`, name `Task <parentId>`, url `https://app.clickup.com/t/<parentId>`, empty slack/files.
  - Fixtures in `lib/clickup/test-fixtures.ts`: `subFormSupport`, `subChecklist`, `subUi`, `subOverdue`, `noiseTask`, `fund1`, `fund2` (used by Tasks 5, 8 and 10)

- [ ] **Step 1: Create fixtures** — `lib/clickup/test-fixtures.ts`

```ts
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
```

- [ ] **Step 2: Write failing test** — `lib/prep/build.test.ts`

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/prep/build`
Expected: FAIL. Cannot resolve `./build`.

- [ ] **Step 4: Implement** — `lib/prep/build.ts`

```ts
import type { ClickUpTask } from "@/lib/clickup/types";
import { filterAttachments } from "./attachments";
import { toLocalDate } from "./dates";
import { parseSlackLinks } from "./slack";
import type { FundGroup, SubTask, TaskGroup } from "./types";

export function toSubTask(task: ClickUpTask, offsetMin: number): SubTask {
  return {
    id: task.id,
    name: task.name,
    url: task.url,
    startDate: task.start_date ? toLocalDate(Number(task.start_date), offsetMin) : null,
    dueDate: task.due_date ? toLocalDate(Number(task.due_date), offsetMin) : null,
  };
}

function byDueDate(a: SubTask, b: SubTask): number {
  if (a.dueDate === b.dueDate) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

export function buildFundGroup(group: TaskGroup, parent: ClickUpTask | null, offsetMin: number): FundGroup {
  const subtasks = group.members.map((m) => toSubTask(m, offsetMin)).sort(byDueDate);
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
    };
  }
  const { files, hiddenImageCount } = filterAttachments(parent.attachments ?? []);
  return {
    parentId: group.parentId,
    name: parent.name,
    url: parent.url,
    subtasks,
    slack: parseSlackLinks(parent.markdown_description || parent.description || ""),
    files,
    hiddenImageCount,
    loadError: false,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/prep`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib
git commit -m "feat: build fund-task groups from parent tasks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Config, TTL cache, bounded concurrency

**Files:**
- Create: `lib/config.ts`, `lib/cache/ttl-cache.ts`, `lib/hub/map-limit.ts`
- Test: `lib/config.test.ts`, `lib/cache/ttl-cache.test.ts`, `lib/hub/map-limit.test.ts`

**Interfaces:**
- Consumes: `parseOffset` (Task 2), `parseNoisePatterns` (Task 3)
- Produces:
  - `interface HubConfig { clickupToken: string; teamId: string; spaceId: string; allowedDomain: string; tzOffsetMinutes: number; noisePatterns: string[] }`
  - `loadConfig(env?: Record<string, string | undefined>): HubConfig`. Throws `Missing environment variables: A, B` for any missing `CLICKUP_TOKEN`, `CLICKUP_TEAM_ID` or `CLICKUP_SPACE_ID`.
  - `class TtlCache<V> { constructor(ttlMs: number, now?: () => number, maxEntries?: number); get(key: string): V | undefined; peek(key: string): V | undefined; set(key: string, value: V): void }`. `peek` ignores expiry. Once `maxEntries` (default 1000) is reached, it evicts the oldest entry.
  - `mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]>` (keeps order)

- [ ] **Step 1: Write failing tests**

`lib/config.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

const base = { CLICKUP_TOKEN: "pk_x", CLICKUP_TEAM_ID: "T1", CLICKUP_SPACE_ID: "S1" };

describe("loadConfig", () => {
  it("applies defaults", () => {
    expect(loadConfig(base)).toEqual({
      clickupToken: "pk_x",
      teamId: "T1",
      spaceId: "S1",
      allowedDomain: "anduintransact.com",
      tzOffsetMinutes: 420,
      noisePatterns: ["estimation", "update request", "availability", "slotting", "team sync"],
    });
  });
  it("reads overrides", () => {
    const cfg = loadConfig({ ...base, ALLOWED_EMAIL_DOMAIN: "Example.com", TZ_OFFSET: "+00:00", NOISE_PATTERNS: "foo" });
    expect(cfg.allowedDomain).toBe("example.com");
    expect(cfg.tzOffsetMinutes).toBe(0);
    expect(cfg.noisePatterns).toEqual(["foo"]);
  });
  it("lists every missing required variable", () => {
    expect(() => loadConfig({ CLICKUP_TOKEN: "pk_x" })).toThrow(
      "Missing environment variables: CLICKUP_TEAM_ID, CLICKUP_SPACE_ID",
    );
  });
});
```

`lib/cache/ttl-cache.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { TtlCache } from "./ttl-cache";

describe("TtlCache", () => {
  it("returns fresh values and expires them", () => {
    let now = 0;
    const cache = new TtlCache<string>(1000, () => now);
    cache.set("k", "v");
    now = 999;
    expect(cache.get("k")).toBe("v");
    now = 1000;
    expect(cache.get("k")).toBeUndefined();
    expect(cache.peek("k")).toBe("v");
  });
  it("evicts the oldest entry when full", () => {
    const cache = new TtlCache<number>(1000, () => 0, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.peek("a")).toBeUndefined();
    expect(cache.peek("b")).toBe(2);
    expect(cache.peek("c")).toBe(3);
  });
});
```

`lib/hub/map-limit.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { mapLimit } from "./map-limit";

describe("mapLimit", () => {
  it("preserves order and never exceeds the limit", async () => {
    let active = 0;
    let peak = 0;
    const result = await mapLimit([5, 1, 4, 2, 3, 6, 7], 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, n));
      active--;
      return n * 10;
    });
    expect(result).toEqual([50, 10, 40, 20, 30, 60, 70]);
    expect(peak).toBeLessThanOrEqual(3);
  });
  it("handles an empty list", async () => {
    expect(await mapLimit([], 5, async (x) => x)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/config lib/cache lib/hub/map-limit`
Expected: FAIL. Modules not found.

- [ ] **Step 3: Implement**

`lib/config.ts`:
```ts
import { parseNoisePatterns } from "@/lib/prep/noise";
import { parseOffset } from "@/lib/prep/dates";

export interface HubConfig {
  clickupToken: string;
  teamId: string;
  spaceId: string;
  allowedDomain: string;
  tzOffsetMinutes: number;
  noisePatterns: string[];
}

const REQUIRED = ["CLICKUP_TOKEN", "CLICKUP_TEAM_ID", "CLICKUP_SPACE_ID"] as const;

export function loadConfig(env: Record<string, string | undefined> = process.env): HubConfig {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  return {
    clickupToken: env.CLICKUP_TOKEN!,
    teamId: env.CLICKUP_TEAM_ID!,
    spaceId: env.CLICKUP_SPACE_ID!,
    allowedDomain: (env.ALLOWED_EMAIL_DOMAIN || "anduintransact.com").toLowerCase(),
    tzOffsetMinutes: parseOffset(env.TZ_OFFSET || "+07:00"),
    noisePatterns: parseNoisePatterns(env.NOISE_PATTERNS),
  };
}
```

`lib/cache/ttl-cache.ts`:
```ts
export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();

  constructor(
    private ttlMs: number,
    private now: () => number = Date.now,
    private maxEntries = 1000,
  ) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry || entry.expires <= this.now()) return undefined;
    return entry.value;
  }

  /** Returns the value even if expired (used to serve stale data on errors). */
  peek(key: string): V | undefined {
    return this.store.get(key)?.value;
  }

  set(key: string, value: V): void {
    this.store.delete(key);
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expires: this.now() + this.ttlMs });
  }
}
```

`lib/hub/map-limit.ts`:
```ts
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add lib
git commit -m "feat: add config loader, TTL cache and bounded-concurrency map" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: ClickUp REST client

**Files:**
- Create: `lib/clickup/client.ts`
- Test: `lib/clickup/client.test.ts`

**Interfaces:**
- Consumes: `ClickUpTask`, `ClickUpMember` (Task 2)
- Produces:
  - `class ClickUpError extends Error { status: number; endpoint: string }` (`status` 0 = network error)
  - `interface ClickUpClient { listMembers(): Promise<ClickUpMember[]>; listUserTasks(userId: number): Promise<ClickUpTask[]>; getTask(id: string): Promise<ClickUpTask> }`
  - `createClickUpClient(opts: { token: string; teamId: string; spaceId: string; fetchFn?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number }): ClickUpClient`
  - `retryDelayMs(headers: Headers, nowMs: number): number`. Uses `Retry-After` (seconds), else `X-RateLimit-Reset` (unix seconds), else 1000. Clamped to the range [0, 10000].

ClickUp endpoints (base `https://api.clickup.com/api/v2`, header `Authorization: <token>`):
- `GET /team` → `{ teams: [{ id, members: [{ user: { id, username, email } }] }] }`
- `GET /team/{teamId}/task?page=N&subtasks=true&include_closed=false&assignees[]=U&space_ids[]=S` → `{ tasks: ClickUpTask[], last_page?: boolean }` (100 per page)
- `GET /task/{id}?include_markdown_description=true` → `ClickUpTask` (includes `attachments`)

- [ ] **Step 1: Write failing tests** — `lib/clickup/client.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClickUpError, createClickUpClient, retryDelayMs } from "./client";
import { fund1, subFormSupport, subUi } from "./test-fixtures";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function setup(...responses: Array<Response | Error>) {
  const fetchFn = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = vi.fn(async () => {});
  const client = createClickUpClient({
    token: "pk_test", teamId: "T1", spaceId: "S1",
    fetchFn: fetchFn as unknown as typeof fetch, sleep, now: () => 1_000_000,
  });
  return { client, fetchFn, sleep };
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("listUserTasks", () => {
  it("sends the right query and paginates", async () => {
    const { client, fetchFn } = setup(
      json({ tasks: [subFormSupport], last_page: false }),
      json({ tasks: [subUi], last_page: true }),
    );
    const tasks = await client.listUserTasks(42);
    expect(tasks.map((t) => t.id)).toEqual(["sub1", "sub3"]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("https://api.clickup.com/api/v2/team/T1/task?");
    expect(url).toContain("page=0");
    expect(url).toContain("subtasks=true");
    expect(url).toContain("include_closed=false");
    expect(url).toContain("assignees%5B%5D=42");
    expect(url).toContain("space_ids%5B%5D=S1");
    expect((init.headers as Record<string, string>).Authorization).toBe("pk_test");
    expect((fetchFn.mock.calls[1] as unknown as [string])[0]).toContain("page=1");
  });

  it("stops on a short page when last_page is absent", async () => {
    const { client, fetchFn } = setup(json({ tasks: [subFormSupport] }));
    await client.listUserTasks(42);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("getTask", () => {
  it("requests the markdown description", async () => {
    const { client, fetchFn } = setup(json(fund1));
    const task = await client.getTask("fund1");
    expect(task.name).toBe("Fortress Lending Fund V (Unlevered)");
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://api.clickup.com/api/v2/task/fund1?include_markdown_description=true",
    );
  });
});

describe("listMembers", () => {
  it("returns members of the configured team", async () => {
    const { client } = setup(
      json({
        teams: [
          { id: "T0", members: [{ user: { id: 1, username: "other", email: "o@x.com" } }] },
          { id: "T1", members: [{ user: { id: 42, username: "Toai", email: "toainguyen@anduintransact.com" } }] },
        ],
      }),
    );
    expect(await client.listMembers()).toEqual([
      { id: 42, username: "Toai", email: "toainguyen@anduintransact.com" },
    ]);
  });

  it("throws if the team is missing", async () => {
    const { client } = setup(json({ teams: [] }));
    await expect(client.listMembers()).rejects.toMatchObject({ status: 404 });
  });
});

describe("errors and retries", () => {
  it("retries once after a 429", async () => {
    const { client, sleep } = setup(json({}, 429, { "retry-after": "2" }), json(fund1));
    expect((await client.getTask("fund1")).id).toBe("fund1");
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("fails after a second 429", async () => {
    const { client } = setup(json({}, 429), json({}, 429));
    await expect(client.getTask("fund1")).rejects.toMatchObject({ status: 429 });
  });

  it("wraps HTTP errors", async () => {
    const { client } = setup(json({ err: "nope" }, 401));
    const err = await client.getTask("fund1").catch((e) => e);
    expect(err).toBeInstanceOf(ClickUpError);
    expect(err.status).toBe(401);
    expect(err.endpoint).toBe("/task/fund1?include_markdown_description=true");
  });

  it("wraps network errors as status 0", async () => {
    const { client } = setup(new Error("ECONNRESET"));
    await expect(client.getTask("fund1")).rejects.toMatchObject({ status: 0 });
  });
});

describe("retryDelayMs", () => {
  it("prefers Retry-After, then X-RateLimit-Reset, then 1s, clamped to 10s", () => {
    expect(retryDelayMs(new Headers({ "retry-after": "3" }), 0)).toBe(3000);
    expect(retryDelayMs(new Headers({ "x-ratelimit-reset": "1005" }), 1_000_000)).toBe(5000);
    expect(retryDelayMs(new Headers(), 0)).toBe(1000);
    expect(retryDelayMs(new Headers({ "retry-after": "60" }), 0)).toBe(10000);
    expect(retryDelayMs(new Headers({ "x-ratelimit-reset": "1" }), 1_000_000)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/clickup`
Expected: FAIL. Cannot resolve `./client`.

- [ ] **Step 3: Implement** — `lib/clickup/client.ts`

```ts
import type { ClickUpMember, ClickUpTask } from "./types";

const BASE_URL = "https://api.clickup.com/api/v2";
const MAX_PAGES = 20;
const PAGE_SIZE = 100;

export class ClickUpError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(message);
    this.name = "ClickUpError";
  }
}

export interface ClickUpClient {
  listMembers(): Promise<ClickUpMember[]>;
  listUserTasks(userId: number): Promise<ClickUpTask[]>;
  getTask(id: string): Promise<ClickUpTask>;
}

export interface ClickUpClientOptions {
  token: string;
  teamId: string;
  spaceId: string;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const clamp = (ms: number) => Math.min(10_000, Math.max(0, ms));

export function retryDelayMs(headers: Headers, nowMs: number): number {
  const retryAfter = Number(headers.get("retry-after"));
  if (headers.has("retry-after") && !Number.isNaN(retryAfter)) return clamp(retryAfter * 1000);
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (headers.has("x-ratelimit-reset") && !Number.isNaN(reset)) return clamp(reset * 1000 - nowMs);
  return 1000;
}

function logError(endpoint: string, status: number, ms: number): void {
  console.error(JSON.stringify({ msg: "clickup_error", endpoint, status, ms }));
}

export function createClickUpClient(opts: ClickUpClientOptions): ClickUpClient {
  const fetchFn = opts.fetchFn ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;

  async function request<T>(endpoint: string, retried = false): Promise<T> {
    const started = now();
    let res: Response;
    try {
      res = await fetchFn(BASE_URL + endpoint, {
        headers: { Authorization: opts.token },
        cache: "no-store",
      });
    } catch (err) {
      logError(endpoint, 0, now() - started);
      throw new ClickUpError(0, endpoint, `Network error: ${(err as Error).message}`);
    }
    if (res.status === 429 && !retried) {
      await sleep(retryDelayMs(res.headers, now()));
      return request<T>(endpoint, true);
    }
    if (!res.ok) {
      logError(endpoint, res.status, now() - started);
      throw new ClickUpError(res.status, endpoint, `ClickUp ${res.status} on ${endpoint}`);
    }
    return (await res.json()) as T;
  }

  return {
    async listMembers() {
      type TeamsResponse = {
        teams: { id: string; members: { user: ClickUpMember }[] }[];
      };
      const data = await request<TeamsResponse>("/team");
      const team = data.teams.find((t) => String(t.id) === opts.teamId);
      if (!team) throw new ClickUpError(404, "/team", `Team ${opts.teamId} not found for this token`);
      return team.members.map(({ user }) => ({ id: user.id, username: user.username, email: user.email }));
    },

    async listUserTasks(userId) {
      const all: ClickUpTask[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const qs = new URLSearchParams({ page: String(page), subtasks: "true", include_closed: "false" });
        qs.append("assignees[]", String(userId));
        qs.append("space_ids[]", opts.spaceId);
        const data = await request<{ tasks: ClickUpTask[]; last_page?: boolean }>(
          `/team/${opts.teamId}/task?${qs}`,
        );
        all.push(...data.tasks);
        if (data.last_page ?? data.tasks.length < PAGE_SIZE) break;
      }
      return all;
    },

    async getTask(id) {
      return request<ClickUpTask>(`/task/${encodeURIComponent(id)}?include_markdown_description=true`);
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/clickup`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/clickup
git commit -m "feat: add typed ClickUp REST client with retry and error wrapping" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Day-view service, member resolver, hub singleton

**Files:**
- Create: `lib/hub/day-view.ts`, `lib/hub/members.ts`, `lib/hub/instance.ts`
- Test: `lib/hub/day-view.test.ts`, `lib/hub/members.test.ts`

**Interfaces:**
- Consumes: `ClickUpClient`, `ClickUpError`, `createClickUpClient` (Task 7); `inWindow` (Task 2); `isNoise` (Task 3); `rollUp` (Task 3); `buildFundGroup` (Task 5); `TtlCache` (Task 6); `mapLimit` (Task 6); `HubConfig`, `loadConfig` (Task 6); fixtures (Task 5)
- Produces:
  - `interface DayViewResult { view: DayView | null; fetchedAt: number; stale: boolean; error: string | null }`
  - `describeError(err: unknown): string`. Returns `Couldn't reach ClickUp (auth error)` for 401/403, otherwise `Couldn't reach ClickUp (unavailable)`.
  - `createDayViewService(deps: { client: Pick<ClickUpClient, "listUserTasks" | "getTask">; config: Pick<HubConfig, "tzOffsetMinutes" | "noisePatterns">; dayCache: TtlCache<DayViewResult>; taskCache: TtlCache<ClickUpTask>; now?: () => number }): { getDayView(userId: number, date: string, opts: { refresh: boolean }): Promise<DayViewResult> }`
  - `type DayViewService = ReturnType<typeof createDayViewService>`
  - `createMemberResolver(client: Pick<ClickUpClient, "listMembers">, cache: TtlCache<ClickUpMember[]>): (email: string) => Promise<ClickUpMember | null>`
  - `getHub(): { config: HubConfig; dayViews: DayViewService; resolveMember: (email: string) => Promise<ClickUpMember | null> }`

- [ ] **Step 1: Write failing tests**

`lib/hub/members.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "@/lib/cache/ttl-cache";
import { createMemberResolver } from "./members";

const members = [{ id: 42, username: "Toai", email: "ToaiNguyen@anduintransact.com" }];

describe("createMemberResolver", () => {
  it("matches emails case-insensitively and caches the list", async () => {
    const listMembers = vi.fn(async () => members);
    const resolve = createMemberResolver({ listMembers }, new TtlCache(60_000));
    expect(await resolve("toainguyen@anduintransact.com")).toEqual(members[0]);
    expect(await resolve("TOAINGUYEN@anduintransact.com")).toEqual(members[0]);
    expect(listMembers).toHaveBeenCalledTimes(1);
  });
  it("returns null for an unknown email", async () => {
    const resolve = createMemberResolver({ listMembers: async () => members }, new TtlCache(60_000));
    expect(await resolve("someone@anduintransact.com")).toBeNull();
  });
});
```

`lib/hub/day-view.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/hub`
Expected: FAIL. Cannot resolve `./day-view` / `./members`.

- [ ] **Step 3: Implement**

`lib/hub/members.ts`:
```ts
import type { TtlCache } from "@/lib/cache/ttl-cache";
import type { ClickUpClient } from "@/lib/clickup/client";
import type { ClickUpMember } from "@/lib/clickup/types";

const KEY = "members";

export function createMemberResolver(
  client: Pick<ClickUpClient, "listMembers">,
  cache: TtlCache<ClickUpMember[]>,
): (email: string) => Promise<ClickUpMember | null> {
  return async (email) => {
    let members = cache.get(KEY);
    if (!members) {
      members = await client.listMembers();
      cache.set(KEY, members);
    }
    const target = email.toLowerCase();
    return members.find((m) => m.email?.toLowerCase() === target) ?? null;
  };
}
```

`lib/hub/day-view.ts`:
```ts
import type { TtlCache } from "@/lib/cache/ttl-cache";
import { ClickUpError, type ClickUpClient } from "@/lib/clickup/client";
import type { ClickUpTask } from "@/lib/clickup/types";
import type { HubConfig } from "@/lib/config";
import { buildFundGroup } from "@/lib/prep/build";
import { isNoise } from "@/lib/prep/noise";
import { rollUp } from "@/lib/prep/rollup";
import type { DayView } from "@/lib/prep/types";
import { inWindow } from "@/lib/prep/window";
import { mapLimit } from "./map-limit";

const PARENT_CONCURRENCY = 5;

export interface DayViewResult {
  view: DayView | null;
  fetchedAt: number;
  stale: boolean;
  error: string | null;
}

export function describeError(err: unknown): string {
  if (err instanceof ClickUpError && (err.status === 401 || err.status === 403)) {
    return "Couldn't reach ClickUp (auth error)";
  }
  return "Couldn't reach ClickUp (unavailable)";
}

export interface DayViewDeps {
  client: Pick<ClickUpClient, "listUserTasks" | "getTask">;
  config: Pick<HubConfig, "tzOffsetMinutes" | "noisePatterns">;
  dayCache: TtlCache<DayViewResult>;
  taskCache: TtlCache<ClickUpTask>;
  now?: () => number;
}

export function createDayViewService(deps: DayViewDeps) {
  const { client, config, dayCache, taskCache } = deps;
  const now = deps.now ?? Date.now;

  async function getParent(id: string, refresh: boolean): Promise<ClickUpTask | null> {
    const cached = refresh ? undefined : taskCache.get(id);
    if (cached) return cached;
    try {
      const task = await client.getTask(id);
      taskCache.set(id, task);
      return task;
    } catch {
      return null; // client already logged the failure
    }
  }

  async function getDayView(userId: number, date: string, opts: { refresh: boolean }): Promise<DayViewResult> {
    const key = `${userId}:${date}`;
    if (!opts.refresh) {
      const hit = dayCache.get(key);
      if (hit) return hit;
    }
    try {
      const tasks = await client.listUserTasks(userId);
      const matching = tasks.filter(
        (t) => inWindow(t, date, config.tzOffsetMinutes) && !isNoise(t.name, config.noisePatterns),
      );
      const groups = await mapLimit(rollUp(matching), PARENT_CONCURRENCY, async (group) =>
        buildFundGroup(group, await getParent(group.parentId, opts.refresh), config.tzOffsetMinutes),
      );
      const result: DayViewResult = {
        view: { date, subtaskCount: matching.length, groups },
        fetchedAt: now(),
        stale: false,
        error: null,
      };
      dayCache.set(key, result);
      return result;
    } catch (err) {
      const error = describeError(err);
      const previous = dayCache.peek(key);
      if (previous?.view) return { ...previous, stale: true, error };
      return { view: null, fetchedAt: now(), stale: false, error };
    }
  }

  return { getDayView };
}

export type DayViewService = ReturnType<typeof createDayViewService>;
```

`lib/hub/instance.ts`:
```ts
import { TtlCache } from "@/lib/cache/ttl-cache";
import { createClickUpClient } from "@/lib/clickup/client";
import type { ClickUpMember, ClickUpTask } from "@/lib/clickup/types";
import { loadConfig, type HubConfig } from "@/lib/config";
import { createDayViewService, type DayViewResult, type DayViewService } from "./day-view";
import { createMemberResolver } from "./members";

const FIVE_MINUTES = 5 * 60_000;
const ONE_HOUR = 60 * 60_000;

export interface Hub {
  config: HubConfig;
  dayViews: DayViewService;
  resolveMember: (email: string) => Promise<ClickUpMember | null>;
}

// Stored on globalThis so dev-mode hot reloads don't drop the caches.
const holder = globalThis as unknown as { __teamHub?: Hub };

export function getHub(): Hub {
  if (!holder.__teamHub) {
    const config = loadConfig();
    const client = createClickUpClient({
      token: config.clickupToken,
      teamId: config.teamId,
      spaceId: config.spaceId,
    });
    holder.__teamHub = {
      config,
      dayViews: createDayViewService({
        client,
        config,
        dayCache: new TtlCache<DayViewResult>(FIVE_MINUTES),
        taskCache: new TtlCache<ClickUpTask>(FIVE_MINUTES),
      }),
      resolveMember: createMemberResolver(client, new TtlCache<ClickUpMember[]>(ONE_HOUR)),
    };
  }
  return holder.__teamHub;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add lib/hub
git commit -m "feat: add day-view service with caching, member resolver and hub singleton" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Google SSO with Auth.js

**Files:**
- Create: `lib/auth/domain.ts`, `auth.ts`, `app/api/auth/[...nextauth]/route.ts`
- Test: `lib/auth/domain.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:
  - `isAllowedEmail(email: string | null | undefined, domain: string): boolean`
  - `auth.ts` exports `{ handlers, auth, signIn, signOut }` (Auth.js v5). `auth()` returns a session with `user.email` / `user.name` or `null`.

- [ ] **Step 1: Install Auth.js v5**

Run:
```bash
npm install next-auth@beta
npm ls next-auth
```
Expected: a `5.x` version. If `npm ls` shows `6.x` or later, run `npm install next-auth@5` instead and re-check. This plan uses the v5 API (`NextAuth()` returning `handlers`/`auth`).

- [ ] **Step 2: Write failing test** — `lib/auth/domain.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { isAllowedEmail } from "./domain";

describe("isAllowedEmail", () => {
  it("accepts the company domain, case-insensitively", () => {
    expect(isAllowedEmail("toainguyen@anduintransact.com", "anduintransact.com")).toBe(true);
    expect(isAllowedEmail("ToaiNguyen@AnduinTransact.com", "anduintransact.com")).toBe(true);
  });
  it("rejects other domains and look-alikes", () => {
    expect(isAllowedEmail("x@gmail.com", "anduintransact.com")).toBe(false);
    expect(isAllowedEmail("x@evil-anduintransact.com", "anduintransact.com")).toBe(false);
    expect(isAllowedEmail("x@anduintransact.com.evil.io", "anduintransact.com")).toBe(false);
  });
  it("rejects missing emails", () => {
    expect(isAllowedEmail(undefined, "anduintransact.com")).toBe(false);
    expect(isAllowedEmail(null, "anduintransact.com")).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/auth`
Expected: FAIL. Cannot resolve `./domain`.

- [ ] **Step 4: Implement**

`lib/auth/domain.ts`:
```ts
export function isAllowedEmail(email: string | null | undefined, domain: string): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}
```

`auth.ts`:
```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "@/lib/auth/domain";

const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN || "anduintransact.com").toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // runs behind Dokploy's reverse proxy
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { hd: allowedDomain, prompt: "select_account" } },
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      return profile?.email_verified === true && isAllowedEmail(profile.email, allowedDomain);
    },
  },
});
```

`app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 5: Run tests and build**

Run: `npm test && npm run build`
Expected: all tests PASS. The build completes and lists `/api/auth/[...nextauth]`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Google SSO restricted to the company domain" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The "today" page

**Files:**
- Create: `app/today/today-screen.tsx`, `app/today/page.tsx`
- Test: `app/today/today-screen.test.tsx`

**Interfaces:**
- Consumes: `DayViewResult`, `describeError` (Task 8); `getHub` (Task 8); `auth`, `signOut` (Task 9); `FundGroup`, `SlackLink`, `DayView` (Task 2); `addDays`, `formatLongDate`, `formatShortDate`, `isValidDate`, `todayLocal` (Task 2); CSS classes from `app/globals.css` (Task 1)
- Produces:
  - `TodayScreen(props: { date: string; today: string; notice: string | null; result: DayViewResult | null; unmappedEmail: string | null; nowMs: number }): JSX.Element`. It is pure and has no hooks, so it renders with `renderToStaticMarkup`.
  - Route `/today?date=YYYY-MM-DD[&refresh=1]`

- [ ] **Step 1: Write failing tests** — `app/today/today-screen.test.tsx`

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DayViewResult } from "@/lib/hub/day-view";
import type { FundGroup } from "@/lib/prep/types";
import { TodayScreen } from "./today-screen";

const render = (el: React.ReactElement) =>
  renderToStaticMarkup(el).replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");

const NOW = Date.parse("2026-06-11T03:00:00Z");

const fortress: FundGroup = {
  parentId: "fund1",
  name: "Fortress Lending Fund V (Unlevered)",
  url: "https://app.clickup.com/t/fund1",
  subtasks: [
    { id: "sub2", name: "Checklist Fix", url: "https://app.clickup.com/t/sub2", startDate: "2026-06-08", dueDate: "2026-06-11" },
    { id: "sub1", name: "Form Support", url: "https://app.clickup.com/t/sub1", startDate: "2026-06-11", dueDate: "2026-06-11" },
  ],
  slack: {
    cs: { url: "https://anduin.slack.com/archives/C111/p1717000000000100?thread_ts=1", isThread: true },
    testing: null,
  },
  files: [{ title: "SubDoc_v3.pdf", url: "https://files/SubDoc_v3.pdf" }],
  hiddenImageCount: 2,
  loadError: false,
};

const result = (groups: FundGroup[], extra: Partial<DayViewResult> = {}): DayViewResult => ({
  view: { date: "2026-06-11", subtaskCount: groups.reduce((n, g) => n + g.subtasks.length, 0), groups },
  fetchedAt: NOW - 2 * 60_000,
  stale: false,
  error: null,
  ...extra,
});

const base = { date: "2026-06-11", today: "2026-06-11", notice: null, unmappedEmail: null, nowMs: NOW };

describe("TodayScreen", () => {
  it("renders the date navigation", () => {
    const html = render(<TodayScreen {...base} result={result([])} />);
    expect(html).toContain("Thu, Jun 11, 2026");
    expect(html).toContain('href="/today?date=2026-06-10"');
    expect(html).toContain('href="/today?date=2026-06-12"');
    expect(html).toContain('href="/today?date=2026-06-11&refresh=1"');
    expect(html).toContain('value="2026-06-11"');
  });

  it("renders fund cards with sub-tasks, links and files", () => {
    const html = render(<TodayScreen {...base} result={result([fortress])} />);
    expect(html).toContain("2 sub-tasks · 1 fund task");
    expect(html).toContain("updated 2 min ago");
    expect(html).toContain("Fortress Lending Fund V (Unlevered)");
    expect(html).toContain("Checklist Fix");
    expect(html).toContain("Jun 8 → Jun 11");
    expect(html).toContain("due Jun 11");
    expect(html).toContain("CS channel (thread)");
    expect(html).toContain("Testing channel: not found");
    expect(html).toContain("SubDoc_v3.pdf");
    expect(html).toContain("(2 images hidden)");
  });

  it("shows 'No attachments' only when there are no files or images", () => {
    const html = render(<TodayScreen {...base} result={result([{ ...fortress, files: [], hiddenImageCount: 0 }])} />);
    expect(html).toContain("No attachments");
  });

  it("renders the empty state", () => {
    const html = render(<TodayScreen {...base} result={result([])} />);
    expect(html).toContain("Nothing in flight for this date. Only open tasks are shown.");
  });

  it("renders a partial failure card", () => {
    const broken: FundGroup = {
      ...fortress, name: "Task fund2", url: "https://app.clickup.com/t/fund2",
      slack: { cs: null, testing: null }, files: [], hiddenImageCount: 0, loadError: true,
    };
    const html = render(<TodayScreen {...base} result={result([fortress, broken])} />);
    expect(html).toContain("Couldn't load details");
    expect(html).toContain("https://app.clickup.com/t/fund2");
  });

  it("renders a stale view with its error banner", () => {
    const html = render(
      <TodayScreen {...base} result={result([fortress], { stale: true, error: "Couldn't reach ClickUp (unavailable)" })} />,
    );
    expect(html).toContain("Couldn't reach ClickUp (unavailable)");
    expect(html).toContain("stale");
    expect(html).toContain("Fortress Lending Fund V (Unlevered)");
  });

  it("renders the unmapped-account message", () => {
    const html = render(<TodayScreen {...base} result={null} unmappedEmail="new@anduintransact.com" />);
    expect(html).toContain("Your Google account (new@anduintransact.com) isn't linked to a ClickUp member.");
  });

  it("renders a notice for an invalid date", () => {
    const html = render(<TodayScreen {...base} notice={`"2026-13-01" isn't a valid date, showing today instead.`} result={result([])} />);
    expect(html).toContain("isn't a valid date");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/today`
Expected: FAIL. Cannot resolve `./today-screen`.

- [ ] **Step 3: Implement** — `app/today/today-screen.tsx`

```tsx
import type { DayViewResult } from "@/lib/hub/day-view";
import { addDays, formatLongDate, formatShortDate } from "@/lib/prep/dates";
import type { DayView, FundGroup, SlackLink } from "@/lib/prep/types";

export interface TodayScreenProps {
  date: string;
  today: string;
  notice: string | null;
  result: DayViewResult | null;
  unmappedEmail: string | null;
  nowMs: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function updatedLabel(fetchedAt: number, nowMs: number): string {
  const minutes = Math.floor((nowMs - fetchedAt) / 60_000);
  return minutes < 1 ? "updated just now" : `updated ${minutes} min ago`;
}

function dateRange(start: string | null, due: string | null): string {
  if (!due) return "";
  if (!start || start === due) return `due ${formatShortDate(due)}`;
  return `${formatShortDate(start)} → ${formatShortDate(due)}`;
}

function DateNav({ date, today }: { date: string; today: string }) {
  return (
    <nav className="date-nav">
      <a href={`/today?date=${addDays(date, -1)}`} aria-label="Previous day">◀</a>
      <strong>{formatLongDate(date)}</strong>
      {date === today && <span className="today-tag">today</span>}
      <a href={`/today?date=${addDays(date, 1)}`} aria-label="Next day">▶</a>
      <form method="get" action="/today" className="date-form">
        <input type="date" name="date" defaultValue={date} aria-label="Pick a date" />
        <button type="submit">Go</button>
      </form>
      <a href={`/today?date=${date}&refresh=1`} className="refresh">⟳ Refresh</a>
    </nav>
  );
}

function SlackItem({ icon, label, link }: { icon: string; label: string; link: SlackLink | null }) {
  if (!link) return <span className="missing">{icon} {label}: not found</span>;
  return (
    <a href={link.url} target="_blank" rel="noreferrer">
      {icon} {label}{link.isThread ? " (thread)" : ""} ↗
    </a>
  );
}

function Files({ group }: { group: FundGroup }) {
  const hidden = group.hiddenImageCount;
  const hiddenLabel = hidden > 0 ? `(${plural(hidden, "image")} hidden)` : "";
  if (group.files.length === 0 && hidden === 0) return <p className="files">📎 No attachments</p>;
  return (
    <p className="files">
      📎{" "}
      {group.files.map((f, i) => (
        <span key={f.url}>
          {i > 0 && " · "}
          <a href={f.url} target="_blank" rel="noreferrer">{f.title}</a>
        </span>
      ))}
      {hiddenLabel && ` ${hiddenLabel}`}
    </p>
  );
}

function FundCard({ group }: { group: FundGroup }) {
  return (
    <section className="card">
      <h2>
        <a href={group.url} target="_blank" rel="noreferrer">{group.name} ↗</a>
      </h2>
      {group.loadError && <p className="card-error">Couldn&apos;t load details</p>}
      <ul className="subtasks">
        {group.subtasks.map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>{" "}
            <span className="dates">{dateRange(s.startDate, s.dueDate)}</span>
          </li>
        ))}
      </ul>
      {!group.loadError && (
        <>
          <p className="slack">
            <SlackItem icon="💬" label="CS channel" link={group.slack.cs} />
            <SlackItem icon="🧪" label="Testing channel" link={group.slack.testing} />
          </p>
          <Files group={group} />
        </>
      )}
    </section>
  );
}

function DayBody({ view }: { view: DayView }) {
  if (view.groups.length === 0) {
    return <p className="empty">Nothing in flight for this date. Only open tasks are shown.</p>;
  }
  return (
    <>
      <p className="summary">
        {plural(view.subtaskCount, "sub-task")} · {plural(view.groups.length, "fund task")}
      </p>
      {view.groups.map((g) => (
        <FundCard key={g.parentId} group={g} />
      ))}
    </>
  );
}

export function TodayScreen({ date, today, notice, result, unmappedEmail, nowMs }: TodayScreenProps) {
  return (
    <>
      <DateNav date={date} today={today} />
      {result?.view && (
        <p className="updated">
          {updatedLabel(result.fetchedAt, nowMs)}
          {result.stale ? " · stale" : ""}
        </p>
      )}
      {notice && <p className="banner notice">{notice}</p>}
      {unmappedEmail && (
        <p className="banner error">
          Your Google account ({unmappedEmail}) isn&apos;t linked to a ClickUp member.
        </p>
      )}
      {result?.error && <p className="banner error">{result.error}</p>}
      {result?.view && <DayBody view={result.view} />}
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/today`
Expected: PASS.

- [ ] **Step 5: Implement the server page** — `app/today/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { describeError, type DayViewResult } from "@/lib/hub/day-view";
import { getHub } from "@/lib/hub/instance";
import { isValidDate, todayLocal } from "@/lib/prep/dates";
import { TodayScreen } from "./today-screen";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ date?: string; refresh?: string }>;

export default async function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/api/auth/signin?callbackUrl=%2Ftoday");

  const params = await searchParams;
  const hub = getHub();
  const today = todayLocal(hub.config.tzOffsetMinutes);
  const requested = params.date;
  const date = isValidDate(requested) ? requested : today;
  const notice =
    requested !== undefined && !isValidDate(requested)
      ? `"${requested}" isn't a valid date, showing today instead.`
      : null;

  let result: DayViewResult | null = null;
  let unmappedEmail: string | null = null;
  try {
    const member = await hub.resolveMember(email);
    if (!member) unmappedEmail = email;
    else result = await hub.dayViews.getDayView(member.id, date, { refresh: params.refresh === "1" });
  } catch (err) {
    result = { view: null, fetchedAt: Date.now(), stale: false, error: describeError(err) };
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <main className="page">
      <header className="topbar">
        <span className="brand">Hub</span>
        <span className="user">{session?.user?.name ?? email}</span>
        <form action={signOutAction}>
          <button type="submit" className="link-button">Sign out</button>
        </form>
      </header>
      <TodayScreen
        date={date}
        today={today}
        notice={notice}
        result={result}
        unmappedEmail={unmappedEmail}
        nowMs={Date.now()}
      />
    </main>
  );
}
```

- [ ] **Step 6: Run full tests and build**

Run: `npm test && npm run build`
Expected: all tests PASS. The build lists `/today` as dynamic (ƒ).

- [ ] **Step 7: Commit**

```bash
git add app
git commit -m "feat: add the today page with date navigation and fund cards" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Docker image, env template, README, live verification

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `.env.example`, `README.md`

**Interfaces:**
- Consumes: the whole app
- Produces: a container that listens on port 3000 and serves `/api/health` and `/today`

- [ ] **Step 1: Create `.env.example`**

```bash
# ClickUp (token of a dedicated "bot" member with access to the Digitization Squad space)
CLICKUP_TOKEN=pk_xxx
CLICKUP_TEAM_ID=
CLICKUP_SPACE_ID=

# Google OAuth (Google Cloud Console → Credentials → OAuth client ID, type "Web application")
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Auth.js — generate AUTH_SECRET with: openssl rand -base64 32
AUTH_SECRET=
AUTH_URL=http://localhost:3000

# Optional
ALLOWED_EMAIL_DOMAIN=anduintransact.com
TZ_OFFSET=+07:00
NOISE_PATTERNS=estimation,update request,availability,slotting,team sync
```

- [ ] **Step 2: Create `.dockerignore`**

```
node_modules
.next
.git
.env*
!.env.example
docs
*.md
```

- [ ] **Step 3: Create `Dockerfile`**

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 4: Verify the image builds and the health check responds**

Run:
```bash
docker build -t team-hub .
docker run --rm -d -p 3000:3000 --name team-hub-smoke -e AUTH_SECRET=smoke team-hub
curl -s localhost:3000/api/health
docker stop team-hub-smoke
```
Expected: `{"ok":true}`

- [ ] **Step 5: Create `README.md`**

````markdown
# Team Hub

Shows each Digitization Squad member their ClickUp sub-tasks in flight on a chosen date, grouped by
fund task, with the CS/testing Slack links and attachments for each fund task.

## Local development

1. `cp .env.example .env.local` and fill in the values.
2. To find team and space IDs, run `curl -H "Authorization: $CLICKUP_TOKEN" https://api.clickup.com/api/v2/team`
   (team ID), then `.../team/<team_id>/space` (space ID).
3. In Google Cloud Console, add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
4. `npm install && npm run dev`, then open http://localhost:3000.

## Tests

`npm test`

## Deploy (Dokploy)

1. Create an Application from this git repo with build type **Dockerfile**.
2. Set environment variables from `.env.example`. Set `AUTH_URL` to the public URL (e.g. `https://hub.example.com`).
3. In Google Cloud Console, add `<AUTH_URL>/api/auth/callback/google` as a redirect URI.
4. Container port: `3000`. Health check path: `/api/health`.
5. Deploy. Caches are in memory, so restarts only cost one slower first load.
````

- [ ] **Step 6: Live end-to-end check (needs real credentials in `.env.local`)**

Run: `npm run dev`, then sign in at http://localhost:3000 with a company Google account.
Check all of the following:
- `/today` shows your fund tasks for today. Open each ClickUp link and confirm the sub-tasks' start/due dates contain today.
- Pick 2–3 other dates with ◀ ▶ and the date picker. For each, the fund tasks and Slack links match what you find by checking ClickUp directly.
- `/today?date=2026-13-01` shows the invalid-date notice and today's view.
- Signing in with a non-company Google account is rejected.
- Refresh updates "updated … ago" to "just now".

Record any mismatch as a bug before shipping.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile .dockerignore .env.example README.md
git commit -m "chore: add Dockerfile, env template and deployment README" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
