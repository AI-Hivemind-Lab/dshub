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
