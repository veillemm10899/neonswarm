  /* Shared headless harness for NEONSWARM tests — stubs the DOM and loads the
     game modules into a vm sandbox. Extracted from smoke.js so the final-form
     and global-passive suites exercise the real code, not a copy. */
  'use strict';
  const fs = require('fs');
  const vm = require('vm');
  const path = require('path');

  function createHarness(opts) {
    opts = opts || {};

  /* ---------- DOM stubs ---------- */
  function makeEl(id) {
    return {
      id, style: { setProperty() {} },
      classList: { add() {}, remove() {}, toggle() {} },
      dataset: {}, children: [], firstChild: null, textContent: '', innerHTML: '',
      appendChild(c) { this.children.push(c); this.firstChild = this.children[0]; return c; },
      remove() {},
      addEventListener() {}, removeEventListener() {},
      querySelectorAll() { return []; },
      setAttribute() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 320, height: 180 }; },
      getContext() { return null; },
      width: 320, height: 180, href: ''
    };
  }
  const els = {};
  function getEl(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; }

  function makeCtx2d() {
    /* noop 2d context — every method used by the game must exist */
    const grad = { addColorStop() {} };
    return new Proxy({
      canvas: makeEl('ctxcanvas'),
      createLinearGradient: () => grad,
      createRadialGradient: () => grad,
      getImageData: () => ({ data: [] }),
      measureText: () => ({ width: 10 })
    }, {
      get(t, k) {
        if (k in t) return t[k];
        return () => {};
      },
      set() { return true; }
    });
  }

  const store = {};
    const sandbox = {
    console, Math, Date, JSON, Object, Array, Set, Map, String, Number, Boolean,
    parseInt, parseFloat, isNaN, isFinite,
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    setTimeout: (fn) => 0,
    setInterval: () => 0, clearInterval() {},
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    navigator: { maxTouchPoints: 0, vibrate() {}, userAgent: 'node-test' },
    document: {
      getElementById: getEl,
      createElement: (tag) => {
        const el = makeEl(tag);
        if (tag === 'canvas') { el.width = 300; el.height = 150; el.getContext = () => makeCtx2d(); }
        return el;
      },
      addEventListener() {},
      body: makeEl('body'),
      hidden: false
    },
    window: null
  };
  sandbox.window = {
    addEventListener() {}, removeEventListener() {},
    innerWidth: 1280, innerHeight: 720,
    matchMedia: () => ({ matches: false }),
    AudioContext: undefined,
    devicePixelRatio: 1
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  /* ---------- Load modules ---------- */
  const dir = path.join(__dirname, '..', 'js');
  const files = ['core.js', 'icons.js', 'characters.js', 'audio.js', 'input.js', 'save.js', 'player.js', 'weapons.js',
    'enemies.js', 'bosses.js', 'pickups.js', 'upgrades.js', 'ui.js', 'game.js', 'main.js'];
  /* NOTE: main.js is skipped — it self-boots the real loop + menu wiring.
     We drive the game manually below. */
  const loadList = files.filter(f => f !== 'main.js');
  for (const f of loadList) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    vm.runInContext('window = this; globalThis = this;', sandbox, { filename: '_alias.js' });
    vm.runInContext(code, sandbox, { filename: f });
  }


  return { vm, sandbox, loadList, dir };
}

module.exports = { createHarness };
