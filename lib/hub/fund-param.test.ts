import { describe, expect, it } from "vitest";
import { makeFund } from "@/lib/prep/test-funds";
import type { UrgencyGroup } from "@/lib/prep/types";
import { pickSelectedFund, selectionHref, withFundParam } from "./fund-param";

describe("withFundParam", () => {
  it("adds, replaces and removes the fund parameter", () => {
    expect(withFundParam("/today?date=2026-06-10", "f1")).toBe("/today?date=2026-06-10&fund=f1");
    expect(withFundParam("/today?date=2026-06-10&fund=old", "f1")).toBe("/today?date=2026-06-10&fund=f1");
    expect(withFundParam("/today?date=2026-06-10&fund=f1", null)).toBe("/today?date=2026-06-10");
  });
  it("keeps other parameters and accepts absolute URLs", () => {
    expect(withFundParam("/today?date=2026-06-10&refresh=1", "f1")).toBe("/today?date=2026-06-10&refresh=1&fund=f1");
    expect(withFundParam("http://localhost:3000/today?date=2026-06-10", "f1")).toBe("/today?date=2026-06-10&fund=f1");
  });
});

describe("selectionHref", () => {
  it("keeps the path and params, drops a sticky refresh and sets the fund", () => {
    expect(selectionHref("http://localhost:3000/today?date=2026-06-10&refresh=1&fund=old", "f2")).toBe("/today?date=2026-06-10&fund=f2");
  });
  it("adds the fund when there is no query string", () => {
    expect(selectionHref("http://localhost:3000/today", "f1")).toBe("/today?fund=f1");
  });
});

describe("pickSelectedFund", () => {
  const groups: UrgencyGroup[] = [
    { key: "today", label: "Due today", funds: [makeFund({ parentId: "f1" })] },
    { key: "later", label: "Later", funds: [makeFund({ parentId: "f2" })] },
  ];
  it("returns the requested fund when it is listed", () => {
    expect(pickSelectedFund(groups, "f2")).toBe("f2");
  });
  it("falls back to the first fund in list order", () => {
    expect(pickSelectedFund(groups, "gone")).toBe("f1");
    expect(pickSelectedFund(groups, null)).toBe("f1");
    expect(pickSelectedFund(groups, undefined)).toBe("f1");
  });
  it("returns null when there are no funds", () => {
    expect(pickSelectedFund([], "f1")).toBeNull();
  });
});
