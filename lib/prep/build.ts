import type { ClickUpTask } from "@/lib/clickup/types";
import { filterAttachments } from "./attachments";
import { toLocalDate } from "./dates";
import { extractFundFacts } from "./facts";
import { shortSubtaskName } from "./names";
import { extractNotes } from "./notes";
import { safeColor, toPriority, topPriority } from "./priority";
import { parseSlackLinks } from "./slack";
import type { FundGroup, SubTask, TaskGroup } from "./types";

export function toSubTask(task: ClickUpTask, offsetMin: number, parentName: string | null = null): SubTask {
  return {
    id: task.id,
    name: task.name,
    shortName: shortSubtaskName(task.name, parentName),
    url: task.url,
    startDate: task.start_date ? toLocalDate(Number(task.start_date), offsetMin) : null,
    dueDate: task.due_date ? toLocalDate(Number(task.due_date), offsetMin) : null,
    status: task.status ? { label: task.status.status, color: safeColor(task.status.color) } : null,
    priority: toPriority(task.priority),
    estimateMs: task.time_estimate && task.time_estimate > 0 ? task.time_estimate : null,
  };
}

function byDueDate(a: SubTask, b: SubTask): number {
  if (a.dueDate === b.dueDate) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

export function buildFundGroup(group: TaskGroup, parent: ClickUpTask | null, offsetMin: number): FundGroup {
  const subtasks = group.members.map((m) => toSubTask(m, offsetMin, parent?.name ?? null)).sort(byDueDate);
  const top = topPriority(subtasks);
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
      client: null,
      listName: null,
      facts: [],
      notes: null,
      topPriority: top,
    };
  }
  const description = parent.markdown_description || parent.description || "";
  const { files, hiddenImageCount } = filterAttachments(parent.attachments ?? []);
  return {
    parentId: group.parentId,
    name: parent.name,
    url: parent.url,
    subtasks,
    slack: parseSlackLinks(description),
    files,
    hiddenImageCount,
    loadError: false,
    client: parent.folder && !parent.folder.hidden ? parent.folder.name : null,
    listName: parent.list?.name ?? null,
    facts: extractFundFacts(parent, offsetMin),
    notes: extractNotes(description),
    topPriority: top,
  };
}
