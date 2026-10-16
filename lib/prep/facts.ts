import type { ClickUpCustomField, ClickUpCustomFieldOption, ClickUpTask } from "@/lib/clickup/types";
import { formatShortDate, toLocalDate } from "./dates";
import type { FundFact } from "./types";

type FactKind = "date" | "labels" | "drop_down" | "number";

/** Fund facts shown in the detail panel, matched by ClickUp custom-field ID (stable across renames). */
export const FACT_FIELDS: ReadonlyArray<{ label: string; id: string; kind: FactKind }> = [
  { label: "Target delivery", id: "d6383cc7-7921-4655-b0eb-bc5dbbc8ef23", kind: "date" },
  { label: "Expected launch", id: "cf3b66ac-573c-4f52-8c62-323638c11967", kind: "date" },
  { label: "Server", id: "ac4b808b-9094-4219-ac14-41df4f0eac81", kind: "labels" },
  { label: "Structure", id: "3ab4b383-df56-40f2-9a84-4a00e7d9adc6", kind: "drop_down" },
  { label: "Jurisdictions", id: "91fe79b5-8500-405e-820e-4c3c1db3532b", kind: "labels" },
  { label: "Subdocs", id: "d35773c1-5023-41cf-acce-86db37cd507b", kind: "number" },
];

// labels options carry their text in `label`, drop_down options in `name`.
const optionText = (o: ClickUpCustomFieldOption): string | null => o.label ?? o.name ?? null;

function formatValue(field: ClickUpCustomField, kind: FactKind, offsetMin: number): string | null {
  if (field.type !== kind) return null;
  const value = field.value;
  if (value === null || value === undefined || value === "") return null;
  const options = field.type_config?.options ?? [];
  switch (kind) {
    case "date": {
      const ms = Number(value);
      return Number.isFinite(ms) ? formatShortDate(toLocalDate(ms, offsetMin)) : null;
    }
    case "number": {
      const n = Number(value);
      return Number.isFinite(n) ? String(n) : null;
    }
    case "drop_down": {
      const option = options.find((o) => Number(o.orderindex) === Number(value));
      return option ? optionText(option) : null;
    }
    case "labels": {
      if (!Array.isArray(value)) return null;
      const names = value
        .map((id) => options.find((o) => o.id === id))
        .map((o) => (o ? optionText(o) : null))
        .filter((s): s is string => Boolean(s));
      return names.length > 0 ? names.join(", ") : null;
    }
  }
}

export function extractFundFacts(parent: Pick<ClickUpTask, "custom_fields">, offsetMin: number): FundFact[] {
  const byId = new Map((parent.custom_fields ?? []).map((f) => [f.id, f]));
  const facts: FundFact[] = [];
  for (const spec of FACT_FIELDS) {
    const field = byId.get(spec.id);
    const value = field ? formatValue(field, spec.kind, offsetMin) : null;
    if (value) facts.push({ label: spec.label, value });
  }
  return facts;
}
