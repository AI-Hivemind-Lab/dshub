# Team Hub — "Today" View (v1) Design

**Date:** 2026-10-06
**Status:** Approved in brainstorming, pending spec review
**Owner:** Toai Nguyen

## 1. Purpose

A web hub for the Anduin Digitization Squad that answers, for any member and any date:
*"What am I working on, where is it discussed, and where are the files?"*

The hub is the first of several planned sub-projects
(later: catch-up digests, cross-source search, team view); only the "today" view is in scope here.

## 2. Scope

### In scope (v1)
1. **Task list:** the user's ClickUp sub-tasks whose start→due window contains the selected date,
   rolled up under their parent (fund) task, with ClickUp links.
2. **Slack links:** the CS and testing channel/thread links parsed from each parent task's description.
3. **Attachments:** non-image attachments of each parent task, listed as links.
4. **Date picker:** any date via `?date=YYYY-MM-DD`, prev/next-day arrows and a calendar; default is today (UTC+7).

### Out of scope (v1)
Reading Slack messages, AI summaries, internal websites, team/lead view, database, notifications,
attachment proxying/downloading, per-user OAuth to Slack or ClickUp.

## 3. Users and access

- Audience: Digitization Squad members (a handful of people).
- Sign-in: Google SSO via Auth.js, restricted to `@anduintransact.com` (`ALLOWED_EMAIL_DOMAIN`).
- Identity mapping: the signed-in email is matched case-insensitively to a ClickUp workspace
  member's email. No match → explicit "not linked" message showing the email that was tried.
- Data access: a single ClickUp API token (env var) for all users. The hub can only see what that
  token's ClickUp user can see. A dedicated "bot" ClickUp member with access to the Digitization
  Squad space is recommended; a personal token is acceptable to start.

## 4. Architecture

One Next.js (App Router, TypeScript) application, one Docker container on the company Dokploy.
No database. No Supabase.

```
Browser ──Google SSO──▶ Next.js app (Dokploy)
                          ├─ auth/          Auth.js + Google provider, domain check, email→ClickUp mapping
                          ├─ app/today      server-rendered "today" page
                          ├─ app/api/health health check
                          ├─ lib/clickup/   typed ClickUp REST v2 client
                          ├─ lib/prep/      pure business rules
                          └─ lib/cache/     in-memory TTL cache
                                │
                                ▼
                          ClickUp REST API v2
```

### Components

| Unit | Responsibility | Depends on |
|---|---|---|
| `auth` | Google sign-in, domain restriction, resolve ClickUp user ID from email | `lib/clickup` (members), `lib/cache` |
| `lib/clickup` | Typed calls for: workspace members, filtered team tasks (with sub-tasks), get task (incl. `attachments`). Handles auth header, 429 retry. No business rules. | `fetch`, env |
| `lib/prep` | Pure functions, no I/O: `inWindow`, `isNoise`, `rollUp`, `parseSlackLinks`, `filterAttachments`, `buildDayView` | nothing |
| `lib/cache` | In-memory TTL map with `get`/`set`/`bypass` | nothing |
| `app/today` | Read session + `date`, orchestrate fetch → prep → render | all of the above |

The data-fetching path sits behind one function (`getDayView(userId, date)`), so a future
database-backed sync (approach "B") can replace it without UI changes.

## 5. Business rules (`lib/prep`)

All dates are evaluated in **UTC+7** (`TZ_OFFSET`). ClickUp timestamps are Unix milliseconds in UTC;
convert with `ms → +7h → calendar date`.

- **`inWindow(task, date)`**: true when `startDate ≤ date ≤ dueDate`, which covers tasks that start on,
  are due on, or span the date. If `start_date` is missing, treat start as the due date. If `due_date` is
  missing, the task is excluded.
- **Overdue excluded:** `dueDate < date` is never shown (implied by `inWindow`).
- **`isNoise(task)`**: true when the task name matches any `NOISE_PATTERNS` entry (case-insensitive
  substring). Defaults: `estimation`, `update request`, `availability`, `slotting`, `team sync`.
- **Open tasks only:** closed tasks are not fetched.
- **No status shown:** task status and "needs attention" flags are not displayed.
- **`rollUp(subtasks)`**: group matching tasks by `parent` ID, de-duplicated. A matching task with no
  parent becomes its own group.
