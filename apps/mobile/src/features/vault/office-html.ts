const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function officePage(
  body: string,
  colors: { text: string; border: string },
) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { font-family: -apple-system, Roboto, sans-serif; color: ${colors.text}; margin: 16px; line-height: 1.5; font-size: 15px; word-wrap: break-word; }
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; margin: 0 0 20px; font-size: 13px; }
td, th { border: 1px solid ${colors.border}; padding: 4px 8px; vertical-align: top; white-space: nowrap; }
h2.sheet { font-size: 16px; margin: 20px 0 8px; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

type Mammoth = typeof import("mammoth/mammoth.browser");
type SheetJs = typeof import("xlsx");

export async function wordToHtml(
  bytes: Uint8Array,
  load: () => Promise<Mammoth> = () => import("mammoth/mammoth.browser"),
): Promise<string> {
  const mammoth = await load();
  const result = await mammoth.convertToHtml({
    arrayBuffer: toArrayBuffer(bytes),
  });
  return result.value;
}

export async function sheetToHtml(
  bytes: Uint8Array,
  load: () => Promise<SheetJs> = () => import("xlsx"),
): Promise<string> {
  const XLSX = await load();
  const workbook = XLSX.read(bytes, { type: "array" });
  return workbook.SheetNames.map((name) => {
    const table = XLSX.utils.sheet_to_html(workbook.Sheets[name], {
      header: "",
      footer: "",
    });
    return `<h2 class="sheet">${escapeHtml(name)}</h2>${table}`;
  }).join("\n");
}
