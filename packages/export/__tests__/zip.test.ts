import { describe, expect, it } from "vitest";

import { Crc32, ZipBuilder } from "../src/zip";

const text = (value: string) => new TextEncoder().encode(value);

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function readZip(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const files: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(at + 46, at + 46 + nameLength),
    );
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const start =
      local +
      30 +
      view.getUint16(local + 26, true) +
      view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    expect(new Crc32().update(data).digest()).toBe(crc);
    files[name] = new TextDecoder().decode(data);
    at += 46 + nameLength + extraLength;
  }
  return files;
}

describe("Crc32", () => {
  it("matches the standard check value", () => {
    expect(new Crc32().update(text("123456789")).digest()).toBe(0xcbf43926);
  });

  it("is the same in one go or in chunks", () => {
    const whole = new Crc32().update(text("hello world")).digest();
    const parts = new Crc32()
      .update(text("hello "))
      .update(text("world"))
      .digest();
    expect(parts).toBe(whole);
  });
});

describe("ZipBuilder", () => {
  it("writes an archive another reader can open", () => {
    const zip = new ZipBuilder();
    const when = new Date(2026, 9, 21, 12, 30, 10);
    const body = text("streamed body");
    const archive = concat([
      zip.file("README.txt", text("hello"), when),
      zip.file("notes/Café é.html", text("<p>hi</p>"), when),
      zip.start(
        "files/doc.txt",
        body.length,
        new Crc32().update(body).digest(),
        when,
      ),
      (() => {
        zip.data(body.length);
        zip.end();
        return body;
      })(),
      zip.finish(),
    ]);
    expect(readZip(archive)).toEqual({
      "README.txt": "hello",
      "notes/Café é.html": "<p>hi</p>",
      "files/doc.txt": "streamed body",
    });
  });

  it("refuses an entry whose data does not match its size", () => {
    const zip = new ZipBuilder();
    zip.start("a.txt", 10, 0, new Date());
    zip.data(4);
    expect(() => zip.end()).toThrow("size mismatch");
  });

  it("switches to ZIP64 for files of 4 GB and more", () => {
    const zip = new ZipBuilder();
    const size = 5 * 2 ** 30;
    const header = zip.start("big.mp4", size, 1234, new Date());
    const view = new DataView(header.buffer);
    expect(view.getUint16(4, true)).toBe(45);
    expect(view.getUint32(18, true)).toBe(0xffffffff);
    expect(view.getUint16(header.length - 20, true)).toBe(0x0001);
    zip.data(size);
    zip.end();
    zip.file("after.txt", text("x"), new Date());
    const tail = zip.finish();
    const tailView = new DataView(tail.buffer);
    const eocd = tail.length - 22;
    expect(tailView.getUint32(eocd, true)).toBe(0x06054b50);
    expect(tailView.getUint32(eocd + 16, true)).toBe(0xffffffff);
    expect(tailView.getUint32(eocd - 20, true)).toBe(0x07064b50);
  });
});
