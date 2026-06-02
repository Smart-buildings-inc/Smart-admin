// Minimal, dependency-free ZIP writer (STORE / no compression).
//
// We ship the brand kit as a real .zip without pulling in a packaging library:
// the format is simple enough to emit directly. Entries are stored uncompressed
// (method 0), which keeps the code small and the output universally readable.
// Good enough for a handful of SVG/CSS/JSON/MD files — total size is tiny.

type ZipEntry = { name: string; data: Uint8Array };

const textEncoder = new TextEncoder();

// CRC-32 (IEEE 802.3) with a lazily-built lookup table.
let crcTable: Uint32Array | null = null;
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// DOS date/time (we just stamp a fixed, valid value — content, not timestamps,
// is what matters for a brand kit).
const DOS_TIME = 0;
const DOS_DATE = 0x21; // 1980-01-01

/**
 * Build a ZIP archive from named text/binary entries.
 * Accepts strings (UTF-8 encoded) or raw Uint8Array data.
 */
export function createZip(
  files: Array<{ name: string; data: string | Uint8Array }>,
): Uint8Array {
  const entries: ZipEntry[] = files.map((f) => ({
    name: f.name,
    data: typeof f.data === "string" ? textEncoder.encode(f.data) : f.data,
  }));

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Local file header (30 bytes + name).
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // signature
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0, true); // flags
    local.setUint16(8, 0, true); // method = store
    local.setUint16(10, DOS_TIME, true);
    local.setUint16(12, DOS_DATE, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true); // compressed size
    local.setUint32(22, size, true); // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true); // extra length

    localParts.push(new Uint8Array(local.buffer), nameBytes, entry.data);

    // Central directory record (46 bytes + name).
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true); // signature
    central.setUint16(4, 20, true); // version made by
    central.setUint16(6, 20, true); // version needed
    central.setUint16(8, 0, true); // flags
    central.setUint16(10, 0, true); // method
    central.setUint16(12, DOS_TIME, true);
    central.setUint16(14, DOS_DATE, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint16(30, 0, true); // extra length
    central.setUint16(32, 0, true); // comment length
    central.setUint16(34, 0, true); // disk number
    central.setUint16(36, 0, true); // internal attrs
    central.setUint32(38, 0, true); // external attrs
    central.setUint32(42, offset, true); // local header offset

    centralParts.push(new Uint8Array(central.buffer), nameBytes);

    offset += 30 + nameBytes.length + size;
  }

  const centralSize = centralParts.reduce((n, p) => n + p.length, 0);
  const centralOffset = offset;

  // End of central directory record (22 bytes).
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // signature
  end.setUint16(4, 0, true); // disk number
  end.setUint16(6, 0, true); // central dir disk
  end.setUint16(8, entries.length, true); // entries on disk
  end.setUint16(10, entries.length, true); // total entries
  end.setUint32(12, centralSize, true);
  end.setUint32(16, centralOffset, true);
  end.setUint16(20, 0, true); // comment length

  const all = [...localParts, ...centralParts, new Uint8Array(end.buffer)];
  const total = all.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of all) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}
