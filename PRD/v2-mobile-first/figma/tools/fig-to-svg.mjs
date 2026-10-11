// Extracts every `Illustration/*` and `Logo/*` component from a Figma .fig export as a standalone SVG.
// Exists because the Figma REST image export is quota-limited on the Starter plan.
//
// Usage (needs `unzip` on PATH):
//   npm i --no-save kiwi-schema fzstd pako
//   node fig-to-svg.mjs ../source/keeplas-app-design.fig ../svg
//
// Supports solid / linear / radial fills, outlined strokes, frame clipping, opacity and nested instances.
// Not supported: effects (blur, shadow), blend modes, masks, image fills (none are used in these components).
import { execFileSync } from "child_process";
import fs from "fs";
import * as kiwi from "kiwi-schema";
import * as pako from "pako";
import { decompress } from "fzstd";

const [figPath, outDir = "svg-out"] = process.argv.slice(2);
if (!figPath) {
  console.error("usage: node fig-to-svg.mjs <file.fig> [outDir]");
  process.exit(1);
}

// A .fig is a zip; canvas.fig inside is "fig-kiwi" + u32 version + [u32 length, chunk]*.
// Chunk 0 is the compressed Kiwi schema, chunk 1 the compressed document message.
const canvas = execFileSync("unzip", ["-p", figPath, "canvas.fig"], {
  maxBuffer: 1 << 28,
});
const view = new DataView(canvas.buffer, canvas.byteOffset, canvas.byteLength);
const chunks = [];
for (let off = 12; off < canvas.length;) {
  const len = view.getUint32(off, true);
  chunks.push(canvas.subarray(off + 4, off + 4 + len));
  off += 4 + len;
}
const inflate = (c) => {
  if (c[0] === 0x28 && c[1] === 0xb5) return decompress(c); // zstd magic
  try {
    return pako.inflateRaw(c);
  } catch {
    return pako.inflate(c);
  }
};
const schema = kiwi.compileSchema(kiwi.decodeBinarySchema(inflate(chunks[0])));
const { nodeChanges: nodes, blobs } = schema.decodeMessage(inflate(chunks[1]));

const key = (g) => `${g.sessionID}:${g.localID}`;
const byId = new Map(nodes.map((n) => [key(n.guid), n]));
const children = new Map();
for (const n of nodes) {
  if (!n.parentIndex) continue;
  const p = key(n.parentIndex.guid);
  if (!children.has(p)) children.set(p, []);
  children.get(p).push(n);
}
for (const list of children.values())
  list.sort((a, b) =>
    a.parentIndex.position < b.parentIndex.position ? -1 : 1,
  );

const num = (x) => +x.toFixed(3);
const hex = (c) =>
  "#" +
  [c.r, c.g, c.b]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const matrix = (t) =>
  t ? [t.m00, t.m10, t.m01, t.m11, t.m02, t.m12] : [1, 0, 0, 1, 0, 0];
const invert = ([a, b, c, d, e, f]) => {
  const det = a * d - b * c;
  return [
    d / det,
    -b / det,
    -c / det,
    a / det,
    (c * f - d * e) / det,
    (b * e - a * f) / det,
  ];
};
const multiply = ([a, b, c, d, e, f], [A, B, C, D, E, F]) => [
  a * A + c * B,
  b * A + d * B,
  a * C + c * D,
  b * C + d * D,
  a * E + c * F + e,
  b * E + d * F + f,
];

// Geometry blobs: opcode byte followed by float32 LE coordinates.
function pathFromBlob(index) {
  const b = Buffer.from(blobs[index].bytes);
  const d = [];
  let o = 0;
  const r = () => {
    const v = b.readFloatLE(o);
    o += 4;
    return num(v);
  };
  while (o < b.length) {
    const op = b[o++];
    if (op === 0) d.push("Z");
    else if (op === 1) d.push(`M${r()} ${r()}`);
    else if (op === 2) d.push(`L${r()} ${r()}`);
    else if (op === 3) d.push(`Q${r()} ${r()} ${r()} ${r()}`);
    else if (op === 4) d.push(`C${r()} ${r()} ${r()} ${r()} ${r()} ${r()}`);
    else throw new Error(`Unknown path opcode ${op}`);
  }
  return d.join("");
}

let defs = [];
let nextId = 0;

