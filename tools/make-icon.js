/* =============================================================================
   CatQuest home-screen icon generator.

       node tools/make-icon.js        →  writes icon-180.png

   This exists as a script, rather than a binary someone once made by hand,
   because the icon had to be regenerated three times and a hand-made PNG has
   no source. It draws Dex on a Greenhaven hill using nothing but Node's own
   zlib, so it needs no dependencies and no browser.

   Everything is rendered at 2x and box-downsampled, which is the cheapest
   honest anti-aliasing there is and keeps the whiskers from looking chewed.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icon-180.png');
const SIZE = 180;
const SS = 3;                      // supersample factor
const W = SIZE * SS, H = SIZE * SS;

const buf = new Float64Array(W * H * 3);   // linear-ish RGB, 0..255

/* ---------- painting helpers ------------------------------------------- */
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function px(x, y, col, alpha = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H || alpha <= 0) return;
  const i = (y * W + x) * 3;
  buf[i]     += (col[0] - buf[i])     * alpha;
  buf[i + 1] += (col[1] - buf[i + 1]) * alpha;
  buf[i + 2] += (col[2] - buf[i + 2]) * alpha;
}
// fill every pixel where test(x,y) is true, in device (supersampled) space
function fill(test, col, alpha = 1) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (test(x, y)) px(x, y, col, alpha);
}
const ellipse = (cx, cy, rx, ry) => (x, y) => {
  const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
};
// point-in-triangle by sign of cross products
function triangle(ax, ay, bx, by, cx, cy) {
  const s = (px_, py_, qx, qy, rx, ry) => (px_ - rx) * (qy - ry) - (qx - rx) * (py_ - ry);
  return (x, y) => {
    const p = x + 0.5, q = y + 0.5;
    const d1 = s(p, q, ax, ay, bx, by), d2 = s(p, q, bx, by, cx, cy), d3 = s(p, q, cx, cy, ax, ay);
    const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(neg && pos);
  };
}
// a thick line segment, used for whiskers and the mouth
function segment(x1, y1, x2, y2, w) {
  const vx = x2 - x1, vy = y2 - y1, len2 = vx * vx + vy * vy;
  return (x, y) => {
    const px_ = x + 0.5 - x1, py_ = y + 0.5 - y1;
    let t = len2 ? (px_ * vx + py_ * vy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = px_ - vx * t, dy = py_ - vy * t;
    return dx * dx + dy * dy <= (w / 2) * (w / 2);
  };
}

/* ---------- the picture -------------------------------------------------- */
const S = W;                                    // work in supersampled units
const SKY_TOP = hex('#7cc9ff'), SKY_BOT = hex('#d4efff');
for (let y = 0; y < H; y++) {
  const col = mix(SKY_TOP, SKY_BOT, y / H);
  for (let x = 0; x < W; x++) px(x, y, col, 1);
}
// sun
fill(ellipse(S * 0.80, S * 0.19, S * 0.105, S * 0.105), hex('#ffe98f'), 0.95);
fill(ellipse(S * 0.80, S * 0.19, S * 0.075, S * 0.075), hex('#fff6c8'), 1);

// hill: height per column, a shallow arc
const hillY = x => S * 0.735 - Math.sin((x / S) * Math.PI) * S * 0.10;
fill((x, y) => y >= hillY(x), hex('#4f9e63'));
fill((x, y) => y >= hillY(x) && y <= hillY(x) + S * 0.045, hex('#7ed957'));

/* ---------- Dex ---------------------------------------------------------- */
const CX = S * 0.44, CY = S * 0.485, R = S * 0.215;
const ORANGE = hex('#f0913f'), DARK = hex('#cf7128'), CREAM = hex('#ffdcb0');

// ears (outer then inner)
fill(triangle(CX - R * 0.60, CY - R * 0.70, CX - R * 0.98, CY - R * 1.44, CX - R * 1.08, CY - R * 0.40), ORANGE);
fill(triangle(CX + R * 0.60, CY - R * 0.70, CX + R * 0.98, CY - R * 1.44, CX + R * 1.08, CY - R * 0.40), ORANGE);
fill(triangle(CX - R * 0.70, CY - R * 0.76, CX - R * 0.92, CY - R * 1.22, CX - R * 0.97, CY - R * 0.62), hex('#ffb3a3'));
fill(triangle(CX + R * 0.70, CY - R * 0.76, CX + R * 0.92, CY - R * 1.22, CX + R * 0.97, CY - R * 0.62), hex('#ffb3a3'));

// head
fill(ellipse(CX, CY, R * 1.10, R * 1.00), ORANGE);
// forehead stripes
fill(ellipse(CX - R * 0.36, CY - R * 0.68, R * 0.085, R * 0.26), DARK);
fill(ellipse(CX,            CY - R * 0.76, R * 0.095, R * 0.28), DARK);
fill(ellipse(CX + R * 0.36, CY - R * 0.68, R * 0.085, R * 0.26), DARK);
// cheeks / muzzle
fill(ellipse(CX, CY + R * 0.36, R * 0.66, R * 0.44), CREAM);
// eyes
fill(ellipse(CX - R * 0.40, CY - R * 0.08, R * 0.155, R * 0.205), hex('#2b2340'));
fill(ellipse(CX + R * 0.40, CY - R * 0.08, R * 0.155, R * 0.205), hex('#2b2340'));
fill(ellipse(CX - R * 0.35, CY - R * 0.16, R * 0.060, R * 0.060), hex('#ffffff'));
fill(ellipse(CX + R * 0.45, CY - R * 0.16, R * 0.060, R * 0.060), hex('#ffffff'));
// nose and mouth
fill(triangle(CX - R * 0.13, CY + R * 0.15, CX + R * 0.13, CY + R * 0.15, CX, CY + R * 0.34), hex('#e06a7a'));
fill(segment(CX, CY + R * 0.34, CX, CY + R * 0.50, S * 0.013), hex('#8a5a3b'));
fill(segment(CX, CY + R * 0.50, CX - R * 0.28, CY + R * 0.44, S * 0.013), hex('#8a5a3b'));
fill(segment(CX, CY + R * 0.50, CX + R * 0.28, CY + R * 0.44, S * 0.013), hex('#8a5a3b'));
// whiskers
for (const s of [-1, 1]) for (const dy of [-0.12, 0.10]) {
  fill(segment(CX + s * R * 0.58, CY + R * (0.28 + dy),
               CX + s * R * 1.30, CY + R * (0.16 + dy * 1.8), S * 0.010), hex('#ffffff'), 0.92);
}

// a crystal, so the icon says "game" and not "cat photo"
const GX = S * 0.795, GY = S * 0.585, GR = S * 0.080;
fill(triangle(GX, GY - GR, GX + GR * 0.70, GY, GX, GY + GR * 1.05), hex('#f0b21f'));
fill(triangle(GX, GY - GR, GX - GR * 0.70, GY, GX, GY + GR * 1.05), hex('#ffd24d'));
fill(triangle(GX, GY - GR, GX - GR * 0.30, GY - GR * 0.15, GX, GY + GR * 0.10), hex('#fff0b8'), 0.85);

/* ---------- downsample, then encode ------------------------------------- */
const rgba = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const k = ((y * SS + j) * W + (x * SS + i)) * 3;
      r += buf[k]; g += buf[k + 1]; b += buf[k + 2];
    }
    const n = SS * SS, o = (y * SIZE + x) * 4;
    rgba[o]     = Math.max(0, Math.min(255, Math.round(r / n)));
    rgba[o + 1] = Math.max(0, Math.min(255, Math.round(g / n)));
    rgba[o + 2] = Math.max(0, Math.min(255, Math.round(b / n)));
    rgba[o + 3] = 255;
  }
}

/* minimal PNG writer: IHDR, IDAT, IEND */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return b => { let c = -1; for (const x of b) c = t[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGBA

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;                                        // filter: none
  rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(OUT, png);
console.log('wrote ' + OUT + ' (' + png.length + ' bytes, ' + SIZE + 'x' + SIZE + ')');
