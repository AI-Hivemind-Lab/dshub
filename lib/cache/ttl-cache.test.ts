import { describe, expect, it } from "vitest";
import { TtlCache } from "./ttl-cache";

describe("TtlCache", () => {
  it("returns fresh values and expires them", () => {
    let now = 0;
    const cache = new TtlCache<string>(1000, () => now);
    cache.set("k", "v");
    now = 999;
    expect(cache.get("k")).toBe("v");
    now = 1000;
    expect(cache.get("k")).toBeUndefined();
    expect(cache.peek("k")).toBe("v");
  });
  it("evicts the oldest entry when full", () => {
    const cache = new TtlCache<number>(1000, () => 0, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.peek("a")).toBeUndefined();
    expect(cache.peek("b")).toBe(2);
    expect(cache.peek("c")).toBe(3);
  });
});