- **`parseSlackLinks(description)`**: extract Slack URLs from the parent description, classify
  them as **CS** or **Testing** by the label text preceding the link (e.g. "CS channel", "Testing
  channel"), and keep a `thread_ts` deep link if present. A missing link yields `null` (rendered as "not found").
- **`filterAttachments(list)`**: drop attachments whose MIME type is `image/*` or whose extension is an
  image type, and return `{ files, hiddenImageCount }`.

## 6. Request flow (`/today?date=YYYY-MM-DD`)

1. Resolve the session email to a ClickUp user ID (members list cached 1h).
2. Resolve `date` (default: today in UTC+7; invalid value → today plus a notice).
3. Check the day-view cache (`userId:date`, TTL 5 min) unless refresh was requested.
4. Fetch the user's open tasks in `CLICKUP_SPACE_ID`, including sub-tasks (paginated). Date filtering
   is done locally.
5. Apply `inWindow` and `isNoise`, then `rollUp`.
6. Fetch unique parent tasks in parallel (concurrency 5; shared cache keyed by task ID, TTL 5 min).
7. Run `parseSlackLinks` and `filterAttachments` per parent, then `buildDayView`, then render on the server.

The Refresh button reloads with `?refresh=1`, which bypasses both caches for this request.

## 7. UI

- Header: user name/menu (sign out), date with ◀ ▶ arrows and a calendar, a refresh button, "updated N min ago".
- Summary line: "N sub-tasks · M fund tasks".
- One card per parent (fund) task:
  - fund task name with a ClickUp link
  - sub-tasks, each with its own start → due dates
  - 💬 CS channel link (marked "thread" when deep-linked) and 🧪 Testing channel link, or "not found"
  - 📎 attachment links (opening the ClickUp attachment URL), "(N images hidden)", or "No attachments"
- Empty state: "Nothing in flight for this date. Only open tasks are shown."

## 8. Error handling

| Failure | Behaviour |
|---|---|
| ClickUp 401/5xx/network | Banner "Couldn't reach ClickUp (auth error / unavailable)". Serve the cached view, marked stale, if one exists. |
| ClickUp 429 | One retry after `Retry-After`; then as above. |
| Single parent fetch fails | That card shows "Couldn't load details" plus a ClickUp link built from its ID. The rest of the page still renders. |
| Email not mapped | "Your Google account (x@…) isn't linked to a ClickUp member." |
| Non-company Google account | Sign-in rejected by Auth.js. |

Server logs record the endpoint, status and duration for every ClickUp error.

## 9. Configuration (Dokploy env)

`CLICKUP_TOKEN`, `CLICKUP_TEAM_ID`, `CLICKUP_SPACE_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`AUTH_SECRET`, `AUTH_URL`, `ALLOWED_EMAIL_DOMAIN` (default `anduintransact.com`),
`TZ_OFFSET` (default `+07:00`), `NOISE_PATTERNS` (comma-separated; defaults in §5).

## 10. Deployment

- Next.js `output: "standalone"`; multi-stage Dockerfile (deps → build → slim runtime).
- Dokploy builds from the git repo; health check on `GET /api/health` (returns 200, no ClickUp call).
- Google OAuth redirect URI: `${AUTH_URL}/api/auth/callback/google`.

## 11. Testing

- **Unit (Vitest), `lib/prep`:** timezone boundaries (09:00 UTC+7 start = 02:00 UTC; due near midnight);
  the window cases (starts on, due on, spans, overdue excluded, missing start, missing due); noise
  patterns; roll-up dedupe and orphan tasks; Slack parsing (channel link, `thread_ts` link, missing,
  unlabeled); image filtering.
- **`lib/clickup`:** recorded JSON fixtures, with no live calls in CI; covers pagination and 429 retry.
- **Page render:** mocked client; empty, normal and partial-failure states.
- **Acceptance (manual):** for a few sample dates, the hub's fund tasks and Slack links match what a
  person finds by checking ClickUp directly.

## 12. Future (not v1)

Slack recent-message previews and AI summaries (Claude), internal-website panels, team/lead view
(likely with DB sync), Slack DM digest linking to the hub.
