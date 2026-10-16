import type { ClickUpTask } from "@/lib/clickup/types";
import type { Priority, SubTask } from "./types";

const RANK: Record<string, number> = { urgent: 1, high: 2, normal: 3, low: 4 };
const FALLBACK_COLOR = "#6b655a";

/** Only plain hex colours from ClickUp reach inline styles. */
export function safeColor(color: string | null | undefined): string {
  return color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : FALLBACK_COLOR;
}

export function toPriority(raw: ClickUpTask["priority"]): Priority | null {
  if (!raw?.priority) return null;
  const key = raw.priority.toLowerCase();
  const rank = RANK[key];
  if (!rank) return null;
  return { label: key.charAt(0).toUpperCase() + key.slice(1), color: safeColor(raw.color), rank };
}

export function topPriority(subtasks: Pick<SubTask, "priority">[]): Priority | null {
  let best: Priority | null = null;
  for (const s of subtasks) {
    if (s.priority && (!best || s.priority.rank < best.rank)) best = s.priority;
  }
  return best;
}
