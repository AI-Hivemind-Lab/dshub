import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

const base = { CLICKUP_TOKEN: "pk_x", CLICKUP_TEAM_ID: "T1", CLICKUP_SPACE_ID: "S1" };

describe("loadConfig", () => {
  it("applies defaults", () => {
    expect(loadConfig(base)).toEqual({
      clickupToken: "pk_x",
      teamId: "T1",
      spaceId: "S1",
      allowedDomain: "anduintransact.com",
      tzOffsetMinutes: 420,
      noisePatterns: ["estimation", "update request", "availability", "slotting", "team sync"],
    });
  });
  it("reads overrides", () => {
    const cfg = loadConfig({ ...base, ALLOWED_EMAIL_DOMAIN: "Example.com", TZ_OFFSET: "+00:00", NOISE_PATTERNS: "foo" });
    expect(cfg.allowedDomain).toBe("example.com");
    expect(cfg.tzOffsetMinutes).toBe(0);
    expect(cfg.noisePatterns).toEqual(["foo"]);
  });
  it("lists every missing required variable", () => {
    expect(() => loadConfig({ CLICKUP_TOKEN: "pk_x" })).toThrow(
      "Missing environment variables: CLICKUP_TEAM_ID, CLICKUP_SPACE_ID",
    );
  });
});
