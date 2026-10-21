import { describe, expect, it } from "vitest";

import {
  itemsCsv,
  itemsJson,
  noteDocument,
  planExport,
  safeName,
  type ExportItem,
} from "../src/layout";

const LABELS = { untitled: "Untitled", noFolder: "No folder", file: "file" };

const item = (patch: Partial<ExportItem>): ExportItem => ({
  id: "i1",
  title: "Will",
  category: "document",
  folder: null,
  createdAt: Date.UTC(2026, 0, 1),
  updatedAt: Date.UTC(2026, 0, 2),
  note: "",
  links: [],
  sharedWith: [],
  files: [],
  ...patch,
});

describe("safeName", () => {
  it("removes path separators and control characters", () => {
    expect(safeName("../a/b\\c:d\u0000", "x")).toBe("_a_b_c_d_");
    expect(safeName("  ...  ", "x")).toBe("x");
  });
});

describe("planExport", () => {
  it("gives every item and file a unique path", () => {
    const planned = planExport(
      [
        item({
          id: "1",
          folder: "Family",
          files: [
            { name: "scan.pdf", mimeType: "application/pdf", size: 3 },
            { name: "scan.pdf", mimeType: "application/pdf", size: 4 },
          ],
        }),
        item({
          id: "2",
          folder: "Family",
          note: "<p>Keys</p>",
          files: [{ name: "scan.pdf", mimeType: "application/pdf", size: 5 }],
        }),
        item({ id: "3", note: "<p>Hi</p>" }),
      ],
      LABELS,
    );
    expect(planned.map((p) => p.filePaths)).toEqual([
      ["files/Family/Will/scan.pdf", "files/Family/Will/scan (2).pdf"],
      ["files/Family/Will (2)/scan.pdf"],
      [],
    ]);
    expect(planned.map((p) => p.notePath)).toEqual([
      null,
      "notes/Will.html",
      "notes/Will (2).html",
    ]);
  });
});

describe("exported documents", () => {
  it("rebuilds note HTML from allowed tags only", () => {
    const html = noteDocument(
      "<b>T</b>",
      '<p onclick="x">Hi <strong>you</strong></p><script>alert(1)</script>',
    );
    expect(html).toContain("<title>&lt;b&gt;T&lt;/b&gt;</title>");
    expect(html).toContain("<p>Hi <strong>you</strong></p>");
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
  });

  it("writes a CSV spreadsheets open as UTF-8", () => {
    const [planned] = planExport(
      [item({ title: 'Plan, "A"', note: "<p>Line</p>" })],
      LABELS,
    );
    const csv = itemsCsv([planned]);
    expect(csv.startsWith("﻿title,category,folder")).toBe(true);
    expect(csv).toContain('"Plan, ""A"""');
  });

  it("lists items with their note and file paths", () => {
    const [planned] = planExport(
      [
        item({
          note: "<p>Keys</p>",
          files: [{ name: "a.jpg", mimeType: "image/jpeg", size: 1 }],
        }),
      ],
      LABELS,
    );
    const json = JSON.parse(itemsJson([planned], [], Date.UTC(2026, 9, 21)));
    expect(json.format).toBe("keeplas-export");
    expect(json.items[0].note).toEqual({
      html: "<p>Keys</p>",
      text: "Keys",
      path: "notes/Will.html",
    });
    expect(json.items[0].files[0].path).toBe("files/No folder/Will/a.jpg");
  });
});
