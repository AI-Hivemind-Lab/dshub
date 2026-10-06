import { describe, expect, it } from "vitest";
import { DEFAULT_NOISE_PATTERNS, isNoise, parseNoisePatterns } from "./noise";

describe("parseNoisePatterns", () => {
  it("uses defaults when unset or blank", () => {
    expect(parseNoisePatterns(undefined)).toEqual(DEFAULT_NOISE_PATTERNS);
    expect(parseNoisePatterns("  ")).toEqual(DEFAULT_NOISE_PATTERNS);
  });
  it("splits, trims and lowercases a custom list", () => {
    expect(parseNoisePatterns(" Foo , BAR baz,,")).toEqual(["foo", "bar baz"]);
  });
});

describe("isNoise", () => {
  it("matches default patterns case-insensitively", () => {
    for (const name of [
      "Estimation queue - Fortress",
      "UPDATE REQUEST: Gilde",
      "Availability for Q4",
      "Slotting week 41",
      "Team Sync",
    ]) {
      expect(isNoise(name, DEFAULT_NOISE_PATTERNS)).toBe(true);
    }
  });
  it("keeps real work", () => {
    expect(isNoise("Form Support", DEFAULT_NOISE_PATTERNS)).toBe(false);
    expect(isNoise("Checklist Fix", DEFAULT_NOISE_PATTERNS)).toBe(false);
  });
});
