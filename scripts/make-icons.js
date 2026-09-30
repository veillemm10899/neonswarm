'use strict';
/* ============================================================
   NEONSWARM — make-icons.js
   Generates every brand asset from code, zero dependencies:
     favicon.ico, favicon-16/32/48.png, apple-touch-icon.png,
     icon-192.png, icon-512.png, og-image.png

   The logo is the hero ship from js/player.js: white diamond
   hull, gold core, gold fins — on the game's #0a0a16 dark with
   cyan/pink neon glows. Rerun after any rebrand:
       node scripts/make-icons.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

/* ---------- PNG encoder (RGBA8, no deps) ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; /* filter: none */
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  /* bit depth */
  ihdr[9] = 6;  /* color type: RGBA */
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- ICO wrapper (PNG payloads inside) ---------- */
function encodeICO(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); /* type: icon */
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  entries.forEach((e, i) => {
    const b = dir.subarray(i * 16, i * 16 + 16);
    b[0] = e.size >= 256 ? 0 : e.size;
    b[1] = e.size >= 256 ? 0 : e.size;
    b[2] = 0; b[3] = 0;
    b.writeUInt16LE(1, 4);   /* planes */
    b.writeUInt16LE(32, 6);  /* bpp */
    b.writeUInt32LE(e.png.length, 8);
    b.writeUInt32LE(offset, 12);
    offset += e.png.length;
  });
  return Buffer.concat([header, dir, ...entries.map(e => e.png)]);
}

/* ---------- Geometry: SDF helpers (design space 24x24, center 0,0) ---------- */
function boxSDF(px, py, cx, cy, hx, hy) {
  const dx = Math.abs(px - cx) - hx;
  const dy = Math.abs(py - cy) - hy;
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
}
/* convex polygon, winding: interior LEFT of each edge (verified vs hull points) */
function polySDF(px, py, pts) {
  let d = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const nx = b[1] - a[1], ny = -(b[0] - a[0]);
    const len = Math.hypot(nx, ny) || 1;
    d = Math.max(d, ((px - a[0]) * nx + (py - a[1]) * ny) / len);
  }
  return d;
}
/* triangle SDF via convex hull of 3 pts */
const triSDF = (px, py, a, b, c) => polySDF(px, py, [a, b, c]);

/* ---------- Brand colors ---------- */
const BG = [10, 10, 22];        /* #0a0a16 */
const WHITE = [255, 255, 255];
const HULL_SHADE = [223, 233, 255]; /* #dfe9ff */
const GOLD = [255, 210, 63];    /* #ffd23f */
const CYAN = [94, 242, 255];    /* #5ef2ff */
const PINK = [255, 79, 163];    /* #ff4fa3 */

const HULL = [[0, -12], [8, 5], [0, 11], [-8, 5]];
const FIN_L = [[-8, 4], [-12, 8], [-7, 7]];
const FIN_R = [[8, 4], [12, 8], [7, 7]];

function lerp3(c1, c2, t) {
  return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
}
function glowOver(col, px, py, cx, cy, rad, alpha, color) {
  const d = Math.hypot(px - cx, py - cy);
  if (d >= rad) return col;
  const t = 1 - d / rad;
  return lerp3(col, color, alpha * t * t);
}
function put(px, py, col, img, w) {
  if (px < 0 || py < 0 || px >= w || py >= w) return;
  const i = (py * w + px) * 4;
  img[i] = Math.max(0, Math.min(255, Math.round(col[0])));
  img[i + 1] = Math.max(0, Math.min(255, Math.round(col[1])));
  img[i + 2] = Math.max(0, Math.min(255, Math.round(col[2])));
  img[i + 3] = 255;
}

/* sample(x, y) in design space -> color */
function sampleShip(x, y) {
  let c = BG.slice();
  c = glowOver(c, x, y, -7, -8, 13, 0.20, CYAN);
  c = glowOver(c, x, y, 7, 8, 13, 0.16, PINK);
  c = glowOver(c, x, y, 0, -1, 11, 0.20, WHITE);
  /* fins behind hull */
  if (triSDF(x, y, FIN_L[0], FIN_L[1], FIN_L[2]) < 0 ||
      triSDF(x, y, FIN_R[0], FIN_R[1], FIN_R[2]) < 0) c = GOLD.slice();
  /* hull: white top, shaded bottom (matches in-game gradient) */
  if (polySDF(x, y, HULL) < 0) c = y > 2 ? HULL_SHADE.slice() : WHITE.slice();
  /* gold core */
  if (boxSDF(x, y, 0, -0.5, 2.5, 3.5) < 0) c = GOLD.slice();
  /* dark eye */
  if (boxSDF(x, y, 0, 1, 1, 1.5) < 0) c = BG.slice();
  /* glint */
  if (boxSDF(x, y, -2, -6, 1, 1) < 0) c = WHITE.slice();
  return c;
}

/* Render the ship on a size x size opaque canvas.
   fill < 1 shrinks the ship (safe zone for maskable icons); bg always fills. */
