import { describe, expect, it } from "vitest";

import { itemsJson, planExport, type ExportItem } from "../src/layout";
import { parseManifest } from "../src/manifest";
import { entryDataStart, readStoredText, readZipEntries } from "../src/unzip";
import { ZipBuilder } from "../src/zip";

const encode = (value: string) => new TextEncoder().encode(value);

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const reader = (bytes: Uint8Array) => (offset: number, length: number) =>
  bytes.subarray(offset, offset + length);

describe("readZipEntries", () => {
  it("reads back what ZipBuilder wrote", () => {
    const zip = new ZipBuilder();
    const when = new Date();
    const archive = concat([
      zip.file("README.txt", encode("hello"), when),
      zip.file("files/Famille/Testament/acte é.pdf", encode("%PDF"), when),
      zip.finish(),
    ]);
    const read = reader(archive);
    const entries = readZipEntries(read, archive.length);
    expect(entries.map((entry) => entry.name)).toEqual([
      "README.txt",
      "files/Famille/Testament/acte é.pdf",
    ]);
    expect(readStoredText(read, entries[1])).toBe("%PDF");
    expect(entryDataStart(read, entries[0])).toBe(30 + "README.txt".length);
  });

  it("reads a ZIP64 directory (65 535 entries and more)", () => {
    const zip = new ZipBuilder();
    const when = new Date();
    const parts: Uint8Array[] = [];
    for (let i = 0; i < 65_536; i++) {
      parts.push(zip.file(`f${i}`, new Uint8Array(0), when));
    }
    parts.push(zip.finish());
    const archive = concat(parts);
    const entries = readZipEntries(reader(archive), archive.length);
    expect(entries).toHaveLength(65_536);
    expect(entries[65_535].name).toBe("f65535");
  });

  it("rejects something that is not a ZIP", () => {
    expect(() =>
      readZipEntries(reader(encode("not a zip at all")), 16),
    ).toThrow("End of central directory");
  });
});

describe("parseManifest", () => {
  it("reads the items an export wrote", () => {
    const item: ExportItem = {
      id: "1",
      title: "Will",
      category: "document",
      folder: "Family",
      createdAt: 0,
      updatedAt: 0,
      note: "<p>Keys</p>",
      links: ["https://example.com"],
      sharedWith: ["Marie"],
      files: [{ name: "a.pdf", mimeType: "application/pdf", size: 4 }],
    };
    const planned = planExport([item], {
      untitled: "Untitled",
      noFolder: "No folder",
      file: "file",
    });
    expect(parseManifest(itemsJson(planned, [], 0))).toEqual([
      {
        title: "Will",
        category: "document",
        folder: "Family",
        note: "<p>Keys</p>",
        links: ["https://example.com"],
        files: [
          {
            name: "a.pdf",
            mimeType: "application/pdf",
            path: "files/Family/Will/a.pdf",
          },
        ],
      },
    ]);
  });

  it("refuses another format and drops paths outside files/", () => {
    expect(() => parseManifest('{"format":"other","version":1}')).toThrow(
      "Not a Keeplas export",
    );
    const [item] = parseManifest(
      JSON.stringify({
        format: "keeplas-export",
        version: 1,
        items: [{ title: 3, files: [{ path: "../../etc/passwd" }] }],
      }),
    );
    expect(item.title).toBe("");
    expect(item.files).toEqual([]);
  });
});
