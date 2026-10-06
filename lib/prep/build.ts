import type { ClickUpTask } from "@/lib/clickup/types";
import { filterAttachments } from "./attachments";
import { toLocalDate } from "./dates";
import { parseSlackLinks } from "./slack";
import type { FundGroup, SubTask, TaskGroup } from "./types";

export function toSubTask(task: ClickUpTask, offsetMin: number): SubTask {
  return {
    id: task.id,
    name: task.name,
    url: task.url,
    startDate: task.start_date ? toLocalDate(Number(task.start_date), offsetMin) : null,
    dueDate: task.due_date ? toLocalDate(Number(task.due_date), offsetMin) : null,
  };
}

function byDueDate(a: SubTask, b: SubTask): number {
  if (a.dueDate === b.dueDate) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

export function buildFundGroup(group: TaskGroup, parent: ClickUpTask | null, offsetMin: number): FundGroup {
  const subtasks = group.members.map((m) => toSubTask(m, offsetMin)).sort(byDueDate);
  if (!parent) {
    return {
      parentId: group.parentId,
      name: `Task ${group.parentId}`,
      url: `https://app.clickup.com/t/${group.parentId}`,
      subtasks,
      slack: { cs: null, testing: null },
      files: [],
      hiddenImageCount: 0,
      loadError: true,
    };
  }
  const { files, hiddenImageCount } = filterAttachments(parent.attachments ?? []);
  return {
    parentId: group.parentId,
    name: parent.name,
    url: parent.url,
    subtasks,
    slack: parseSlackLinks(parent.markdown_description || parent.description || ""),
    files,
    hiddenImageCount,
    loadError: false,
  };
}
