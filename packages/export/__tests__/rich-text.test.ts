import { describe, expect, it } from "vitest";
import {
  isEmptyNote,
  noteToHtml,
  noteToPlainText,
  parseNote,
} from "../src/rich-text";

describe("noteToHtml", () => {
  it("wraps plain text lines in escaped paragraphs", () => {
    expect(noteToHtml("Line <1>\nTom & Jerry")).toBe(
      "<p>Line &lt;1&gt;</p><p>Tom &amp; Jerry</p>",
    );
  });

  it("keeps editor HTML and drops an empty editor", () => {
    expect(noteToHtml("<p><strong>Hi</strong></p>")).toBe(
      "<p><strong>Hi</strong></p>",
    );
    expect(noteToHtml("<p></p>")).toBe("");
    expect(noteToHtml("   ")).toBe("");
  });
});

describe("parseNote", () => {
  it("reads the formats the web editor writes", () => {
    const blocks = parseNote(
      "<h2>Plan</h2><p>Call <strong>Marie</strong> and <em>Paul</em></p>" +
        "<ul><li><p>Keys</p></li><li><p>Will</p></li></ul>" +
        "<ol><li><p>First</p></li></ol><blockquote><p>Be kind</p></blockquote>",
    );
    expect(blocks).toEqual([
      { type: "heading", level: 2, runs: [{ text: "Plan", marks: [] }] },
      {
        type: "paragraph",
        runs: [
          { text: "Call ", marks: [] },
          { text: "Marie", marks: ["bold"] },
          { text: " and ", marks: [] },
          { text: "Paul", marks: ["italic"] },
        ],
      },
      {
        type: "item",
        ordered: false,
        index: 1,
        depth: 0,
        runs: [{ text: "Keys", marks: [] }],
      },
      {
        type: "item",
        ordered: false,
        index: 2,
        depth: 0,
        runs: [{ text: "Will", marks: [] }],
      },
      {
        type: "item",
        ordered: true,
        index: 1,
        depth: 0,
        runs: [{ text: "First", marks: [] }],
      },
      { type: "quote", runs: [{ text: "Be kind", marks: [] }] },
    ]);
  });

  it("drops scripts, styles and unknown tags but keeps their safe text", () => {
    const blocks = parseNote(
      '<p onclick="x()">Hello <span style="color:red">you</span></p>' +
        "<script>alert(1)</script><style>p{}</style><img src=x onerror=y>",
    );
    expect(blocks).toEqual([
      { type: "paragraph", runs: [{ text: "Hello you", marks: [] }] },
    ]);
  });

  it("decodes entities", () => {
    expect(noteToPlainText("<p>Tom &amp; Jerry&nbsp;&#233;&#x41;</p>")).toBe(
      "Tom & Jerry éA",
    );
  });

  it("reads legacy plain-text notes line by line", () => {
    expect(noteToPlainText("One\n\nTwo")).toBe("One\nTwo");
  });

  it("treats an empty editor as an empty note", () => {
    expect(isEmptyNote("<p></p>")).toBe(true);
    expect(isEmptyNote("<p>x</p>")).toBe(false);
  });
});
