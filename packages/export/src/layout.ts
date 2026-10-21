import { noteToPlainText, parseNote, type Block, type Run } from "./rich-text";

export interface ExportFile {
  name: string;
  mimeType: string;
  size: number;
}

export interface ExportItem {
  id: string;
  title: string;
  category: string;
  folder: string | null;
  createdAt: number;
  updatedAt: number;
  note: string;
  links: string[];
  sharedWith: string[];
  files: ExportFile[];
}

export interface ExportContact {
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
}

export interface PlannedItem extends ExportItem {
  notePath: string | null;
  filePaths: string[];
}

const UNSAFE = /[\u0000-\u001f\u007f<>:"/\\|?*]+/g;

export function safeName(name: string, fallback: string): string {
  const cleaned = name
    .replace(UNSAFE, "_")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

function unique(taken: Set<string>, path: string): string {
  if (!taken.has(path.toLowerCase())) {
    taken.add(path.toLowerCase());
    return path;
  }
  const dot = path.lastIndexOf(".");
  const slash = path.lastIndexOf("/");
  const [stem, ext] =
    dot > slash + 1 ? [path.slice(0, dot), path.slice(dot)] : [path, ""];
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`;
    if (!taken.has(candidate.toLowerCase())) {
      taken.add(candidate.toLowerCase());
      return candidate;
    }
  }
}

export function planExport(
  items: ExportItem[],
  labels: { untitled: string; noFolder: string; file: string },
): PlannedItem[] {
  const folders = new Set<string>();
  const taken = new Set<string>();
  return items.map((item) => {
    const title = safeName(item.title, labels.untitled);
    const folder = safeName(item.folder ?? labels.noFolder, labels.noFolder);
    const base = item.files.length
      ? unique(folders, `files/${folder}/${title}`)
      : null;
    return {
      ...item,
      notePath: noteToPlainText(item.note)
        ? unique(taken, `notes/${title}.html`)
        : null,
      filePaths: item.files.map((file) =>
        unique(taken, `${base}/${safeName(file.name, labels.file)}`),
      ),
    };
  });
}

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const MARK_TAG = {
  bold: "strong",
  italic: "em",
  underline: "u",
  strike: "s",
  code: "code",
} as const;

function runsHtml(runs: Run[]): string {
  return runs
    .map((run) =>
      run.marks.reduce(
        (html, mark) => `<${MARK_TAG[mark]}>${html}</${MARK_TAG[mark]}>`,
        escapeHtml(run.text).replace(/\n/g, "<br>"),
      ),
    )
    .join("");
}

export function blocksHtml(blocks: Block[]): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  for (const block of blocks) {
    const wanted = block.type === "item" ? (block.ordered ? "ol" : "ul") : null;
    if (list && list !== wanted) {
      out.push(`</${list}>`);
      list = null;
    }
    if (wanted && !list) {
      out.push(`<${wanted}>`);
      list = wanted;
    }
    const inner = runsHtml(block.runs);
    if (block.type === "item") out.push(`<li>${inner}</li>`);
    else if (block.type === "heading") {
      const level = Math.min(6, Math.max(1, block.level));
      out.push(`<h${level}>${inner}</h${level}>`);
    } else if (block.type === "quote")
      out.push(`<blockquote>${inner}</blockquote>`);
    else out.push(`<p>${inner}</p>`);
  }
  if (list) out.push(`</${list}>`);
  return out.join("\n");
}

export function noteDocument(title: string, note: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.5;color:#0E2340}blockquote{border-left:3px solid #C5D7E8;margin:0;padding-left:12px;color:#5E6E83}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${blocksHtml(parseNote(note))}
</body>
</html>
`;
}

const iso = (timestamp: number) => new Date(timestamp).toISOString();

export function itemsJson(
  items: PlannedItem[],
  contacts: ExportContact[],
  exportedAt: number,
): string {
  return JSON.stringify(
    {
      format: "keeplas-export",
      version: 1,
      exportedAt: iso(exportedAt),
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        folder: item.folder,
        createdAt: iso(item.createdAt),
        updatedAt: iso(item.updatedAt),
        note: {
          html: item.note ? blocksHtml(parseNote(item.note)) : "",
          text: noteToPlainText(item.note),
          path: item.notePath,
        },
        links: item.links,
        sharedWith: item.sharedWith,
        files: item.files.map((file, index) => ({
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          path: item.filePaths[index],
        })),
      })),
      contacts,
    },
    null,
    2,
  );
}

const csvCell = (value: string) =>
  /[",\n\r;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export function itemsCsv(items: PlannedItem[]): string {
  const header = [
    "title",
    "category",
    "folder",
    "created",
    "updated",
    "note",
    "links",
    "files",
    "shared_with",
  ];
  const rows = items.map((item) => [
    item.title,
    item.category,
    item.folder ?? "",
    iso(item.createdAt),
    iso(item.updatedAt),
    noteToPlainText(item.note),
    item.links.join(" | "),
    item.filePaths.join(" | "),
    item.sharedWith.join(" | "),
  ]);
  return (
    "﻿" +
    [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}

export function readme(exportedAt: number, itemCount: number): string {
  const date = iso(exportedAt);
  return `KEEPLAS EXPORT
==============
Exported: ${date}
Items: ${itemCount}

This archive holds a full, decrypted copy of your Keeplas vault.
It is NOT encrypted: store it somewhere safe, and delete it when you no
longer need it.

  items.json    every item (title, category, folder, dates, note, files)
  items.csv     the same list for Excel, Numbers or Google Sheets
  contacts.json your trusted contacts (names and contact details only)
  notes/        each note as a web page you can open in any browser
  files/        your documents, photos, voice notes and videos, as added

-------------------------------------------------------------------------

EXPORT KEEPLAS
==============
Date de l'export : ${date}
Éléments : ${itemCount}

Cette archive contient une copie complète et déchiffrée de votre coffre
Keeplas. Elle n'est PAS chiffrée : conservez-la en lieu sûr et supprimez-la
quand vous n'en avez plus besoin.

  items.json    tous les éléments (titre, catégorie, dossier, dates, note, fichiers)
  items.csv     la même liste pour Excel, Numbers ou Google Sheets
  contacts.json vos contacts de confiance (noms et coordonnées seulement)
  notes/        chaque note sous forme de page web, lisible dans un navigateur
  files/        vos documents, photos, notes vocales et vidéos, tels qu'ajoutés
`;
}
