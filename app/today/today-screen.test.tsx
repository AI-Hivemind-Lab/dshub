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
    // React's server renderer emits `readOnly` before `name` and `value` last, so match attribute order loosely.
    expect(html).toMatch(/<input type="hidden"[^>]*name="fund"[^>]*value="f2"/);
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
