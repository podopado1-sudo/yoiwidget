// 스프라이트 검증 시트 + favicon.svg 생성 (커밋 대상: favicon.svg)
// 실행: node tools/gen-assets.mjs
import zlib from "node:zlib";
import fs from "node:fs";
import { FRAMES, FRAMES16, SKINS } from "../engine.js";

const frames = Object.entries(FRAMES);
for (const [name, rows] of frames) {
  rows.forEach((r, i) => {
    if (r.length !== 32) { console.error(`32 ${name} row ${i}: len ${r.length}`); process.exit(1); }
  });
}
const frames16 = Object.entries(FRAMES16);
for (const [name, rows] of frames16) {
  rows.forEach((r, i) => {
    if (r.length !== 16) { console.error(`16 ${name} row ${i}: len ${r.length}`); process.exit(1); }
  });
}

function palOf(skin) {
  const p = {};
  for (const [k, v] of Object.entries(SKINS[skin])) p[k] = v;
  return p;
}

// ---- 검증 시트: 6프레임 × cheese + 스킨 4종 idle1 ----
const S = 5, GAP = 10, COL = 6;
const W = COL * (32 * S + GAP) + GAP, H = 3 * (32 * S + GAP) + GAP;
const img = Buffer.alloc(W * H * 4);
function px(x, y, hex) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  img[i] = parseInt(hex.slice(0, 2), 16);
  img[i + 1] = parseInt(hex.slice(2, 4), 16);
  img[i + 2] = parseInt(hex.slice(4, 6), 16);
  img[i + 3] = 255;
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(x, y, "fdf9f3");
function draw(rows, pal, ox, oy, s) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const c = pal[ch];
    if (!c) return;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) px(ox + x * s + dx, oy + y * s + dy, c);
  }));
}
const cheese = palOf("cheese");
frames.forEach(([name, rows], i) => draw(rows, cheese, GAP + i * (32 * S + GAP), GAP, S));
Object.keys(SKINS).forEach((skin, i) => draw(FRAMES.idle1, palOf(skin), GAP + i * (32 * S + GAP), GAP + 32 * S + GAP, S));
frames16.forEach(([name, rows], i) => draw(rows, cheese, GAP + i * (32 * S + GAP), GAP + 2 * (32 * S + GAP), S * 2));

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))
]);
const sheetPath = new URL("./frames-sheet.png", import.meta.url);
fs.writeFileSync(sheetPath, png);

// ---- favicon.svg (16×16 기본 요이 idle1, cheese) ----
const rects = FRAMES16.idle1.flatMap((row, y) =>
  [...row].map((ch, x) => cheese[ch] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="#${cheese[ch]}"/>` : "").filter(Boolean)
).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects}</svg>\n`;
fs.writeFileSync(new URL("../favicon.svg", import.meta.url), svg);

console.log("OK sheet:", png.length, "bytes; favicon.svg written");
