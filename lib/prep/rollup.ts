import type { ClickUpTask } from "@/lib/clickup/types";
import type { TaskGroup } from "./types";

export function rollUp(tasks: ClickUpTask[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const parentId = task.parent ?? task.id;
    let group = groups.get(parentId);
    if (!group) {
      group = { parentId, members: [] };
      groups.set(parentId, group);
    }
    if (!group.members.some((m) => m.id === task.id)) group.members.push(task);
  }
  return [...groups.values()];
}
