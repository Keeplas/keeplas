export type Mark = "bold" | "italic" | "underline" | "strike" | "code";

export interface Run {
  text: string;
  marks: Mark[];
}

export type Block =
  | { type: "paragraph"; runs: Run[] }
  | { type: "heading"; level: number; runs: Run[] }
  | { type: "quote"; runs: Run[] }
  | {
      type: "item";
      ordered: boolean;
      index: number;
      depth: number;
      runs: Run[];
    };

const MARK_TAGS: Record<string, Mark> = {
  b: "bold",
  strong: "bold",
  i: "italic",
  em: "italic",
  u: "underline",
  s: "strike",
  del: "strike",
  strike: "strike",
  code: "code",
};

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "blockquote",
  "pre",
]);

const DROPPED =
  /<(script|style|head|title|template|iframe|object|svg)\b[\s\S]*?<\/\1\s*>/gi;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (entity, code: string) => {
    if (code[0] === "#") {
      const point =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    }
    return ENTITIES[code.toLowerCase()] ?? entity;
  });
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const looksLikeHtml = (text: string) =>
  /<\/?(p|div|br|h[1-6]|ul|ol|li|strong|b|em|i|u|s|blockquote|code|pre|span|a)\b[^>]*>/i.test(
    text,
  );

export function noteToHtml(note: string): string {
  const trimmed = note.trim();
  if (!trimmed) return "";
  if (looksLikeHtml(trimmed)) return isEmptyNote(trimmed) ? "" : trimmed;
  return trimmed
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : "<p></p>"))
    .join("");
}

export function noteToPlainText(note: string): string {
  return parseNote(note)
    .map((block) => block.runs.map((run) => run.text).join(""))
    .join("\n")
    .trim();
}

export const isEmptyNote = (note: string) => noteToPlainText(note) === "";

export function parseNote(note: string): Block[] {
  if (!looksLikeHtml(note)) {
    return note
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => ({
        type: "paragraph",
        runs: [{ text: line, marks: [] }],
      }));
  }

  const blocks: Block[] = [];
  const marks: Mark[] = [];
  const lists: { ordered: boolean; count: number }[] = [];
  let current = null as Block | null;
  let quote = 0;

  const open = (tag: string) => {
    if (tag === "li") {
      const list = lists[lists.length - 1] ?? { ordered: false, count: 0 };
      list.count += 1;
      current = {
        type: "item",
        ordered: list.ordered,
        index: list.count,
        depth: Math.max(0, lists.length - 1),
        runs: [],
      };
    } else if (/^h[1-6]$/.test(tag)) {
      current = { type: "heading", level: Number(tag[1]), runs: [] };
    } else if (current?.type === "item" && current.runs.length === 0) {
      return;
    } else {
      current =
        quote > 0
          ? { type: "quote", runs: [] }
          : { type: "paragraph", runs: [] };
    }
    blocks.push(current);
  };

  const append = (text: string) => {
    if (!text) return;
    if (!current) open("p");
    const runs = current!.runs;
    const last = runs[runs.length - 1];
    if (last && last.marks.join() === marks.join()) last.text += text;
    else runs.push({ text, marks: [...marks] });
  };

  const html = note.replace(DROPPED, "").replace(/<!--[\s\S]*?-->/g, "");
  const tokens = html.match(/<[^>]*>|[^<]+/g) ?? [];
  for (const token of tokens) {
    if (token[0] !== "<") {
      append(decodeEntities(token.replace(/\s+/g, " ")));
      continue;
    }
    const match = /^<\s*(\/)?\s*([a-z0-9]+)/i.exec(token);
    if (!match) continue;
    const closing = Boolean(match[1]);
    const tag = match[2].toLowerCase();
    if (tag === "br") {
      append("\n");
    } else if (tag === "ul" || tag === "ol") {
      if (closing) lists.pop();
      else lists.push({ ordered: tag === "ol", count: 0 });
      current = null;
    } else if (tag === "blockquote") {
      quote += closing ? -1 : 1;
      current = null;
    } else if (BLOCK_TAGS.has(tag)) {
      if (closing) {
        if (tag !== "p" || current?.type !== "item") current = null;
      } else {
        open(tag);
      }
    } else if (MARK_TAGS[tag]) {
      const mark = MARK_TAGS[tag];
      if (closing) {
        const at = marks.lastIndexOf(mark);
        if (at >= 0) marks.splice(at, 1);
      } else if (!/\/\s*>$/.test(token)) {
        marks.push(mark);
      }
    }
  }

  return blocks
    .map((block) => ({
      ...block,
      runs: block.runs
        .map((run, index, all) => ({
          ...run,
          text:
            index === 0
              ? run.text.replace(/^ +/, "")
              : index === all.length - 1
                ? run.text.replace(/ +$/, "")
                : run.text,
        }))
        .filter((run) => run.text),
    }))
    .filter((block) => block.runs.length > 0);
}
