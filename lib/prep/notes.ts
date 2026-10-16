const SLACK_URL = /https?:\/\/[a-z0-9-]+\.slack\.com\//i;
const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export type NotePart = { text: string } | { label: string; url: string };

/** Fund description minus its Slack-link lines; null when nothing else is left. */
export function extractNotes(text: string | null | undefined): string | null {
  if (!text) return null;
  const kept = text
    .split("\n")
    .filter((line) => !SLACK_URL.test(line))
    .join("\n");
  const tidy = kept.replace(/\n{3,}/g, "\n\n").trim();
  return tidy === "" ? null : tidy;
}

/** Splits notes into text and http(s) markdown-link parts for rendering. */
export function toNoteParts(notes: string): NotePart[] {
  const parts: NotePart[] = [];
  let last = 0;
  for (const match of notes.matchAll(MD_LINK)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: notes.slice(last, index) });
    parts.push({ label: match[1], url: match[2] });
    last = index + match[0].length;
  }
  if (last < notes.length) parts.push({ text: notes.slice(last) });
  return parts;
}
