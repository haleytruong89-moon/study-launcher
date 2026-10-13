import { crc32, deflateSync } from "node:zlib";

/**
 * Builds a valid RGB PNG of the given size (a simple two-colour pattern), so the e2e test can
 * upload a "phone photo" larger than 1600 px and check that the browser shrinks it.
 */
export function makePng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const row = Buffer.alloc(1 + width * 3);
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y++) {
    row[0] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const dark = (x >> 6) % 2 === (y >> 6) % 2;
      row[1 + x * 3] = dark ? 43 : 244;
      row[2 + x * 3] = dark ? 93 : 245;
      row[3 + x * 3] = dark ? 79 : 240;
    }
    row.copy(raw, y * row.length);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
