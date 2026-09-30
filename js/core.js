'use strict';
/* ============================================================
   NEONSWARM — core.js
   Utils, math, pre-rendered glow sprites, particle pools,
   screen shake, damage numbers, spatial hash grid.
   Performance philosophy: zero per-frame allocations in hot paths,
   pre-render expensive glow to offscreen canvases.
   ============================================================ */

window.NS = window.NS || {};

/* ---------- Deterministic RNG (mulberry32) ---------- */
NS.RNG = function (seed) {
  let s = seed >>> 0;
  this.next = function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  this.range = (a, b) => a + this.next() * (b - a);
  this.int = (a, b) => Math.floor(this.range(a, b + 1));
  this.pick = (arr) => arr[Math.floor(this.next() * arr.length)];
  this.shuff = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
};

NS.rand = new NS.RNG((Date.now() ^ 0x5f3759df) >>> 0);

/* ---------- Math ---------- */
NS.TAU = Math.PI * 2;
NS.clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
NS.lerp = (a, b, t) => a + (b - a) * t;
NS.dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
NS.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
NS.angleTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);

/* ---------- Pre-rendered glow sprite factory ----------
   The single biggest perf win: draw radial glow ONCE per (color,size),
   blit with drawImage afterwards. */
NS.Glow = {
  cache: {},
  get(color, radius) {
    const key = color + '_' + radius;
    let c = this.cache[key];
    if (c) return c;
    const size = radius * 2;
    c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(0.4, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    this.cache[key] = c;
    return c;
  },
  draw(ctx, color, x, y, radius, alpha) {
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(this.get(color, radius), x - radius, y - radius);
    if (alpha !== undefined) ctx.globalAlpha = 1;
  }
};

/* ---------- Object pool ---------- */
NS.Pool = function (factory) {
  this.factory = factory;
  this.free = [];
  this.make = () => this.free.pop() || this.factory();
  this.give = (obj) => { this.free.push(obj); };
};

/* ---------- Particles (pooled, capped) ---------- */
NS.Particles = {
  MAX: 260,
  list: [],
  pool: new NS.Pool(() => ({})),
  spawn(x, y, o) {
    if (this.list.length >= this.MAX) return;
    const p = this.pool.make();
    p.x = x; p.y = y;
    p.vx = o.vx !== undefined ? o.vx : NS.rand.range(-60, 60);
    p.vy = o.vy !== undefined ? o.vy : NS.rand.range(-60, 60);
    p.life = o.life || 0.5; p.t = 0;
    p.size = o.size || 2;
    p.color = o.color || '#fff';
    p.drag = o.drag !== undefined ? o.drag : 0.9;
    p.glow = !!o.glow;
    this.list.push(p);
  },
  burst(x, y, n, o) { for (let i = 0; i < n; i++) this.spawn(x, y, o); },
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.t += dt;
      if (p.t >= p.life) { this.pool.give(p); L[i] = L[L.length - 1]; L.pop(); continue; }
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  },
  draw(ctx, cam) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      const a = 1 - p.t / p.life;
      const x = p.x - cam.x, y = p.y - cam.y;
      if (p.glow) NS.Glow.draw(ctx, p.color, x, y, p.size * 3, a * 0.9);
      else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  },
  clear() { while (this.list.length) this.pool.give(this.list.pop()); }
};

/* ---------- Screen shake ---------- */
NS.Shake = {
  t: 0, dur: 0, power: 0,
  add(power, dur) {
    if (NS.settings && NS.settings.reducedMotion) return;
    if (power >= this.power || this.t <= 0) { this.power = power; this.dur = dur; this.t = dur; }
  },
  update(dt) { if (this.t > 0) { this.t -= dt; if (this.t <= 0) this.power = 0; } },
  offset() {
    if (this.t <= 0) return NS.SHAKE0 || (NS.SHAKE0 = { x: 0, y: 0 });
    const k = (this.t / this.dur) * this.power;
    return { x: NS.rand.range(-k, k), y: NS.rand.range(-k, k) };
  }
};

/* ---------- Floating damage numbers (pooled) ---------- */
NS.DmgNums = {
  list: [],
  pool: new NS.Pool(() => ({})),
  add(x, y, text, color, big) {
    if (this.list.length > 24) return;
    const f = this.pool.make();
    f.x = x; f.y = y; f.text = text; f.color = color || '#fff';
    f.t = 0; f.life = big ? 1.0 : 0.6; f.big = !!big;
    this.list.push(f);
  },
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const f = L[i];
      f.t += dt; f.y -= 26 * dt;
      if (f.t >= f.life) { this.pool.give(f); L[i] = L[L.length - 1]; L.pop(); }
    }
  },
  draw(ctx, cam) {
    ctx.textAlign = 'center';
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const f = L[i];
      const a = f.t < f.life - 0.25 ? 1 : (f.life - f.t) / 0.25;
      ctx.globalAlpha = NS.clamp(a, 0, 1);
      ctx.font = f.big ? 'bold 11px monospace' : 'bold 8px monospace';
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x - cam.x, f.y - cam.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  },
  clear() { while (this.list.length) this.pool.give(this.list.pop()); }
};

/* ---------- Spatial hash grid (for hundreds of enemies) ----------
   Two-level structure: map[cy] = { cx: [entities] } — zero string
   concat in the hot path, one row lookup per y. */
NS.Grid = {
  cell: 64,
  map: {},
  clear() { this.map = {}; },
  insert(e) {
    const cx = (e.x / this.cell) | 0, cy = (e.y / this.cell) | 0;
    let row = this.map[cy];
    if (!row) row = this.map[cy] = {};
    let arr = row[cx];
    if (!arr) arr = row[cx] = [];
    arr.push(e);
  },
  /* iterate entities within radius of a point.
     Two-level map: map[yKey] = { xKey: [entities] } — no string concat
     per entity per frame; row lookup once per y. */
  query(x, y, r, out) {
    out.length = 0;
    const c = this.cell;
    const x0 = ((x - r) / c) | 0, x1 = ((x + r) / c) | 0;
    const y0 = ((y - r) / c) | 0, y1 = ((y + r) / c) | 0;
    for (let cy = y0; cy <= y1; cy++) {
      const row = this.map[cy];
      if (!row) continue;
      for (let cx = x0; cx <= x1; cx++) {
        const arr = row[cx];
        if (arr) for (let i = 0; i < arr.length; i++) out.push(arr[i]);
      }
    }
    return out;
  }
};

/* ---------- Ring buffer FPS meter (debug) ---------- */
NS.FPS = { val: 60, acc: 0, frames: 0, tick(dt) { this.acc += dt; this.frames++; if (this.acc >= 0.5) { this.val = Math.round(this.frames / this.acc); this.acc = 0; this.frames = 0; } } };

/* ---------- Adaptive quality (auto lowers load on slow devices) ----------
   level 2 = full, 1 = medium, 0 = low. Checked every 3s of gameplay. */
NS.Quality = {
  level: 2,
  t: 0,
  enemyCap() {
    const base = NS.Mobile && NS.Mobile.isTouch ? [110, 150, 200] : [160, 240, 300];
    return base[this.level];
  },
  particleMax() { return [120, 180, 260][this.level]; },
  check(dt) {
    this.t += dt;
    if (this.t < 3) return;
    this.t = 0;
    /* only downgrade automatically; fresh runs start at level 2 */
    if (NS.FPS.val < 42 && this.level > 0) {
      this.level--;
      NS.Particles.MAX = this.particleMax();
    }
  },
  reset() { this.level = 2; this.t = 0; NS.Particles.MAX = 260; }
};
