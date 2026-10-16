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