function renderIcon(size, fill) {
  const img = Buffer.alloc(size * size * 4);
  const s = (size / 24) * (fill === undefined ? 1 : fill);
  const SUB = 2, SUB2 = SUB * SUB; /* 2x2 supersampling */
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const dx = (px + (sx + 0.5) / SUB) - size / 2;
          const dy = (py + (sy + 0.5) / SUB) - size / 2;
          const c = sampleShip(dx / s, dy / s);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (py * size + px) * 4;
      img[i] = Math.round(r / SUB2);
      img[i + 1] = Math.round(g / SUB2);
      img[i + 2] = Math.round(b / SUB2);
      img[i + 3] = 255;
    }
  }
  return img;
}

/* ---------- 5x7 pixel font for the og-image title ---------- */
const FONT = {
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001']
};

/* deterministic starfield rng (mulberry32, same as the game) */
function mulberry32(seed) {
  let s = seed >>> 0;
  const f = function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.next = f;
  return f;
}

/* 1200x630 link-preview card: starfield + ship + NEONSWARM title */
function renderOG() {
  const W = 1200, H = 630;
  const img = Buffer.alloc(W * H * 4);
  const rng = mulberry32(0x5F3759DF);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c = BG.slice();
      /* corner neon glows */
      c = glowOver(c, x, y, 120, 90, 520, 0.14, CYAN);
      c = glowOver(c, x, y, W - 120, H - 90, 520, 0.12, PINK);
      /* starfield */
      put(x, y, c, img, W);
    }
  }
  /* stars on top (deterministic) */
  for (let i = 0; i < 130; i++) {
    const x = Math.floor(rng.next() * W), y = Math.floor(rng.next() * H);
    const r = rng.next() < 0.85 ? 1 : 2;
    const col = rng.pick ? null : null;
    const palette = [WHITE, CYAN, PINK, GOLD, [138, 147, 201]];
    const c = palette[Math.floor(rng.next() * palette.length)];
    const a = 0.25 + rng.next() * 0.55;
    for (let dy = 0; dy < r; dy++) for (let dx = 0; dx < r; dx++) {
      const i2 = ((y + dy) * W + (x + dx)) * 4;
      if (x + dx >= W || y + dy >= H) continue;
      img[i2] = Math.round(img[i2] + (c[0] - img[i2]) * a);
      img[i2 + 1] = Math.round(img[i2 + 1] + (c[1] - img[i2 + 1]) * a);
      img[i2 + 2] = Math.round(img[i2 + 2] + (c[2] - img[i2 + 2]) * a);
      img[i2 + 3] = 255;
    }
  }
  /* hero ship, big, slightly above center */
  const S = 300 / 24; /* ship occupies ~300px box */
  const cx0 = W / 2, cy0 = 240;
  for (let py = -160; py < 160; py++) {
    for (let px = -160; px < 160; px++) {
      const c = sampleShip(px / S, py / S);
      put(cx0 + px, cy0 + py, c, img, W);
    }
  }
  /* title: NEON (white) + SWARM (pink), 5x7 font at scale 10 */
  const word = 'NEONSWARM';
  const scale = 10, cw = 6 * scale, rows = 7;
  const totalW = (word.length * cw - scale);
  let tx = Math.round((W - totalW) / 2);
  const ty = 428;
  for (const ch of word) {
    const glyph = FONT[ch];
    const col = 'NEON'.includes(ch) && word.indexOf(ch) < 4 ? WHITE : PINK;
    void col;
    const isNeon = word.slice(0, 4) === 'NEON' ? null : null;
    void isNeon;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (glyph[gy][gx] !== '1') continue;
        const color = tx + gx * scale < (W / 2 - scale * 2) ? WHITE : PINK; /* split NEON|SWARM at center-ish */
        for (let yy = 0; yy < scale; yy++) {
          for (let xx = 0; xx < scale; xx++) {
            put(tx + gx * scale + xx, ty + gy * scale + yy, color, img, W);
          }
        }
      }
    }
    tx += cw;
  }
  /* thin neon frame */
  for (let x = 12; x < W - 12; x++) {
    put(x, 12, [CYAN[0], CYAN[1], CYAN[2], 90], img, W);
    put(x, H - 13, [PINK[0], PINK[1], PINK[2], 90], img, W);
  }
  void 0;
  /* frame corners (blocky, alpha blend manually) */
  const frame = (x0, y0, x1, y1, color, a) => {
    for (let x = x0; x <= x1; x++) {
      for (const y of [y0, y1]) {
        const i = (y * W + x) * 4;
        img[i] = Math.round(img[i] + (color[0] - img[i]) * a);
        img[i + 1] = Math.round(img[i + 1] + (color[1] - img[i + 1]) * a);
        img[i + 2] = Math.round(img[i + 2] + (color[2] - img[i + 2]) * a);
      }
    }
    for (let y = y0; y <= y1; y++) {
      for (const x of [x0, x1]) {
        const i = (y * W + x) * 4;
        img[i] = Math.round(img[i] + (color[0] - img[i]) * a);
        img[i + 1] = Math.round(img[i + 1] + (color[1] - img[i + 1]) * a);
        img[i + 2] = Math.round(img[i + 2] + (color[2] - img[i + 2]) * a);
      }
    }
  };
  frame(12, 12, W - 13, H - 13, CYAN, 0.35);
  frame(18, 18, W - 19, H - 19, PINK, 0.22);
  return img;
}
function renderOGCanvas(w, h, draw) {
  const img = Buffer.alloc(w * h * 4);
  draw((x, y, col) => put(x, y, col, img, w));
  return img;
}

