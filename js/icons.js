'use strict';
/* ============================================================
   NEONSWARM — icons.js
   Procedural icon set for the HUD loadout bar + draft cards.
   Each icon is drawn ONCE into a small canvas, cached by key,
   and reused as an <img>-less DOM node (canvas element).
   No emoji, no image files.
   ============================================================ */

NS.Icons = {
  cache: {},

  /* one shared draw context per icon */
  make(size, draw) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    c.className = 'icon-canvas';
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    const u = size / 24; /* unit scale — draw in 24x24 space */
    draw(g, u);
    return c;
  },

  /* public: get (cached) icon canvas for a weapon/passive id */
  get(kind, id) {
    const key = kind + ':' + id;
    if (this.cache[key]) return this.cache[key];
    const obj = kind === 'w' ? this.WEAPONS : this.PASSIVES;
    const draw = obj[id] || this.fallback;
    if (!draw) return null;
    /* bind: icon fns call this.poly — NS.Icons is the receiver */
    const self = this;
    const c = this.make(24, (g, u) => draw.call(self, g, u));
    this.cache[key] = c;
    return c;
  },

  /* fallback: hexagon rune — never blank, tinted per-color by caller CSS */
  fallback(g, u) {
    g.strokeStyle = '#9a9ab0';
    g.lineWidth = 1.6 * u;
    this.poly(g, [[0, -8.5 * u], [7.5 * u, -4 * u], [7.5 * u, 4 * u], [0, 8.5 * u], [-7.5 * u, 4 * u], [-7.5 * u, -4 * u]]);
    g.stroke();
    g.fillStyle = '#9a9ab0';
    g.beginPath(); g.arc(0, 0, 2.2 * u, 0, NS.TAU); g.fill();
  },

  /* fresh clone for DOM insertion (a canvas node can only be in one place) */
  node(kind, id, size) {
    const src = this.get(kind, id);
    if (!src) return null;
    const c = document.createElement('canvas');
    c.width = size || 24; c.height = size || 24;
    c.className = 'icon-canvas';
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c;
  },

  /* ---------- helpers ---------- */
  poly(g, pts, close) {
    g.beginPath();
    pts.forEach((p, i) => i === 0 ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1]));
    if (close !== false) g.closePath();
  },

  /* ================= WEAPON ICONS (24x24 space) ================= */
  WEAPONS: {
    /* crosshair + burst */
    pulse(g, u) {
      g.strokeStyle = g.fillStyle = '#5ef2ff';
      g.lineWidth = 1.6 * u;
      g.beginPath(); g.arc(0, 0, 7 * u, 0, NS.TAU); g.stroke();
      this.poly(g, [[0, -11 * u], [2.2 * u, -5 * u], [-2.2 * u, -5 * u]]); g.fill();
      this.poly(g, [[0, 11 * u], [2.2 * u, 5 * u], [-2.2 * u, 5 * u]]); g.fill();
      this.poly(g, [[-11 * u, 0], [-5 * u, -2.2 * u], [-5 * u, 2.2 * u]]); g.fill();
      this.poly(g, [[11 * u, 0], [5 * u, -2.2 * u], [5 * u, 2.2 * u]]); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 0, 2.2 * u, 0, NS.TAU); g.fill();
    },
    /* three orbiting squares */
    blades(g, u) {
      g.fillStyle = '#ffd23f';
      for (let k = 0; k < 3; k++) {
        g.save();
        g.rotate(k * NS.TAU / 3);
        g.translate(6.5 * u, 0);
        g.fillRect(-2.6 * u, -2.6 * u, 5.2 * u, 5.2 * u);
        g.restore();
      }
      g.strokeStyle = '#fff6d8';
      g.lineWidth = 1 * u;
      g.beginPath(); g.arc(0, 0, 6.5 * u, 0, NS.TAU); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 0, 1.8 * u, 0, NS.TAU); g.fill();
    },
    /* expanding rings */
    nova(g, u) {
      g.strokeStyle = '#c77dff';
      for (let k = 1; k <= 3; k++) {
        g.globalAlpha = k === 3 ? 1 : 0.5;
        g.lineWidth = (k === 3 ? 2 : 1.2) * u;
        g.beginPath(); g.arc(0, 0, k * 3.4 * u, 0, NS.TAU); g.stroke();
      }
      g.globalAlpha = 1;
    },
    /* zigzag bolt */
    lightning(g, u) {
      g.fillStyle = '#9dff57';
      this.poly(g, [[2 * u, -10 * u], [-5 * u, 2 * u], [-0.5 * u, 2 * u], [-2 * u, 10 * u], [5 * u, -2 * u], [0.5 * u, -2 * u]]);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)';
      this.poly(g, [[2 * u, -10 * u], [-1 * u, -3 * u], [1 * u, -3 * u]]);
      g.fill();
    },
    /* mine: circle with spikes */
    mines(g, u) {
      g.fillStyle = '#ff5e6c';
      for (let k = 0; k < 8; k++) {
        g.save(); g.rotate(k * NS.TAU / 8);
        g.fillRect(-0.8 * u, -10 * u, 1.6 * u, 4 * u);
        g.restore();
      }
      g.beginPath(); g.arc(0, 0, 5.5 * u, 0, NS.TAU); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 0, 2 * u, 0, NS.TAU); g.fill();
    },
    /* drone: rounded body + eye */
    drone(g, u) {
      g.fillStyle = '#ff9d3f';
      this.poly(g, [[0, -7 * u], [6 * u, 0], [0, 7 * u], [-6 * u, 0]]); g.fill();
      g.fillStyle = '#0a0a16';
      g.beginPath(); g.arc(0, 0, 2.2 * u, 0, NS.TAU); g.fill();
      g.strokeStyle = '#ff9d3f';
      g.lineWidth = 1.2 * u;
      g.beginPath(); g.arc(0, 0, 9 * u, 0.4, 2.2); g.stroke();
      g.beginPath(); g.arc(0, 0, 9 * u, 0.4 + Math.PI, 2.2 + Math.PI); g.stroke();
    },
    /* snowflake */
    frost(g, u) {
      g.strokeStyle = '#7dd7ff';
      g.lineWidth = 1.4 * u;
      for (let k = 0; k < 6; k++) {
        g.save(); g.rotate(k * NS.TAU / 6);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -9 * u); g.stroke();
        g.beginPath(); g.moveTo(0, -5 * u); g.lineTo(2.4 * u, -7 * u); g.stroke();
        g.beginPath(); g.moveTo(0, -5 * u); g.lineTo(-2.4 * u, -7 * u); g.stroke();
        g.restore();
      }
    },
    /* rail: long barrel + blast */
    railgun(g, u) {
      g.fillStyle = '#ff4fa3';
      g.fillRect(-2 * u, -11 * u, 4 * u, 15 * u);
      this.poly(g, [[0, 11 * u], [4.5 * u, 4 * u], [-4.5 * u, 4 * u]]); g.fill();
      g.fillStyle = '#fff';
      g.fillRect(-1 * u, -11 * u, 2 * u, 6 * u);
    },
    /* sun with rays */
    beam(g, u) {
      g.fillStyle = '#ff9d3f';
      g.beginPath(); g.arc(0, 0, 4.5 * u, 0, NS.TAU); g.fill();
      g.strokeStyle = '#ff9d3f';
      g.lineWidth = 1.6 * u;
      for (let k = 0; k < 8; k++) {
        g.save(); g.rotate(k * NS.TAU / 8);
        g.beginPath(); g.moveTo(0, -6.5 * u); g.lineTo(0, -10 * u); g.stroke();
        g.restore();
      }
      g.fillStyle = '#fff6d8';
      g.beginPath(); g.arc(0, 0, 2 * u, 0, NS.TAU); g.fill();
    },
    /* thorn star */
    spike(g, u) {
      g.fillStyle = '#ff4fa3';
      for (let k = 0; k < 8; k++) {
        g.save(); g.rotate(k * NS.TAU / 8);
        this.poly(g, [[0, -10 * u], [1.8 * u, -3 * u], [-1.8 * u, -3 * u]]); g.fill();
        g.restore();
      }
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 0, 2.4 * u, 0, NS.TAU); g.fill();
    },
    /* spiral vortex */
    tornado(g, u) {
      g.strokeStyle = '#9dff57';
      g.lineWidth = 1.7 * u;
      g.beginPath();
      for (let a = 0; a < NS.TAU * 2.2; a += 0.25) {
        const r = 1.5 * u + a * 1.35 * u;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    },
    /* ghost wisp */
    ghost(g, u) {
      g.fillStyle = '#c77dff';
      g.beginPath();
      g.arc(0, -2 * u, 6 * u, Math.PI, 0);
      g.lineTo(6 * u, 6 * u);
      for (let k = 0; k < 3; k++) {
        g.arc((4 - k * 4) * u, 6 * u, 2 * u, 0, Math.PI, k % 2 === 0);
      }
      g.closePath(); g.fill();
      g.fillStyle = '#0a0a16';
      g.fillRect(-3.5 * u, -4 * u, 2 * u, 3 * u);
      g.fillRect(1.5 * u, -4 * u, 2 * u, 3 * u);
    },
    /* prism: triangle splitting beams */
    prism(g, u) {
      g.strokeStyle = '#5ef2ff';
      g.lineWidth = 1.4 * u;
      this.poly(g, [[0, -8 * u], [7 * u, 5 * u], [-7 * u, 5 * u]]); g.stroke();
      g.lineWidth = 1.1 * u;
      g.beginPath(); g.moveTo(-7 * u, 5 * u); g.lineTo(-10.5 * u, 9.5 * u); g.stroke();
      g.beginPath(); g.moveTo(0, 5 * u); g.lineTo(0, 10.5 * u); g.stroke();
      g.beginPath(); g.moveTo(7 * u, 5 * u); g.lineTo(10.5 * u, 9.5 * u); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, -1 * u, 1.8 * u, 0, NS.TAU); g.fill();
    },
    /* rocket */
    missiles(g, u) {
      g.fillStyle = '#ffb14f';
      this.poly(g, [[0, -10 * u], [3.2 * u, -2 * u], [3.2 * u, 6 * u], [-3.2 * u, 6 * u], [-3.2 * u, -2 * u]]); g.fill();
      g.fillStyle = '#ff5e6c';
      this.poly(g, [[0, 11 * u], [3.2 * u, 6 * u], [-3.2 * u, 6 * u]]); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, -4 * u, 1.7 * u, 0, NS.TAU); g.fill();
    },
    /* boomerang chevron */
    boomerang(g, u) {
      g.fillStyle = '#baffd9';
      g.lineWidth = 3 * u;
      g.strokeStyle = '#baffd9';
      g.beginPath();
      g.moveTo(-8 * u, -6 * u);
      g.quadraticCurveTo(0, 2 * u, 8 * u, -6 * u);
      g.quadraticCurveTo(0, -1 * u, -8 * u, -6 * u);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, -1 * u, 1.4 * u, 0, NS.TAU); g.fill();
    },
    /* saw circle w/ teeth */
    saw(g, u) {
      g.fillStyle = '#d9d9e8';
      for (let k = 0; k < 10; k++) {
        g.save(); g.rotate(k * NS.TAU / 10);
        this.poly(g, [[-1.4 * u, -10 * u], [1.4 * u, -10 * u], [0, -6 * u]]); g.fill();
        g.restore();
      }
      g.beginPath(); g.arc(0, 0, 6.5 * u, 0, NS.TAU); g.fill();
      g.fillStyle = '#0a0a16';
      g.beginPath(); g.arc(0, 0, 2.2 * u, 0, NS.TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 1 * u;
      g.beginPath(); g.arc(0, 0, 4.4 * u, 0, NS.TAU); g.stroke();
    },
    /* aegis: shield with wave */
    aegis(g, u) {
      g.strokeStyle = '#ffb14f';
      g.lineWidth = 1.6 * u;
      this.poly(g, [[0, -9 * u], [7 * u, -5.5 * u], [7 * u, 2 * u], [0, 9.5 * u], [-7 * u, 2 * u], [-7 * u, -5.5 * u]]); g.stroke();
      g.lineWidth = 1.4 * u;
      g.beginPath();
      g.moveTo(-4 * u, 0);
      g.quadraticCurveTo(-2 * u, -2.5 * u, 0, 0);
      g.quadraticCurveTo(2 * u, 2.5 * u, 4 * u, 0);
      g.stroke();
    },
    /* flux: orb + orbit ring */
    flux(g, u) {
      g.fillStyle = '#c77dff';
      g.beginPath(); g.arc(0, 0, 5 * u, 0, NS.TAU); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(-1.5 * u, -1.5 * u, 1.6 * u, 0, NS.TAU); g.fill();
      g.strokeStyle = 'rgba(199,125,255,0.7)';
      g.lineWidth = 1.3 * u;
      g.beginPath(); g.ellipse(0, 0, 9.5 * u, 3.8 * u, 0.5, 0, NS.TAU); g.stroke();
    },
    /* ---------- wave 10 weapons ---------- */
    /* whip: arc slash */
    whip(g, u) {
      g.strokeStyle = '#ff4fa3';
      g.lineWidth = 2.4 * u;
      g.beginPath(); g.arc(-2 * u, 0, 8 * u, -1, 1); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 1.2 * u;
      g.beginPath(); g.arc(-2 * u, 0, 5.5 * u, -0.8, 0.8); g.stroke();
    },
    /* repel: push rings */
    repel(g, u) {
      g.strokeStyle = '#8a93c9';
      g.lineWidth = 1.6 * u;
      g.beginPath(); g.arc(0, 0, 3.5 * u, 0, NS.TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, 7.5 * u, 0, NS.TAU); g.stroke();
      g.fillStyle = '#8a93c9';
      for (let k = 0; k < 6; k++) {
        g.save(); g.rotate(k * NS.TAU / 6);
        this.poly(g, [[6 * u, -1.4 * u], [9.5 * u, 0], [6 * u, 1.4 * u]]); g.fill();
        g.restore();
      }
    },
    /* rain: falling stars */
    rain(g, u) {
      g.fillStyle = '#ffe45e';
      for (const [dx, dy, s] of [[-4, -6, 2.2], [3, -1, 1.7], [-1, 6, 2.4]]) {
        g.beginPath(); g.arc(dx * u, dy * u, s * u, 0, NS.TAU); g.fill();
      }
      g.strokeStyle = 'rgba(255,228,94,0.6)';
      g.lineWidth = 1.2 * u;
      for (const [dx, dy] of [[-4, -6], [3, -1], [-1, 6]]) {
        g.beginPath(); g.moveTo((dx + 1.5) * u, (dy - 4) * u); g.lineTo((dx + 3) * u, (dy - 7.5) * u); g.stroke();
      }
    },
    /* airstrike: pillars in a line */
    airstrike(g, u) {
      g.strokeStyle = '#bfe8ff';
      g.lineWidth = 1.8 * u;
      for (const dx of [-6, 0, 6]) {
        g.beginPath(); g.moveTo(dx * u, -9 * u); g.lineTo(dx * u, -2 * u); g.stroke();
        g.fillStyle = 'rgba(191,232,255,0.35)';
        g.beginPath(); g.arc(dx * u, 2 * u, 2.6 * u, 0, NS.TAU); g.fill();
      }
      g.fillStyle = '#bfe8ff';
      g.beginPath(); g.arc(0, -11 * u, 1.6 * u, 0, NS.TAU); g.fill();
    },
    /* split: forking bolt */
    split(g, u) {
      g.strokeStyle = '#7dff9a';
      g.lineWidth = 2 * u;
      g.beginPath(); g.moveTo(0, -10 * u); g.lineTo(0, 0); g.stroke();
      g.lineWidth = 1.6 * u;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-5 * u, 8 * u); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(5 * u, 8 * u); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 0, 1.8 * u, 0, NS.TAU); g.fill();
    },
    /* cluster: bomb + bomblets */
    cluster(g, u) {
      g.fillStyle = '#ff9d3f';
      g.beginPath(); g.arc(0, 1 * u, 5 * u, 0, NS.TAU); g.fill();
      g.strokeStyle = '#ff9d3f';
      g.lineWidth = 1.6 * u;
      g.beginPath(); g.moveTo(2 * u, -3 * u); g.quadraticCurveTo(4 * u, -8 * u, 7 * u, -8 * u); g.stroke();
      g.fillStyle = '#ffd23f';
      for (const [dx, dy] of [[-8, -4], [8, 2], [-6, 7], [6, 8]]) {
        g.beginPath(); g.arc(dx * u, dy * u, 1.6 * u, 0, NS.TAU); g.fill();
      }
    },
    /* flak: bursting shell */
    flak(g, u) {
      g.fillStyle = '#d9d9e8';
      g.beginPath(); g.arc(0, -2 * u, 3.4 * u, 0, NS.TAU); g.fill();
      g.strokeStyle = '#d9d9e8';
      g.lineWidth = 1.6 * u;
      for (let k = 0; k < 8; k++) {
        g.save(); g.rotate(k * NS.TAU / 8 + 0.4);
        g.beginPath(); g.moveTo(0, -5 * u); g.lineTo(0, -9.5 * u); g.stroke();
        g.restore();
      }
    },
    /* mirage: double ship */
    mirage(g, u) {
      g.strokeStyle = 'rgba(199,125,255,0.5)';
      g.lineWidth = 1.3 * u;
      this.poly(g, [[-6 * u, -2 * u], [-1 * u, -6 * u], [4 * u, -2 * u], [-1 * u, 8 * u]]); g.stroke();
      g.fillStyle = '#c77dff';
      this.poly(g, [[1 * u, -6 * u], [6 * u, -2 * u], [1 * u, 4 * u], [-4 * u, -2 * u]]); g.fill();
      g.fillStyle = '#fff';
      this.poly(g, [[1 * u, -3.5 * u], [3.4 * u, -2 * u], [1 * u, 1.5 * u], [-1.4 * u, -2 * u]]); g.fill();
    },
    /* lotus: pinwheel petals */
    lotus(g, u) {
      g.fillStyle = '#ff9df2';
      for (let k = 0; k < 5; k++) {
        g.save();
        g.rotate(k * NS.TAU / 5);
        g.beginPath();
        g.moveTo(0, -3 * u);
        g.quadraticCurveTo(2.5 * u, -6.5 * u, 0, -10 * u);
        g.quadraticCurveTo(-2.5 * u, -6.5 * u, 0, -3 * u);
        g.fill();
        g.restore();
      }
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 0, 2 * u, 0, NS.TAU); g.fill();
    },
    /* coil: pod with arcs */
    coil(g, u) {
      g.fillStyle = '#c8ff8a';
      g.fillRect(-3 * u, -3 * u, 6 * u, 6 * u);
      g.strokeStyle = '#c8ff8a';
      g.lineWidth = 1.4 * u;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(dx * 4 * u, dy * 4 * u + (dy > 0 ? 2 : -2) * u);
        g.lineTo(dx * 8 * u, dy * 7 * u);
        g.stroke();
      }
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 0, 1.5 * u, 0, NS.TAU); g.fill();
    }
  },

  /* ================= PASSIVE ICONS ================= */
  PASSIVES: {
    speed(g, u) {
      g.fillStyle = '#5ef2ff';
      this.poly(g, [[-9 * u, -6 * u], [3 * u, -6 * u], [-1 * u, -1 * u], [5 * u, -1 * u], [-6 * u, 7 * u], [-2 * u, 1 * u], [-9 * u, 1 * u]]); g.fill();
      g.fillStyle = '#fff';
      this.poly(g, [[4 * u, -6 * u], [10 * u, -6 * u], [6 * u, 0 * u], [2 * u, 0 * u]]); g.fill();
    },
    maxhp(g, u) {
      g.fillStyle = '#ff5e6c';
      g.beginPath();
      g.moveTo(0, 8 * u);
      g.bezierCurveTo(-11 * u, 0, -6 * u, -9 * u, 0, -3.5 * u);
      g.bezierCurveTo(6 * u, -9 * u, 11 * u, 0, 0, 8 * u);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillRect(-1 * u, -3 * u, 2 * u, 6 * u);
      g.fillRect(-3 * u, -1 * u, 6 * u, 2 * u);
    },
    regen(g, u) {
      g.fillStyle = '#7dff9a';
      g.fillRect(-2 * u, -9 * u, 4 * u, 18 * u);
      g.fillRect(-9 * u, -2 * u, 18 * u, 4 * u);
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 0, 2.2 * u, 0, NS.TAU); g.fill();
    },
    armor(g, u) {
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 1.6 * u;
      this.poly(g, [[0, -9.5 * u], [8 * u, -6 * u], [8 * u, 2 * u], [0, 9.5 * u], [-8 * u, 2 * u], [-8 * u, -6 * u]]); g.stroke();
      g.fillStyle = '#ffd23f';
      g.fillRect(-1.2 * u, -5 * u, 2.4 * u, 8 * u);
      g.fillRect(-3.5 * u, -2.5 * u, 7 * u, 2.4 * u);
    },
    magnet(g, u) {
      g.strokeStyle = '#c77dff';
      g.lineWidth = 3 * u;
      g.beginPath(); g.arc(0, -1 * u, 6 * u, Math.PI, 0); g.stroke();
      g.fillStyle = '#c77dff';
      g.fillRect(-7.5 * u, -1 * u, 3 * u, 8 * u);
      g.fillRect(4.5 * u, -1 * u, 3 * u, 8 * u);
      g.fillStyle = '#fff';
      g.fillRect(-7.5 * u, 5.5 * u, 3 * u, 2.2 * u);
      g.fillRect(4.5 * u, 5.5 * u, 3 * u, 2.2 * u);
    },
    dmg(g, u) {
      g.strokeStyle = '#ff9d3f';
      g.lineWidth = 1.5 * u;
      for (let k = 0; k < 4; k++) {
        g.save(); g.rotate((k - 1.5) * 0.5);
        g.beginPath(); g.moveTo(0, -10 * u); g.lineTo(0, -2 * u); g.stroke();
        g.restore();
      }
      g.fillStyle = '#ff9d3f';
      this.poly(g, [[0, 10 * u], [4 * u, 0 * u], [-4 * u, 0 * u]]); g.fill();
      g.fillStyle = '#fff';
      this.poly(g, [[0, 5 * u], [2 * u, 0 * u], [-2 * u, 0 * u]]); g.fill();
    },
    cd(g, u) {
      g.strokeStyle = '#9dff57';
      g.lineWidth = 1.6 * u;
      g.beginPath(); g.arc(0, 0, 8 * u, 0, NS.TAU); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -5.5 * u); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(4 * u, 2 * u); g.stroke();
      g.fillStyle = '#9dff57';
      this.poly(g, [[8 * u, -3 * u], [12 * u, 0], [8 * u, 3 * u]]); g.fill();
    },
    xp(g, u) {
      g.fillStyle = '#5ef2ff';
      this.poly(g, [[0, -9 * u], [6 * u, 0], [0, 9 * u], [-6 * u, 0]]); g.fill();
      g.fillStyle = '#fff';
      this.poly(g, [[0, -4 * u], [2.8 * u, 0], [0, 4 * u], [-2.8 * u, 0]]); g.fill();
    },
    crit(g, u) {
      g.fillStyle = '#ff4fa3';
      this.poly(g, [[0, -10 * u], [2.5 * u, -3 * u], [10 * u, -2.5 * u], [4.5 * u, 2 * u], [6 * u, 9.5 * u], [0, 5.5 * u], [-6 * u, 9.5 * u], [-4.5 * u, 2 * u], [-10 * u, -2.5 * u], [-2.5 * u, -3 * u]]); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, -1 * u, 2 * u, 0, NS.TAU); g.fill();
    },
    thorns(g, u) {
      g.strokeStyle = '#ffb14f';
      g.lineWidth = 1.5 * u;
      g.beginPath(); g.arc(0, 0, 4 * u, 0, NS.TAU); g.stroke();
      g.fillStyle = '#ffb14f';
      for (let k = 0; k < 8; k++) {
        g.save(); g.rotate(k * NS.TAU / 8);
        this.poly(g, [[0, -9.5 * u], [1.7 * u, -4.5 * u], [-1.7 * u, -4.5 * u]]); g.fill();
        g.restore();
      }
    },
    /* wave-5 passives */
    kinetic(g, u) {
      g.strokeStyle = '#ff9d3f';
      g.lineWidth = 1.6 * u;
      for (let k = 0; k < 4; k++) {
        g.save(); g.rotate((k - 1.5) * 0.42);
        g.beginPath(); g.moveTo(0, -6 * u); g.lineTo(0, -10 * u); g.stroke();
        g.restore();
      }
      g.fillStyle = '#ff9d3f';
      g.beginPath(); g.arc(0, 2 * u, 4.5 * u, 0, NS.TAU); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 2 * u, 1.8 * u, 0, NS.TAU); g.fill();
    },
    tsnap(g, u) {
      g.strokeStyle = '#bfe8ff';
      g.lineWidth = 1.5 * u;
      g.beginPath();
      g.moveTo(-9 * u, 3 * u);
      g.lineTo(-2 * u, 3 * u);
      g.lineTo(-4 * u, -1 * u);
      g.lineTo(3 * u, -1 * u);
      g.lineTo(1 * u, -5 * u);
      g.lineTo(9 * u, -5 * u);
      g.stroke();
      g.fillStyle = '#bfe8ff';
      this.poly(g, [[-2 * u, -9 * u], [3 * u, -5 * u], [-2 * u, -5 * u]]); g.fill();
    },
    salv(g, u) {
      g.fillStyle = '#7dff9a';
      g.fillRect(-1.5 * u, -8 * u, 3 * u, 10 * u);
      this.poly(g, [[-6 * u, -2 * u], [6 * u, -2 * u], [0, 9 * u]]); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, -6 * u, 1.6 * u, 0, NS.TAU); g.fill();
    },
    oclock(g, u) {
      g.strokeStyle = '#ff4fa3';
      g.lineWidth = 1.6 * u;
      g.beginPath(); g.arc(0, 0, 7 * u, 0, NS.TAU); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -5 * u); g.stroke();
      g.fillStyle = '#ff4fa3';
      this.poly(g, [[0, 0], [4.5 * u, 1.5 * u], [0, 3 * u]]); g.fill();
      g.strokeStyle = 'rgba(255,79,163,0.7)';
      g.lineWidth = 1.2 * u;
      g.beginPath(); g.arc(0, 0, 10 * u, -0.5, 0.9); g.stroke();
    },
    second(g, u) {
      g.strokeStyle = '#7dff9a';
      g.lineWidth = 1.6 * u;
      g.beginPath(); g.arc(0, 0, 8.5 * u, 0, NS.TAU); g.stroke();
      g.fillStyle = '#7dff9a';
      this.poly(g, [[0, -5 * u], [1.8 * u, -1 * u], [6 * u, -0.5 * u], [3 * u, 2.5 * u], [4 * u, 7 * u], [0, 4.5 * u], [-4 * u, 7 * u], [-3 * u, 2.5 * u], [-6 * u, -0.5 * u], [-1.8 * u, -1 * u]]); g.fill();
    },
    shield(g, u) {
      g.strokeStyle = '#bfe8ff';
      g.lineWidth = 1.8 * u;
      g.beginPath(); g.arc(0, 0, 7.5 * u, 0, NS.TAU); g.stroke();
      g.globalAlpha = 0.35;
      g.fillStyle = '#bfe8ff';
      g.beginPath(); g.arc(0, 0, 7.5 * u, 0, NS.TAU); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 0, 2 * u, 0, NS.TAU); g.fill();
    },
    glass(g, u) {
      g.strokeStyle = '#ff5e6c';
      g.lineWidth = 1.5 * u;
      this.poly(g, [[-6 * u, -9 * u], [6 * u, -9 * u], [1.5 * u, 2 * u], [1.5 * u, 9 * u], [-1.5 * u, 9 * u], [-1.5 * u, 2 * u]]); g.stroke();
      g.fillStyle = 'rgba(255,94,108,0.35)';
      this.poly(g, [[-4.5 * u, -7.5 * u], [4.5 * u, -7.5 * u], [1.2 * u, 1.2 * u], [-1.2 * u, 1.2 * u]]); g.fill();
    },
    bait(g, u) {
      g.fillStyle = '#ff9df2';
      g.beginPath(); g.arc(-4 * u, -2 * u, 3.2 * u, 0, NS.TAU); g.fill();
      g.beginPath(); g.arc(3 * u, -5 * u, 2.4 * u, 0, NS.TAU); g.fill();
      g.beginPath(); g.arc(4 * u, 3 * u, 3.6 * u, 0, NS.TAU); g.fill();
      g.beginPath(); g.arc(-3 * u, 5 * u, 2.2 * u, 0, NS.TAU); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 0, 1.6 * u, 0, NS.TAU); g.fill();
    },
    fang(g, u) {
      g.fillStyle = '#ff4757';
      this.poly(g, [[-5 * u, -8 * u], [-1.5 * u, -8 * u], [-3 * u, 7 * u]]); g.fill();
      this.poly(g, [[1.5 * u, -8 * u], [5 * u, -8 * u], [3 * u, 7 * u]]); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath(); g.arc(-3 * u, -5 * u, 1 * u, 0, NS.TAU); g.fill();
      g.beginPath(); g.arc(3 * u, -5 * u, 1 * u, 0, NS.TAU); g.fill();
    },
    frenzy(g, u) {
      g.fillStyle = '#ff9d3f';
      for (let k = 0; k < 3; k++) {
        g.save(); g.rotate((k - 1) * 0.55);
        this.poly(g, [[0, -10 * u], [2.2 * u, 2 * u], [-2.2 * u, 2 * u]]); g.fill();
        g.restore();
      }
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 4 * u, 2 * u, 0, NS.TAU); g.fill();
    },
    bulwark(g, u) {
      g.fillStyle = '#8a93c9';
      g.fillRect(-8 * u, -7 * u, 16 * u, 4 * u);
      g.fillRect(-8 * u, -1 * u, 16 * u, 4 * u);
      g.fillRect(-8 * u, 5 * u, 16 * u, 4 * u);
      g.fillStyle = '#fff';
      g.fillRect(-2 * u, -5.5 * u, 4 * u, 13 * u);
    },
    adren(g, u) {
      g.strokeStyle = '#7dff9a';
      g.lineWidth = 2.2 * u;
      g.beginPath();
      g.moveTo(-8 * u, 2 * u);
      g.lineTo(-2 * u, 2 * u);
      g.lineTo(0, -6 * u);
      g.lineTo(3 * u, 6 * u);
      g.lineTo(5 * u, 0);
      g.lineTo(8 * u, 0);
      g.stroke();
    },
    plate(g, u) {
      g.strokeStyle = '#b56cff';
      g.lineWidth = 1.6 * u;
      g.beginPath(); g.arc(0, 0, 7 * u, 0, NS.TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, 3.5 * u, 0, NS.TAU); g.stroke();
      g.fillStyle = '#b56cff';
      g.beginPath(); g.arc(0, 0, 1.5 * u, 0, NS.TAU); g.fill();
    },
    execu(g, u) {
      g.strokeStyle = '#ff5e6c';
      g.lineWidth = 1.8 * u;
      g.beginPath(); g.moveTo(-6 * u, -9 * u); g.lineTo(5 * u, 2 * u); g.stroke();
      g.fillStyle = '#ff5e6c';
      g.fillRect(-8 * u, -11 * u, 4 * u, 4 * u);
      g.lineWidth = 1.4 * u;
      g.beginPath(); g.moveTo(2 * u, 4 * u); g.lineTo(-4 * u, 10 * u); g.stroke();
      g.beginPath(); g.moveTo(5 * u, 6 * u); g.lineTo(1 * u, 10 * u); g.stroke();
    },
    omega(g, u) {
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 2.2 * u;
      g.beginPath(); g.arc(0, 0, 6.5 * u, 0, NS.TAU); g.stroke();
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.arc(0, 0, 2 * u, 0, NS.TAU); g.fill();
    },
    titan(g, u) {
      g.fillStyle = '#ffd23f';
      g.fillRect(-8 * u, -8 * u, 16 * u, 16 * u);
      g.fillStyle = '#0a0a16';
      g.fillRect(-5 * u, -5 * u, 10 * u, 10 * u);
      g.fillStyle = '#ffd23f';
      g.fillRect(-2.5 * u, -2.5 * u, 5 * u, 5 * u);
    },
    singul(g, u) {
      g.fillStyle = '#0a0a16';
      g.beginPath(); g.arc(0, 0, 6 * u, 0, NS.TAU); g.fill();
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 1.6 * u;
      g.beginPath(); g.arc(0, 0, 6 * u, 0, NS.TAU); g.stroke();
      g.strokeStyle = 'rgba(255,210,63,0.6)';
      g.beginPath(); g.ellipse(0, 0, 10 * u, 3.5 * u, 0.4, 0, NS.TAU); g.stroke();
    },
    engine(g, u) {
      g.fillStyle = '#ffd23f';
      this.poly(g, [[-6 * u, -8 * u], [6 * u, -8 * u], [2 * u, -2 * u], [6 * u, 2 * u], [-6 * u, 2 * u]]); g.fill();
      this.poly(g, [[-3 * u, 4 * u], [3 * u, 4 * u], [0, 10 * u]]); g.fill();
    },
    /* ---------- wave 10 passives ---------- */
    /* cryo nova: snowflake in a ring */
    snow(g, u) {
      g.strokeStyle = '#bfe8ff';
      g.lineWidth = 1.4 * u;
      g.beginPath(); g.arc(0, 0, 9 * u, 0, NS.TAU); g.stroke();
      for (let k = 0; k < 6; k++) {
        g.save(); g.rotate(k * NS.TAU / 6);
        g.beginPath(); g.moveTo(0, -3 * u); g.lineTo(0, -7.5 * u); g.stroke();
        g.beginPath(); g.moveTo(0, -5 * u); g.lineTo(1.8 * u, -6.5 * u); g.stroke();
        g.restore();
      }
    },
    /* seismic: shockwave arrows out */
    knock(g, u) {
      g.fillStyle = '#ffb14f';
      g.beginPath(); g.arc(0, 0, 3 * u, 0, NS.TAU); g.fill();
      g.strokeStyle = '#ffb14f';
      g.lineWidth = 1.6 * u;
      for (let k = 0; k < 4; k++) {
        g.save(); g.rotate(k * NS.TAU / 4);
        g.beginPath(); g.moveTo(5 * u, 0); g.lineTo(9.5 * u, 0); g.stroke();
        this.poly(g, [[9.5 * u, -2.2 * u], [12 * u, 0], [9.5 * u, 2.2 * u]]); g.fill();
        g.restore();
      }
    },
    /* bloodlust: fanged crit star */
    lethal(g, u) {
      g.fillStyle = '#ff5e6c';
      this.poly(g, [[0, -10 * u], [2.5 * u, -3 * u], [10 * u, -2.5 * u], [4.5 * u, 2 * u], [6 * u, 9.5 * u], [0, 5.5 * u], [-6 * u, 9.5 * u], [-4.5 * u, 2 * u], [-10 * u, -2.5 * u], [-2.5 * u, -3 * u]]); g.fill();
      g.fillStyle = '#fff';
      this.poly(g, [[-3 * u, -4 * u], [-1 * u, -4 * u], [-2 * u, 0]]); g.fill();
      this.poly(g, [[1 * u, -4 * u], [3 * u, -4 * u], [2 * u, 0]]); g.fill();
    },
    /* aegis core: blocking shield */
    shield(g, u) {
      g.strokeStyle = '#bfe8ff';
      g.lineWidth = 1.8 * u;
      this.poly(g, [[0, -9.5 * u], [7.5 * u, -6 * u], [7.5 * u, 1.5 * u], [0, 9.5 * u], [-7.5 * u, 1.5 * u], [-7.5 * u, -6 * u]]); g.stroke();
      g.fillStyle = 'rgba(191,232,255,0.25)';
      this.poly(g, [[0, -7 * u], [5.5 * u, -4.4 * u], [5.5 * u, 0.8 * u], [0, 7 * u], [-5.5 * u, 0.8 * u], [-5.5 * u, -4.4 * u]]); g.fill();
      g.fillStyle = '#fff';
      g.fillRect(-1 * u, -4 * u, 2 * u, 7 * u);
    },
    /* phase drive: dodge streaks */
    dodge(g, u) {
      g.strokeStyle = '#c77dff';
      g.lineWidth = 2 * u;
      for (const off of [-5, 0, 5]) {
        g.beginPath();
        g.moveTo((-8 + Math.abs(off) * 0.3) * u, off * u);
        g.lineTo(3 * u, off * u);
        g.stroke();
      }
      g.fillStyle = '#c77dff';
      this.poly(g, [[3 * u, -8 * u], [9 * u, 0], [3 * u, 8 * u], [0, 0]]); g.fill();
    },
    /* ricochet: bouncing shot */
    rico(g, u) {
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 1.8 * u;
      g.beginPath();
      g.moveTo(-9 * u, 7 * u);
      g.lineTo(-2 * u, -2 * u);
      g.lineTo(4 * u, 4 * u);
      g.lineTo(9 * u, -5 * u);
      g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(9 * u, -5 * u, 2 * u, 0, NS.TAU); g.fill();
      g.beginPath(); g.arc(-2 * u, -2 * u, 1.4 * u, 0, NS.TAU); g.fill();
    }
  }
};
