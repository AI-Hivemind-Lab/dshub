import { describe, expect, it } from "vitest";
import { inWindow } from "./window";

const ms = (iso: string) => String(Date.parse(iso));
const OFFSET = 420;
const DATE = "2026-06-11";

describe("inWindow", () => {
  it("includes a task that starts on the date", () => {
    expect(inWindow({ start_date: ms("2026-06-11T02:00:00Z"), due_date: ms("2026-06-13T02:00:00Z") }, DATE, OFFSET)).toBe(true);
  });
  it("includes a task due on the date", () => {
    expect(inWindow({ start_date: ms("2026-06-08T02:00:00Z"), due_date: ms("2026-06-11T10:00:00Z") }, DATE, OFFSET)).toBe(true);
  });
  it("includes a task spanning the date", () => {
    expect(inWindow({ start_date: ms("2026-06-08T02:00:00Z"), due_date: ms("2026-06-15T02:00:00Z") }, DATE, OFFSET)).toBe(true);
  });
  it("excludes an overdue task", () => {
    expect(inWindow({ start_date: ms("2026-06-01T02:00:00Z"), due_date: ms("2026-06-10T02:00:00Z") }, DATE, OFFSET)).toBe(false);
  });
  it("excludes a task that starts later", () => {
    expect(inWindow({ start_date: ms("2026-06-12T02:00:00Z"), due_date: ms("2026-06-14T02:00:00Z") }, DATE, OFFSET)).toBe(false);
  });
  it("respects the timezone at day boundaries", () => {
    // due 2026-06-10 18:00 UTC = 2026-06-11 01:00 local → still due on the 11th
    expect(inWindow({ start_date: null, due_date: ms("2026-06-10T18:00:00Z") }, DATE, OFFSET)).toBe(true);
  });
  it("treats a missing start as the due date", () => {
    expect(inWindow({ start_date: null, due_date: ms("2026-06-11T02:00:00Z") }, DATE, OFFSET)).toBe(true);
    expect(inWindow({ start_date: null, due_date: ms("2026-06-12T02:00:00Z") }, DATE, OFFSET)).toBe(false);
  });
  it("excludes a task with no due date", () => {
    expect(inWindow({ start_date: ms("2026-06-01T02:00:00Z"), due_date: null }, DATE, OFFSET)).toBe(false);
  });
});
