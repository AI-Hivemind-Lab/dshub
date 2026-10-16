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
