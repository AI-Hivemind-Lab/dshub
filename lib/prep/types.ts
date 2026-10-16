import type { ClickUpTask } from "@/lib/clickup/types";

export interface TaskStatus {
  label: string;
  color: string;
}

export interface Priority {
  label: string;
  color: string;
  rank: number;
}

export interface SubTask {
  id: string;
  name: string;
  shortName: string;
  url: string;
  startDate: string | null;
  dueDate: string | null;
  status: TaskStatus | null;
  priority: Priority | null;
  estimateMs: number | null;
}

export interface SlackLink {
  url: string;
  isThread: boolean;
}

export interface SlackLinks {
  cs: SlackLink | null;
  testing: SlackLink | null;
}

export interface FileLink {
  title: string;
  url: string;
}

export interface TaskGroup {
  parentId: string;
  members: ClickUpTask[];
}

export interface FundGroup {
  parentId: string;
  name: string;
  url: string;
  subtasks: SubTask[];
  slack: SlackLinks;
  files: FileLink[];
  hiddenImageCount: number;
  loadError: boolean;
  client: string | null;
  listName: string | null;
  facts: FundFact[];
  notes: string | null;
  topPriority: Priority | null;
}

export type UrgencyKey = "today" | "week" | "later";

export interface UrgencyGroup {
  key: UrgencyKey;
  label: string;
  funds: FundGroup[];
}

export interface DayView {
  date: string;
  subtaskCount: number;
  groups: FundGroup[];
}

export interface FundFact {
  label: string;
  value: string;
}
