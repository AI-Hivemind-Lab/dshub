import { addDays } from "./dates";
import type { FundGroup, UrgencyGroup, UrgencyKey } from "./types";

const ORDER: UrgencyKey[] = ["today", "week", "later"];
const LABELS: Record<UrgencyKey, string> = { today: "Due today", week: "This week", later: "Later" };

function earliestDue(fund: FundGroup): string | null {
  let earliest: string | null = null;
  for (const s of fund.subtasks) {
    if (s.dueDate && (earliest === null || s.dueDate < earliest)) earliest = s.dueDate;
  }
  return earliest;
}

function urgencyOf(due: string | null, date: string): UrgencyKey {
  if (!due || due > addDays(date, 6)) return "later";
  return due <= date ? "today" : "week";
}

export function groupByUrgency(funds: FundGroup[], date: string): UrgencyGroup[] {
  const entries = funds.map((fund) => ({ fund, due: earliestDue(fund) }));
  return ORDER.map((key) => ({
    key,
    label: LABELS[key],
    funds: entries
      .filter((e) => urgencyOf(e.due, date) === key)
      .sort((a, b) => {
        const da = a.due ?? "9999-12-31";
        const db = b.due ?? "9999-12-31";
        if (da !== db) return da < db ? -1 : 1;
        return a.fund.name.localeCompare(b.fund.name, undefined, { sensitivity: "base" });
      })
      .map((e) => e.fund),
  })).filter((g) => g.funds.length > 0);
}
