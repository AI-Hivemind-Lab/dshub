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
