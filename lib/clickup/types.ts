export interface ClickUpAttachment {
  id: string;
  title: string;
  url: string;
  extension?: string | null;
  mimetype?: string | null;
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
}

export interface ClickUpMember {
  id: number;
  username: string;
  email: string;
}
