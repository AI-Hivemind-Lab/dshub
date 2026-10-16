import { describe, expect, it } from "vitest";
import { formatEstimate } from "./format";

const min = (n: number) => n * 60_000;

describe("formatEstimate", () => {
  it("formats minutes, whole hours and mixed", () => {
    expect(formatEstimate(min(45))).toBe("45m");
    expect(formatEstimate(min(60))).toBe("1h");
    expect(formatEstimate(min(120))).toBe("2h");
    expect(formatEstimate(min(90))).toBe("1h 30m");
  });
  it("rounds to the nearest minute, minimum 1m", () => {
    expect(formatEstimate(min(89) + 29_000)).toBe("1h 29m");
    expect(formatEstimate(min(89) + 31_000)).toBe("1h 30m");
    expect(formatEstimate(20_000)).toBe("1m");
  });
  it("returns empty for missing or non-positive values", () => {
    expect(formatEstimate(null)).toBe("");
    expect(formatEstimate(undefined)).toBe("");
    expect(formatEstimate(0)).toBe("");
    expect(formatEstimate(-5)).toBe("");
  });
});