function paint(p, size) {
  if (p.visible === false) return null;
  const opacity = p.opacity ?? 1;
  if (p.type === "SOLID")
    return { fill: hex(p.color), opacity: opacity * (p.color.a ?? 1) };
  if (p.type === "GRADIENT_LINEAR" || p.type === "GRADIENT_RADIAL") {
    const id = `g${nextId++}`;
    const stops = p.stops
      .map(
        (s) =>
          `<stop offset="${num(s.position)}" stop-color="${hex(s.color)}" stop-opacity="${num(s.color.a)}"/>`,
      )
      .join("");
    // Paint transforms map node-normalized space to gradient space; invert and scale to node pixels.
    const t = multiply(
      [size.x, 0, 0, size.y, 0, 0],
      invert(matrix(p.transform)),
    );
    const attrs = `gradientTransform="matrix(${t.map(num).join(" ")})" gradientUnits="userSpaceOnUse"`;
    defs.push(
      p.type === "GRADIENT_LINEAR"
        ? `<linearGradient id="${id}" x1="0" y1="0.5" x2="1" y2="0.5" ${attrs}>${stops}</linearGradient>`
        : `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5" ${attrs}>${stops}</radialGradient>`,
    );
    return { fill: `url(#${id})`, opacity };
  }
  return null;
}

const fillAttrs = (p) =>
  `fill="${p.fill}"${p.opacity < 1 ? ` fill-opacity="${num(p.opacity)}"` : ""}`;

function frameBackground(n, size) {
  return (n.fillPaints || [])
    .map((p) => paint(p, size))
    .filter(Boolean)
    .map(
      (p) =>
        `<rect width="${num(size.x)}" height="${num(size.y)}" rx="${num(n.cornerRadius || 0)}" ${fillAttrs(p)}/>`,
    )
    .join("");
}

function render(n) {
  if (n.visible === false) return "";
  const size = n.size;
  const isFrame =
    n.type === "FRAME" || n.type === "SYMBOL" || n.type === "INSTANCE";
  let out = isFrame && !n.fillGeometry ? frameBackground(n, size) : "";

  for (const [geometry, paints] of [
    [n.fillGeometry, n.fillPaints],
    [n.strokeGeometry, n.strokePaints],
  ]) {
    for (const g of geometry || []) {
      const d = pathFromBlob(g.commandsBlob);
      for (const p of (paints || []).map((x) => paint(x, size)).filter(Boolean))
        out += `<path d="${d}" ${fillAttrs(p)}${g.windingRule === "ODD" ? ' fill-rule="evenodd"' : ""}/>`;
    }
  }

  let inner;
  if (n.type === "INSTANCE") {
    const symbol = byId.get(key(n.symbolData.symbolID));
    const sx = size.x / symbol.size.x;
    const sy = size.y / symbol.size.y;
    inner = `<g transform="scale(${num(sx)} ${num(sy)})">${(children.get(key(symbol.guid)) || []).map(render).join("")}</g>`;
  } else {
    inner = (children.get(key(n.guid)) || []).map(render).join("");
  }
  if (isFrame && n.frameMaskDisabled !== true && inner) {
    const id = `c${nextId++}`;
    defs.push(
      `<clipPath id="${id}"><rect width="${num(size.x)}" height="${num(size.y)}" rx="${num(n.cornerRadius || 0)}"/></clipPath>`,
    );
    inner = `<g clip-path="url(#${id})">${inner}</g>`;
  }
  const opacity = n.opacity ?? 1;
  return `<g transform="matrix(${matrix(n.transform).map(num).join(" ")})"${opacity < 1 ? ` opacity="${num(opacity)}"` : ""}>${out}${inner}</g>`;
}

function toSvg(symbol) {
  defs = [];
  nextId = 0;
  const { x: w, y: h } = symbol.size;
  const body = (children.get(key(symbol.guid)) || []).map(render).join("");
  const background = frameBackground(symbol, symbol.size);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${num(w)}" height="${num(h)}" viewBox="0 0 ${num(w)} ${num(h)}" fill="none">${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${background}${body}</svg>`;
}

for (const symbol of nodes.filter(
  (n) => n.type === "SYMBOL" && /^(Illustration|Logo)\//.test(n.name),
)) {
  const rel = symbol.name
    .replace(/^Illustration\//, "illustrations/")
    .replace(/^Logo\//, "logo/")
    .toLowerCase()
    .replace(/ /g, "-");
  const file = `${outDir}/${rel}.svg`;
  fs.mkdirSync(file.slice(0, file.lastIndexOf("/")), { recursive: true });
  fs.writeFileSync(file, toSvg(symbol));
  console.log(file);
}
