/**
 * @jest-environment node
 */
import { ZipBuilder } from "@keeplas/export";
import * as mammoth from "mammoth/mammoth.browser";
import * as XLSX from "xlsx";

import { officePage, sheetToHtml, wordToHtml } from "../office-html";

const encode = (text: string) => new TextEncoder().encode(text);

function minimalDocx(paragraph: string): Uint8Array {
  const zip = new ZipBuilder();
  const when = new Date();
  const parts = [
    zip.file(
      "[Content_Types].xml",
      encode(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      when,
    ),
    zip.file(
      "_rels/.rels",
      encode(
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
      when,
    ),
    zip.file(
      "word/document.xml",
      encode(
        `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${paragraph}</w:t></w:r></w:p></w:body></w:document>`,
      ),
      when,
    ),
    zip.finish(),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

describe("office files to HTML", () => {
  it("reads the text of a Word document", async () => {
    expect(
      await wordToHtml(minimalDocx("Testament de Marie"), async () => mammoth),
    ).toBe("<p>Testament de Marie</p>");
  });

  it("turns every sheet into a titled table, escaping cell text", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Compte", "Montant"],
        ["<script>", 42],
      ]),
      "Budget <2026>",
    );
    const bytes = new Uint8Array(
      XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    );
    const html = await sheetToHtml(bytes, async () => XLSX);
    expect(html).toContain('<h2 class="sheet">Budget &lt;2026&gt;</h2>');
    expect(html).toContain("Montant");
    expect(html).toContain("42");
    expect(html).not.toContain("<script>");
  });

  it("wraps the body in a page that blocks scripts and remote content", () => {
    const page = officePage("<p>x</p>", { text: "#000", border: "#ccc" });
    expect(page).toContain("default-src 'none'");
    expect(page).toContain("<p>x</p>");
  });
});
