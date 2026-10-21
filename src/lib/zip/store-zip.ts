/**
 * Minimal ZIP writer (store method, no compression) — zero dependencies.
 * DOCX payloads are already deflate-compressed internally, so store-only
 * keeps this simple and correct for an application-kit bundle.
 */

export type ZipEntry = { name: string; data: Buffer };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff, 0);
  return b;
}
function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

/** Build a ZIP archive containing the given entries (store method). */
export function createZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = Buffer.concat([
      u32(0x04034b50), // local file header signature
      u16(20), // version needed
      u16(0x0800), // flags: UTF-8 names
      u16(0), // method: store
      u16(0), // mod time
      u16(0), // mod date
      u32(crc),
      u32(size), // compressed size
      u32(size), // uncompressed size
      u16(name.length),
      u16(0), // extra length
      name,
      entry.data,
    ]);
    locals.push(local);

    const central = Buffer.concat([
      u32(0x02014b50), // central directory signature
      u16(20), // version made by
      u16(20), // version needed
      u16(0x0800), // flags
      u16(0), // method
      u16(0), // time
      u16(0), // date
      u32(crc),
      u32(size),
      u32(size),
      u16(name.length),
      u16(0), // extra length
      u16(0), // comment length
      u16(0), // disk number start
      u16(0), // internal attrs
      u32(0), // external attrs
      u32(offset), // local header offset
      name,
    ]);
    centrals.push(central);
    offset += local.length;
  }

  const centralBytes = Buffer.concat(centrals);
  const eocd = Buffer.concat([
    u32(0x06054b50), // end of central directory
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralBytes.length),
    u32(offset),
    u16(0),
  ]);

  return Buffer.concat([...locals, centralBytes, eocd]);
}
