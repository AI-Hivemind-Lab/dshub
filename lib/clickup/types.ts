export interface ClickUpAttachment {
  id: string;
  title: string;
  url: string;
  extension?: string | null;
  mimetype?: string | null;
}

export interface ClickUpCustomFieldOption {
  id: string;
  name?: string;
  label?: string;
  orderindex: number | string;
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value?: unknown;
  type_config?: { options?: ClickUpCustomFieldOption[] };
}

export interface ClickUpTask {
  id: string;
  name: string;
  url: string;
  parent: string | null;
  start_date: string | null;
  due_date: string | null;
  description?: string | null;
  markdown_description?: string | null;
  attachments?: ClickUpAttachment[];
  status?: { status: string; color: string };
  priority?: { priority: string; color: string } | null;
  time_estimate?: number | null;
  custom_fields?: ClickUpCustomField[];
  folder?: { name: string; hidden?: boolean };
  list?: { name: string };
}

export interface ClickUpMember {
  id: number;
  username: string;
  email: string;
}
