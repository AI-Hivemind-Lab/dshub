import { describe, expect, it } from "vitest";
import {
  addDays,
  formatLongDate,
  formatShortDate,
  isValidDate,
  parseOffset,
  toLocalDate,
  todayLocal,
} from "./dates";

describe("parseOffset", () => {
  it("parses positive and negative offsets to minutes", () => {
    expect(parseOffset("+07:00")).toBe(420);
    expect(parseOffset("-05:30")).toBe(-330);
  });
  it("defaults to +07:00", () => {
    expect(parseOffset()).toBe(420);
  });
  it("throws on bad input", () => {
    expect(() => parseOffset("7")).toThrow("Invalid TZ_OFFSET");
  });
});

describe("toLocalDate", () => {
  it("09:00 UTC+7 is 02:00 UTC on the same day", () => {
    expect(toLocalDate(Date.parse("2026-06-11T02:00:00Z"), 420)).toBe("2026-06-11");
  });
  it("23:30 local stays on that day", () => {
    expect(toLocalDate(Date.parse("2026-06-11T16:30:00Z"), 420)).toBe("2026-06-11");
  });
  it("18:00 UTC rolls over to the next local day", () => {
    expect(toLocalDate(Date.parse("2026-06-11T18:00:00Z"), 420)).toBe("2026-06-12");
  });
});

describe("todayLocal", () => {
  it("uses the offset", () => {
    expect(todayLocal(420, Date.parse("2026-10-05T20:00:00Z"))).toBe("2026-10-06");
  });
});

describe("isValidDate", () => {
  it("accepts real dates only", () => {
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-2-3")).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });
});

describe("addDays", () => {
  it("crosses month boundaries", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("formatting", () => {
  it("formats long and short dates", () => {
    expect(formatLongDate("2026-06-11")).toBe("Thu, Jun 11, 2026");
    expect(formatShortDate("2026-06-11")).toBe("Jun 11");
  });
});
