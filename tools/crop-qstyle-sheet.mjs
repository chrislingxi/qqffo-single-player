import { readFile, mkdir, writeFile } from "node:fs/promises";
import { deflateSync, inflateSync } from "node:zlib";

const source = "assets/game/qstyle/ai/qqffo-qstyle-concept-sheet-v1.png";
const outDir = "assets/game/qstyle/ai/sprites";

const targets = {
  character_swordsman: [0, 0, 360, 505],
  character_warrior: [345, 0, 705, 505],
  character_assassin: [700, 0, 1035, 505],
  character_medic: [1010, 0, 1348, 505],
  character_mage: [1325, 0, 1717, 505],
  fenfen_rabbit: [0, 485, 340, 916],
  snail: [330, 485, 675, 916],
  man_eater_flower: [680, 485, 1075, 916],
  boar: [1065, 485, 1405, 916],
  ghost_fire: [1410, 485, 1717, 916]
};

const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuf = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuf.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length);
  return out;
}

function readPng(buffer) {
  if (!buffer.subarray(0, 8).equals(pngSig)) throw new Error("Not a PNG file");
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buffer.length) {
    const len = buffer.readUInt32BE(pos);
    const type = buffer.subarray(pos + 4, pos + 8).toString("ascii");
    const data = buffer.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
      if (data[8] !== 8 || ![2, 6].includes(colorType)) throw new Error("Only 8-bit RGB/RGBA PNG is supported");
    }
    if (type === "IDAT") idat.push(data);
    if (type === "IEND") break;
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(width * height * 4);
  let rawPos = 0;
  const prev = Buffer.alloc(stride);
  let scan = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawPos++];
    const line = Buffer.from(raw.subarray(rawPos, rawPos + stride));
    rawPos += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? line[x - channels] : 0;
      const up = prev[x] || 0;
      const upLeft = x >= channels ? prev[x - channels] : 0;
      if (filter === 1) line[x] = (line[x] + left) & 255;
      if (filter === 2) line[x] = (line[x] + up) & 255;
      if (filter === 3) line[x] = (line[x] + Math.floor((left + up) / 2)) & 255;
      if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255;
      }
    }
    for (let x = 0; x < width; x += 1) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      pixels[dst] = line[src];
      pixels[dst + 1] = line[src + 1];
      pixels[dst + 2] = line[src + 2];
      pixels[dst + 3] = channels === 4 ? line[src + 3] : 255;
    }
    [scan, prev].forEach(() => {});
    scan = line;
    scan.copy(prev);
  }
  return { width, height, pixels };
}

function writePng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = width * 4 + 1;
  const raw = Buffer.alloc(row * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * row] = 0;
    pixels.copy(raw, y * row + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([pngSig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND")]);
}

function cropAndKey(image, box) {
  const [left, top, right, bottom] = box;
  const w = right - left;
  const h = bottom - top;
  const out = Buffer.alloc(w * h * 4);
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const src = ((top + y) * image.width + left + x) * 4;
      const dst = (y * w + x) * 4;
      let r = image.pixels[src];
      let g = image.pixels[src + 1];
      let b = image.pixels[src + 2];
      let a = 255;
      const greenScore = g - Math.max(r, b);
      if (g > 125 && greenScore > 38) {
        a = Math.max(0, Math.min(255, 255 - Math.floor((greenScore - 38) * 4.2)));
        if (a < 42) a = 0;
        g = Math.min(g, 172);
        r = Math.min(255, r + 8);
        b = Math.min(255, b + 8);
      }
      out[dst] = r;
      out[dst + 1] = g;
      out[dst + 2] = b;
      out[dst + 3] = a;
      if (a > 24) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const pad = 10;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const tightW = maxX - minX + 1;
  const tightH = maxY - minY + 1;
  const tight = Buffer.alloc(tightW * tightH * 4);
  for (let y = 0; y < tightH; y += 1) {
    out.copy(tight, y * tightW * 4, ((minY + y) * w + minX) * 4, ((minY + y) * w + minX + tightW) * 4);
  }
  return { width: tightW, height: tightH, pixels: tight };
}

await mkdir(outDir, { recursive: true });
const image = readPng(await readFile(source));
for (const [name, box] of Object.entries(targets)) {
  const sprite = cropAndKey(image, box);
  await writeFile(`${outDir}/${name}.png`, writePng(sprite.width, sprite.height, sprite.pixels));
  console.log(`${name}: ${sprite.width}x${sprite.height}`);
}
