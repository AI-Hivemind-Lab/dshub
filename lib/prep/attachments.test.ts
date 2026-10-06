import { describe, expect, it } from "vitest";
import { filterAttachments } from "./attachments";

describe("filterAttachments", () => {
  it("keeps documents and counts hidden images", () => {
    const result = filterAttachments([
      { id: "1", title: "SubDoc_v3.pdf", url: "u1", extension: "pdf", mimetype: "application/pdf" },
      { id: "2", title: "image.png", url: "u2", extension: "png", mimetype: "image/png" },
      { id: "3", title: "Checklist.xlsx", url: "u3", extension: null, mimetype: null },
      { id: "4", title: "screenshot.JPG", url: "u4" },
      { id: "5", title: "scan", url: "u5", mimetype: "image/heic" },
    ]);
    expect(result.files).toEqual([
      { title: "SubDoc_v3.pdf", url: "u1" },
      { title: "Checklist.xlsx", url: "u3" },
    ]);
    expect(result.hiddenImageCount).toBe(3);
  });

  it("handles an empty list", () => {
    expect(filterAttachments([])).toEqual({ files: [], hiddenImageCount: 0 });
  });
});
