/** Génère les icônes PWA localement, sans dépendance ni service externe. */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const GLYPH = [
  "01110",
  "00010",
  "01110",
  "01000",
  "01000",
  "01110",
  "00000",
  "11111",
  "00100",
  "00100",
  "00100",
  "00100",
];

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

function makeIcon(size, file) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const px = (x, y, r, g, b) => {
    const i = y * (size * 4 + 1) + 1 + x * 4;
    raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255;
  };
  const cell = Math.floor(size / 16);
  const glyphW = 5 * cell;
  const glyphH = GLYPH.length * cell;
  const ox = Math.floor((size - glyphW) / 2);
  const oy = Math.floor((size - glyphH) / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const border = x < 2 || y < 2 || x >= size - 2 || y >= size - 2;
      if (border) { px(x, y, 251, 191, 36); continue; }
      const gy = Math.floor((y - oy) / cell);
      const gx = Math.floor((x - ox) / cell);
      const white = gy >= 0 && gy < GLYPH.length && gx >= 0 && gx < 5 && GLYPH[gy][gx] === "1";
      if (white) px(x, y, 255, 255, 255);
      else {
        const grad = Math.round((y / size) * 28);
        px(x, y, 29 + grad, 61 + grad, 120 + grad);
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path.join(process.cwd(), "public", "icons", file), png);
  console.log(`Icône générée : public/icons/${file}`);
}

fs.mkdirSync(path.join(process.cwd(), "public", "icons"), { recursive: true });
makeIcon(192, "icon-192.png");
makeIcon(512, "icon-512.png");
