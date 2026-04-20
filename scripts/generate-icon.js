const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const t   = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

const SIZE = 256;
const IHDR = Buffer.from([
  0, 0, 1, 0,  0, 0, 1, 0,   // width=256, height=256
  8, 6,                        // bit depth=8, color type=6 (RGBA)
  0, 0, 0                      // compression, filter, interlace
]);

// Build pixel data: circular gradient, purple nebula theme
const raw = Buffer.allocUnsafe(SIZE * (1 + SIZE * 4));
let off = 0;
for (let y = 0; y < SIZE; y++) {
  raw[off++] = 0; // filter: None
  for (let x = 0; x < SIZE; x++) {
    const cx = SIZE / 2, cy = SIZE / 2;
    const r  = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    const inner = SIZE * 0.44;
    const outer = SIZE * 0.50;

    // Alpha: smooth circle edge
    let a;
    if (r < inner) a = 255;
    else if (r < outer) a = Math.round(255 * (1 - (r - inner) / (outer - inner)));
    else a = 0;

    // Radial gradient: center #c77dff → edge #2d0a6a
    const t = Math.max(0, 1 - r / (SIZE * 0.5));
    const R = Math.round(45  + t * (199 - 45));
    const G = Math.round(10  + t * (125 - 10));
    const B = Math.round(106 + t * (255 - 106));

    raw[off++] = R;
    raw[off++] = G;
    raw[off++] = B;
    raw[off++] = a;
  }
}

const idat = zlib.deflateSync(raw);
const png  = Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'),
  pngChunk('IHDR', IHDR),
  pngChunk('IDAT', idat),
  pngChunk('IEND', Buffer.alloc(0))
]);

// Wrap PNG inside an ICO container (Vista+ format)
const icoHeader = Buffer.from([
  0, 0,       // Reserved
  1, 0,       // Type: 1 = ICO
  1, 0        // Image count: 1
]);
const icoEntry = Buffer.allocUnsafe(16);
icoEntry[0] = 0;  icoEntry[1] = 0;  // Width/Height: 0 means 256
icoEntry[2] = 0;  icoEntry[3] = 0;  // ColorCount / Reserved
icoEntry.writeUInt16LE(1,  4);       // Planes
icoEntry.writeUInt16LE(32, 6);       // BitCount
icoEntry.writeUInt32LE(png.length, 8);   // BytesInRes
icoEntry.writeUInt32LE(22, 12);      // ImageOffset (6 + 16)

const buildDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(buildDir, { recursive: true });
fs.writeFileSync(path.join(buildDir, 'icon.png'), png);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), Buffer.concat([icoHeader, icoEntry, png]));
console.log('Icons generated in build/');
