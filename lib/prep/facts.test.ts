import { describe, expect, it } from "vitest";
import type { ClickUpCustomField } from "@/lib/clickup/types";
import { fundCustomFields } from "@/lib/clickup/test-fixtures";
import { extractFundFacts } from "./facts";

const OFFSET = 420;
const withField = (id: string, patch: Partial<ClickUpCustomField>) =>
  fundCustomFields.map((f) => (f.id === id ? { ...f, ...patch } : f));

const TARGET = "d6383cc7-7921-4655-b0eb-bc5dbbc8ef23";
const LAUNCH = "cf3b66ac-573c-4f52-8c62-323638c11967";
const SERVER = "ac4b808b-9094-4219-ac14-41df4f0eac81";
const STRUCTURE = "3ab4b383-df56-40f2-9a84-4a00e7d9adc6";
const JURIS = "91fe79b5-8500-405e-820e-4c3c1db3532b";
const SUBDOCS = "d35773c1-5023-41cf-acce-86db37cd507b";

describe("extractFundFacts", () => {
  it("extracts the six facts in order and ignores other fields", () => {
    expect(extractFundFacts({ custom_fields: fundCustomFields }, OFFSET)).toEqual([
      { label: "Target delivery", value: "Oct 20" },
      { label: "Expected launch", value: "Oct 5" },
      { label: "Server", value: "Global" },
      { label: "Structure", value: "2 mutually exclusive funds" },
      { label: "Jurisdictions", value: "Delaware, Ireland" },
      { label: "Subdocs", value: "2" },
    ]);
  });

  it("keeps the fixed order regardless of field order", () => {
    const reversed = [...fundCustomFields].reverse();
    expect(extractFundFacts({ custom_fields: reversed }, OFFSET).map((f) => f.label)).toEqual([
      "Target delivery", "Expected launch", "Server", "Structure", "Jurisdictions", "Subdocs",
    ]);
  });

  it("converts dates using the timezone offset", () => {
    // 1791147600000 = 2026-10-04T17:00Z → Oct 5 in UTC+7, Oct 4 in UTC
    expect(extractFundFacts({ custom_fields: fundCustomFields }, 0)[1]).toEqual({ label: "Expected launch", value: "Oct 4" });
  });

  it("returns nothing without custom fields", () => {
    expect(extractFundFacts({}, OFFSET)).toEqual([]);
  });

  it("omits null, empty and empty-array values", () => {
    const fields = withField(TARGET, { value: null })
      .map((f) => (f.id === SERVER ? { ...f, value: [] } : f))
      .map((f) => (f.id === SUBDOCS ? { ...f, value: "" } : f));
    const labels = extractFundFacts({ custom_fields: fields }, OFFSET).map((f) => f.label);
    expect(labels).toEqual(["Expected launch", "Structure", "Jurisdictions"]);
  });

  it("omits an unknown drop_down option", () => {
    const labels = extractFundFacts({ custom_fields: withField(STRUCTURE, { value: 42 }) }, OFFSET).map((f) => f.label);
    expect(labels).not.toContain("Structure");
  });

  it("drops unknown label ids, and omits the fact if none resolve", () => {
    const partial = withField(JURIS, { value: ["6c5c3cb6-ae75-443c-8087-5d90c05a276a", "nope"] });
    expect(extractFundFacts({ custom_fields: partial }, OFFSET).find((f) => f.label === "Jurisdictions")?.value).toBe("Delaware");
    const none = withField(JURIS, { value: ["nope"] });
    expect(extractFundFacts({ custom_fields: none }, OFFSET).map((f) => f.label)).not.toContain("Jurisdictions");
  });

  it("omits a field whose type is not the expected one", () => {
    const labels = extractFundFacts({ custom_fields: withField(SUBDOCS, { type: "short_text" }) }, OFFSET).map((f) => f.label);
    expect(labels).not.toContain("Subdocs");
  });

  it("omits a non-numeric date", () => {
    const labels = extractFundFacts({ custom_fields: withField(LAUNCH, { value: "soon" }) }, OFFSET).map((f) => f.label);
    expect(labels).not.toContain("Expected launch");
  });
});
