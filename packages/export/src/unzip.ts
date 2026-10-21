export interface ZipEntry {
  name: string;
  method: number;
  size: number;
  compressedSize: number;
  crc: number;
  localOffset: number;
}

export type ReadRange = (offset: number, length: number) => Uint8Array;

const LIMIT32 = 0xffffffff;
const LIMIT16 = 0xffff;

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function u64(data: DataView, at: number): number {
  return data.getUint32(at, true) + data.getUint32(at + 4, true) * 2 ** 32;
}

export class NotAZipError extends Error {}

export function readZipEntries(read: ReadRange, size: number): ZipEntry[] {
  const tailLength = Math.min(size, 65_557);
  const tail = read(size - tailLength, tailLength);
  const tailView = view(tail);
  let eocd = -1;
  for (let at = tail.length - 22; at >= 0; at--) {
    if (tailView.getUint32(at, true) === 0x06054b50) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) throw new NotAZipError("End of central directory not found");

  let count = tailView.getUint16(eocd + 10, true);
  let centralSize = tailView.getUint32(eocd + 12, true);
  let centralStart = tailView.getUint32(eocd + 16, true);
  if (
    count === LIMIT16 ||
    centralSize === LIMIT32 ||
    centralStart === LIMIT32
  ) {
    const locatorAt = eocd - 20;
    if (locatorAt < 0 || tailView.getUint32(locatorAt, true) !== 0x07064b50) {
      throw new NotAZipError("ZIP64 locator not found");
    }
    const recordStart = u64(tailView, locatorAt + 8);
    const record = view(read(recordStart, 56));
    if (record.getUint32(0, true) !== 0x06064b50) {
      throw new NotAZipError("ZIP64 end record not found");
    }
    count = u64(record, 32);
    centralSize = u64(record, 40);
    centralStart = u64(record, 48);
  }

  const central = read(centralStart, centralSize);
  const data = view(central);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let at = 0;
  for (let i = 0; i < count; i++) {
    if (data.getUint32(at, true) !== 0x02014b50) {
      throw new NotAZipError("Corrupted central directory");
    }
    const method = data.getUint16(at + 10, true);
    const crc = data.getUint32(at + 16, true);
    let compressedSize = data.getUint32(at + 20, true);
    let entrySize = data.getUint32(at + 24, true);
    const nameLength = data.getUint16(at + 28, true);
    const extraLength = data.getUint16(at + 30, true);
    const commentLength = data.getUint16(at + 32, true);
    let localOffset = data.getUint32(at + 42, true);
    const name = decoder.decode(
      central.subarray(at + 46, at + 46 + nameLength),
    );
    let extraAt = at + 46 + nameLength;
    const extraEnd = extraAt + extraLength;
    while (extraAt + 4 <= extraEnd) {
      const id = data.getUint16(extraAt, true);
      const length = data.getUint16(extraAt + 2, true);
      if (id === 0x0001) {
        let field = extraAt + 4;
        if (entrySize === LIMIT32) {
          entrySize = u64(data, field);
          field += 8;
        }
        if (compressedSize === LIMIT32) {
          compressedSize = u64(data, field);
          field += 8;
        }
        if (localOffset === LIMIT32) localOffset = u64(data, field);
      }
      extraAt += 4 + length;
    }
    entries.push({
      name,
      method,
      size: entrySize,
      compressedSize,
      crc,
      localOffset,
    });
    at = extraEnd + commentLength;
  }
  return entries;
}

export function entryDataStart(read: ReadRange, entry: ZipEntry): number {
  const header = view(read(entry.localOffset, 30));
  if (header.getUint32(0, true) !== 0x04034b50) {
    throw new NotAZipError(`Local header missing for ${entry.name}`);
  }
  return (
    entry.localOffset +
    30 +
    header.getUint16(26, true) +
    header.getUint16(28, true)
  );
}

export function readStoredText(read: ReadRange, entry: ZipEntry): string {
  if (entry.method !== 0) {
    throw new NotAZipError(`${entry.name} is compressed`);
  }
  return new TextDecoder().decode(
    read(entryDataStart(read, entry), entry.size),
  );
}
