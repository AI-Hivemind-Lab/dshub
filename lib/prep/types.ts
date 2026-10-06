import type { ClickUpTask } from "@/lib/clickup/types";

export interface SubTask {
  id: string;
  name: string;
  url: string;
  startDate: string | null;
  dueDate: string | null;
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
}

export interface DayView {
  date: string;
  subtaskCount: number;
  groups: FundGroup[];
}
