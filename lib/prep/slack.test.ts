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

  it("does not treat 'Latest' as a testing label", () => {
    const result = parseSlackLinks(`Latest CS update: ${C111}`);
    expect(result.cs?.url).toBe(C111);
    expect(result.testing).toBeNull();
  });

  it("does not treat 'attestation' as a testing label", () => {
    const result = parseSlackLinks(`LP attestation thread: ${C222}`);
    expect(result.cs?.url).toBe(C222);
    expect(result.testing).toBeNull();
  });
});
