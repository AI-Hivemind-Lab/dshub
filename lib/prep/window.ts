import type { ClickUpTask } from "@/lib/clickup/types";
import { toLocalDate } from "./dates";

/** True when start ≤ date ≤ due (local dates). Missing start = due; missing due = excluded. */
export function inWindow(
  task: Pick<ClickUpTask, "start_date" | "due_date">,
  date: string,
  offsetMin: number,
): boolean {
  if (!task.due_date) return false;
  const due = toLocalDate(Number(task.due_date), offsetMin);
  const start = task.start_date ? toLocalDate(Number(task.start_date), offsetMin) : due;
  return start <= date && date <= due;
}
