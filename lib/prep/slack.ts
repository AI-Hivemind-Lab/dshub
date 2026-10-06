import type { SlackLink, SlackLinks } from "./types";

const SLACK_URL = /https?:\/\/[a-z0-9-]+\.slack\.com\/[^\s)\]>"'<|]+/gi;

type Kind = "cs" | "testing";

function classify(label: string): Kind | null {
  const l = label.toLowerCase();
  if (/test|qa/.test(l)) return "testing";
  if (/\bcs\b|customer|client|support/.test(l)) return "cs";
  return null;
}

function isThreadLink(url: string): boolean {
  return /thread_ts=/.test(url) || /\/p\d{10,}/.test(url);
}

export function parseSlackLinks(text: string): SlackLinks {
  const result: SlackLinks = { cs: null, testing: null };
  const unlabeled: SlackLink[] = [];
  const seen = new Set<string>();
  let prevEnd = 0;

  for (const match of text.matchAll(SLACK_URL)) {
    const index = match.index ?? 0;
    const url = match[0].replace(/[.,;]+$/, "");
    const lineStart = text.lastIndexOf("\n", index - 1) + 1;
    const label = text.slice(Math.max(lineStart, prevEnd), index);
    prevEnd = index + match[0].length;

    if (seen.has(url)) continue;
    seen.add(url);

    const link: SlackLink = { url, isThread: isThreadLink(url) };
    const kind = classify(label);
    if (kind) {
      if (!result[kind]) result[kind] = link;
    } else {
      unlabeled.push(link);
    }
  }

  for (const link of unlabeled) {
    if (!result.cs) result.cs = link;
    else if (!result.testing) result.testing = link;
  }
  return result;
}
