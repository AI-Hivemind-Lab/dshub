import type { ClickUpAttachment } from "@/lib/clickup/types";
import type { FileLink } from "./types";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic", "tif", "tiff"]);

function extensionOf(a: ClickUpAttachment): string {
  const raw = a.extension ?? (a.title.includes(".") ? a.title.split(".").pop() : "") ?? "";
  return raw.toLowerCase().replace(/^\./, "");
}

export function filterAttachments(list: ClickUpAttachment[]): {
  files: FileLink[];
  hiddenImageCount: number;
} {
  const files: FileLink[] = [];
  let hiddenImageCount = 0;
  for (const a of list) {
    if (a.mimetype?.startsWith("image/") || IMAGE_EXTENSIONS.has(extensionOf(a))) {
      hiddenImageCount++;
    } else {
      files.push({ title: a.title, url: a.url });
    }
  }
  return { files, hiddenImageCount };
}
