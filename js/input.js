'use strict';
/* ============================================================
   NEONSWARM — input.js + mobile.js combined
   Keyboard (WASD/arrows), floating virtual joystick on touch,
   gesture prevention, device detection.
   ============================================================ */

NS.Input = {
  keys: {},
  pressed: {},
  joy: { x: 0, y: 0, active: false },
  touch: {},
  isTouch: false,

  binds: {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    pause: ['Escape', 'KeyP']
  },

  init(canvas) {
    this.isTouch = ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (this.isTouch) document.body.classList.add('touch');

    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys[e.code]) {
        this.pressed[e.code] = true;
        NS.Audio.unlock();
      }
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    if (this.isTouch) this.buildTouch(canvas);
  },

  actionDown(action) {
    if (this.binds[action].some(k => this.keys[k])) return true;
    if (this.joy.active) {
      if (action === 'up' && this.joy.y < -0.3) return true;
      if (action === 'down' && this.joy.y > 0.3) return true;
      if (action === 'left' && this.joy.x < -0.3) return true;
      if (action === 'right' && this.joy.x > 0.3) return true;
    }
    return false;
  },

  moveVector(out) {
    out.x = 0; out.y = 0;
    if (this.actionDown('left')) out.x -= 1;
    if (this.actionDown('right')) out.x += 1;
    if (this.actionDown('up')) out.y -= 1;
    if (this.actionDown('down')) out.y += 1;
    if (out.x !== 0 && out.y !== 0) { out.x *= 0.7071; out.y *= 0.7071; }
    if (this.joy.active) {
      const mag = Math.hypot(this.joy.x, this.joy.y);
      if (mag > 0.25) {
        const k = Math.min(1, (mag - 0.2) / 0.6);
        out.x = (this.joy.x / mag) * k;
        out.y = (this.joy.y / mag) * k;
      } else { out.x = 0; out.y = 0; }
    }
    return out;
  },

  keyOnce(code) { if (this.pressed[code]) { this.pressed[code] = false; return true; } return false; },
  endFrame() { this.pressed = {}; },

  /* ---------- Virtual joystick (floating) ---------- */
  buildTouch(canvas) {
    const zone = document.getElementById('touch-ui');
    const base = document.createElement('div');
    base.id = 'joy-base';
    const knob = document.createElement('div');
    knob.id = 'joy-knob';
    base.appendChild(knob);
    zone.appendChild(base);
    this.joyBase = base; this.joyKnob = knob;
    let joyId = null, cx = 0, cy = 0;

    const MAX = 52; /* longer throw = finer control on phones */
    /* The canvas/overlays use pointer-events:none layers, so listen on
       window and filter out touches that start on real controls. */
    const onUI = (t) => t.target && t.target.closest && t.target.closest('button, a, .menu-screen, .m-btn');

    const onStart = (e) => {
      for (const t of e.changedTouches) {
        if (joyId !== null || onUI(t)) continue;
        joyId = t.identifier;
        const r = zone.getBoundingClientRect();
        cx = t.clientX - r.left; cy = t.clientY - r.top;
        base.style.left = cx + 'px'; base.style.top = cy + 'px';
        base.classList.add('on');
        /* hide the resting joystick while the floating one is live */
        const rest = document.getElementById('joy-rest');
        if (rest) rest.style.opacity = '0.15';
        NS.Audio.unlock();
        e.preventDefault();
      }
    };

    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        const r = zone.getBoundingClientRect();
        const dx = t.clientX - r.left - cx, dy = t.clientY - r.top - cy;
        const d = Math.min(MAX, Math.hypot(dx, dy));
        const a = Math.atan2(dy, dx);
        knob.style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`;
        this.joy.x = Math.cos(a) * d / MAX;
        this.joy.y = Math.sin(a) * d / MAX;
        this.joy.active = true;
        e.preventDefault();
      }
    };

    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        joyId = null;
        this.joy.x = 0; this.joy.y = 0; this.joy.active = false;
        knob.style.transform = 'translate(0,0)';
        base.classList.remove('on');
        const rest = document.getElementById('joy-rest');
        if (rest) rest.style.opacity = '1';
      }
    };

    window.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);

    /* block browser gestures during play */
    document.addEventListener('touchmove', (e) => {
      if (e.target.closest && e.target.closest('.scrollable')) return;
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }
};
