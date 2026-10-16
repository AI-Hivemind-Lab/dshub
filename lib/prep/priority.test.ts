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