/* ---------- emit everything ---------- */
const out = (name, buf) => {
  fs.writeFileSync(path.join(ROOT, name), buf);
  console.log('  wrote ' + name + '  (' + buf.length + ' bytes)');
};

console.log('NEONSWARM — generating brand assets');

for (const size of [16, 32, 48]) {
  out('favicon-' + size + '.png', encodePNG(size, size, renderIcon(size)));
}
out('favicon.ico', encodeICO([16, 32, 48].map(s => ({ size: s, png: encodePNG(s, s, renderIcon(s)) }))));
out('apple-touch-icon.png', encodePNG(180, 180, renderIcon(180, 0.92)));
out('icon-192.png', encodePNG(192, 192, renderIcon(192, 0.8)));
out('icon-512.png', encodePNG(512, 512, renderIcon(512, 0.8)));

/* og-image: custom size, so render inline (not square) */
{
  const W = 1200, H = 630;
  const img = Buffer.alloc(W * H * 4);
  const rng = mulberry32(0x5F3759DF);
  /* bg + corner glows */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c = BG.slice();
      c = glowOver(c, x, y, 120, 90, 520, 0.14, CYAN);
      c = glowOver(c, x, y, W - 120, H - 90, 520, 0.12, PINK);
      put(x, y, c, img, W);
    }
  }
  /* stars */
  const palette = [WHITE, CYAN, PINK, GOLD, [138, 147, 201]];
  for (let i = 0; i < 130; i++) {
    const x = Math.floor(rng.next() * (W - 2)), y = Math.floor(rng.next() * (H - 2));
    const r = rng.next() < 0.85 ? 1 : 2;
    const c = palette[Math.floor(rng.next() * palette.length)];
    const a = 0.25 + rng.next() * 0.55;
    for (let dy = 0; dy < r; dy++) for (let dx = 0; dx < r; dx++) {
      const j = ((y + dy) * W + (x + dx)) * 4;
      img[j] = Math.round(img[j] + (c[0] - img[j]) * a);
      img[j + 1] = Math.round(img[j + 1] + (c[1] - img[j + 1]) * a);
      img[j + 2] = Math.round(img[j + 2] + (c[2] - img[j + 2]) * a);
      img[j + 3] = 255;
    }
  }
  /* hero ship, centered, 300px box */
  const S = 300 / 24;
  const cx0 = W / 2, cy0 = 235;
  for (let py = -160; py < 160; py++) {
    for (let px = -160; px < 160; px++) {
      put(cx0 + px, cy0 + py, sampleShip(px / S, py / S), img, W);
    }
  }
  /* title: NEON white + SWARM pink */
  const word = 'NEONSWARM';
  const scale = 10, cw = 6 * scale;
  const totalW = word.length * cw - scale;
  let tx = Math.round((W - totalW) / 2);
  const ty = 428;
  for (let k = 0; k < word.length; k++) {
    const glyph = FONT[word[k]];
    const color = k < 4 ? WHITE : PINK; /* NEON | SWARM */
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (glyph[gy][gx] !== '1') continue;
        for (let yy = 0; yy < scale; yy++) {
          for (let xx = 0; xx < scale; xx++) {
            put(tx + gx * scale + xx, ty + gy * scale + yy, color, img, W);
          }
        }
      }
    }
    tx += cw;
  }
  /* neon frame */
  const frame = (x0, y0, x1, y1, color, a) => {
    for (let x = x0; x <= x1; x++) {
      for (const y of [y0, y1]) {
        const j = (y * W + x) * 4;
        img[j] = Math.round(img[j] + (color[0] - img[j]) * a);
        img[j + 1] = Math.round(img[j + 1] + (color[1] - img[j + 1]) * a);
        img[j + 2] = Math.round(img[j + 2] + (color[2] - img[j + 2]) * a);
      }
    }
    for (let y = y0; y <= y1; y++) {
      for (const x of [x0, x1]) {
        const j = (y * W + x) * 4;
        img[j] = Math.round(img[j] + (color[0] - img[j]) * a);
        img[j + 1] = Math.round(img[j + 1] + (color[1] - img[j + 1]) * a);
        img[j + 2] = Math.round(img[j + 2] + (color[2] - img[j + 2]) * a);
      }
    }
  };
  frame(12, 12, W - 13, H - 13, CYAN, 0.35);
  frame(18, 18, W - 19, H - 19, PINK, 0.22);
  out('og-image.png', encodePNG(W, H, img));
}

console.log('done.');
void renderOG; void renderOGCanvas; /* superseded by the inline og block above */
