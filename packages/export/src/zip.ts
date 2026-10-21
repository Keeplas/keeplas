const LIMIT32 = 0xffffffff;
const LIMIT16 = 0xffff;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export class Crc32 {
  private crc = 0xffffffff;

  update(bytes: Uint8Array): this {
    let crc = this.crc;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    this.crc = crc;
    return this;
  }

  digest(): number {
    return (this.crc ^ 0xffffffff) >>> 0;
  }
}

class Bytes {
  private parts: number[] = [];

  u16(value: number): this {
    this.parts.push(value & 0xff, (value >>> 8) & 0xff);
    return this;
  }

  u32(value: number): this {
    this.parts.push(
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    );
    return this;
  }

  u64(value: number): this {
    return this.u32(value % 2 ** 32).u32(Math.floor(value / 2 ** 32));
  }

  raw(bytes: Uint8Array): this {
    for (const byte of bytes) this.parts.push(byte);
    return this;
  }

  get length(): number {
    return this.parts.length;
  }

  done(): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(this.parts);
  }
}

function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

interface Entry {
  name: Uint8Array;
  size: number;
  crc: number;
  offset: number;
  time: number;
  day: number;
}

export class ZipBuilder {
  private entries: Entry[] = [];
  private offset = 0;
  private open: { entry: Entry; written: number } | null = null;

  start(
    path: string,
    size: number,
    crc: number,
    modified: Date,
  ): Uint8Array<ArrayBuffer> {
    if (this.open)
      throw new Error(`Entry ${this.open.entry.name} not finished`);
    const name = new TextEncoder().encode(path);
    const { time, day } = dosDateTime(modified);
    const entry: Entry = { name, size, crc, offset: this.offset, time, day };
    const big = size >= LIMIT32;
    const header = new Bytes()
      .u32(0x04034b50)
      .u16(big ? 45 : 20)
      .u16(0x0800)
      .u16(0)
      .u16(time)
      .u16(day)
      .u32(crc)
      .u32(big ? LIMIT32 : size)
      .u32(big ? LIMIT32 : size)
      .u16(name.length)
      .u16(big ? 20 : 0)
      .raw(name);
    if (big) header.u16(0x0001).u16(16).u64(size).u64(size);
    this.entries.push(entry);
    this.open = { entry, written: 0 };
    this.offset += header.length;
    return header.done();
  }

  data(length: number): void {
    if (!this.open) throw new Error("No entry started");
    this.open.written += length;
    this.offset += length;
  }

  end(): void {
    if (!this.open) throw new Error("No entry started");
    const { entry, written } = this.open;
    if (written !== entry.size) {
      throw new Error(`Entry size mismatch: ${written} of ${entry.size}`);
    }
    this.open = null;
  }

  file(
    path: string,
    bytes: Uint8Array,
    modified: Date,
  ): Uint8Array<ArrayBuffer> {
    const header = this.start(
      path,
      bytes.length,
      new Crc32().update(bytes).digest(),
      modified,
    );
    this.data(bytes.length);
    this.end();
    const out = new Uint8Array(header.length + bytes.length);
    out.set(header);
    out.set(bytes, header.length);
    return out;
  }

  finish(): Uint8Array<ArrayBuffer> {
    if (this.open) throw new Error("Last entry not finished");
    const central = new Bytes();
    for (const entry of this.entries) {
      const bigSize = entry.size >= LIMIT32;
      const bigOffset = entry.offset >= LIMIT32;
      const extra = (bigSize ? 16 : 0) + (bigOffset ? 8 : 0);
      central
        .u32(0x02014b50)
        .u16(0x0300 | 45)
        .u16(extra ? 45 : 20)
        .u16(0x0800)
        .u16(0)
        .u16(entry.time)
        .u16(entry.day)
        .u32(entry.crc)
        .u32(bigSize ? LIMIT32 : entry.size)
        .u32(bigSize ? LIMIT32 : entry.size)
        .u16(entry.name.length)
        .u16(extra ? extra + 4 : 0)
        .u16(0)
        .u16(0)
        .u16(0)
        .u32((0o100644 << 16) >>> 0)
        .u32(bigOffset ? LIMIT32 : entry.offset)
        .raw(entry.name);
      if (extra) {
        central.u16(0x0001).u16(extra);
        if (bigSize) central.u64(entry.size).u64(entry.size);
        if (bigOffset) central.u64(entry.offset);
      }
    }
    const centralStart = this.offset;
    const centralSize = central.length;
    const count = this.entries.length;
    const tail = new Bytes();
    const zip64 =
      count >= LIMIT16 || centralStart >= LIMIT32 || centralSize >= LIMIT32;
    if (zip64) {
      const recordStart = centralStart + centralSize;
      tail
        .u32(0x06064b50)
        .u64(44)
        .u16(45)
        .u16(45)
        .u32(0)
        .u32(0)
        .u64(count)
        .u64(count)
        .u64(centralSize)
        .u64(centralStart)
        .u32(0x07064b50)
        .u32(0)
        .u64(recordStart)
        .u32(1);
    }
    tail
      .u32(0x06054b50)
      .u16(0)
      .u16(0)
      .u16(zip64 ? LIMIT16 : count)
      .u16(zip64 ? LIMIT16 : count)
      .u32(zip64 ? LIMIT32 : centralSize)
      .u32(zip64 ? LIMIT32 : centralStart)
      .u16(0);
    const centralBytes = central.done();
    const tailBytes = tail.done();
    const out = new Uint8Array(centralBytes.length + tailBytes.length);
    out.set(centralBytes);
    out.set(tailBytes, centralBytes.length);
    this.offset += out.length;
    return out;
  }
}
