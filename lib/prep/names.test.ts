import { describe, expect, it } from "vitest";
import { shortSubtaskName } from "./names";

const PARENT = "Update - Bain Capital Global Special Situations III - Subscription Booklet - Items 1-4, 6-7";

describe("shortSubtaskName", () => {
  it("strips the parent name and the separator", () => {
    expect(shortSubtaskName(`${PARENT} - Checklist & UI Fix`, PARENT)).toBe("Checklist & UI Fix");
  });
  it("handles en dash, em dash and colon separators", () => {
    expect(shortSubtaskName("Fund A – UI Change", "Fund A")).toBe("UI Change");
    expect(shortSubtaskName("Fund A — UI Change", "Fund A")).toBe("UI Change");
    expect(shortSubtaskName("Fund A: UI Change", "Fund A")).toBe("UI Change");
  });
  it("keeps the full name when there is no matching prefix", () => {
    expect(shortSubtaskName("PDF annotation", "Fund A")).toBe("PDF annotation");
  });
  it("only strips at a separator boundary", () => {
    expect(shortSubtaskName("Fund VI - Form Support", "Fund V")).toBe("Fund VI - Form Support");
  });
  it("keeps the full name when nothing would remain", () => {
    expect(shortSubtaskName("Fund A", "Fund A")).toBe("Fund A");
    expect(shortSubtaskName("Fund A - ", "Fund A")).toBe("Fund A - ");
  });
  it("keeps the full name without a parent", () => {
    expect(shortSubtaskName("Fortress Lending Fund V (Unlevered) - Form Support", null)).toBe("Fortress Lending Fund V (Unlevered) - Form Support");
  });
});
