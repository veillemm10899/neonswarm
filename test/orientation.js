/* Regression test: the canvas backing store must always match the virtual
   resolution, otherwise the view is drawn into a stale buffer and the player
   renders off-center (bug reported 2026-09-27).

   Unlike smoke.js, this LOADS main.js so the real setOrientation() runs. */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let fails = 0;
function check(name, cond, extra) {
  if (cond) { console.log('  PASS  ' + name); }
  else { fails++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

/* Build a sandbox and boot the game for one device profile. */
function boot(opts) {
  const listeners = {};
  function makeEl(id) {
    const el = {
      id, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      dataset: {}, children: [], firstChild: null, textContent: '', innerHTML: '',
      appendChild(c) { this.children.push(c); return c; },
      remove() {}, addEventListener() {}, removeEventListener() {},
      querySelectorAll() { return []; }, setAttribute() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 320, height: 180 }; },
      /* index.html hardcodes width="320" height="180" — the browser default
         the game MUST override on boot. */
      width: 320, height: 180, href: ''
    };
    el.getContext = () => makeCtx2d(el);
    return el;
  }
  const els = {};
  function getEl(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; }

  function makeCtx2d(canvas) {
    const grad = { addColorStop() {} };
    return new Proxy({
      canvas,
      createLinearGradient: () => grad,
      createRadialGradient: () => grad,
      getImageData: () => ({ data: [] }),
      measureText: () => ({ width: 10 })
    }, { get(t, k) { return (k in t) ? t[k] : () => {}; }, set() { return true; } });
  }

  const store = {};
  const timers = [];
  /* NB: the module loader aliases `window = this`, so the window API must be
     real globals on the sandbox — not a nested `sandbox.window` object. */
  const sandbox = {
    console, Math, Date, JSON, Object, Array, Set, Map, String, Number, Boolean,
    parseInt, parseFloat, isNaN, isFinite,
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    setInterval: () => 0, clearInterval() {},
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    navigator: {
      maxTouchPoints: opts.touch ? 5 : 0,
      vibrate() {},
      userAgent: 'node-test'
    },
    document: {
      getElementById: getEl,
      createElement: (tag) => makeEl(tag),
      addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
      body: makeEl('body'),
      hidden: false
    },
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener() {},
    innerWidth: opts.w, innerHeight: opts.h,
    matchMedia: () => ({ matches: !!opts.touch }),
    AudioContext: undefined,
    devicePixelRatio: 1
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const dir = path.join(__dirname, '..', 'js');
  /* main.js IS loaded here — that is the whole point of this test. */
  const files = ['core.js', 'icons.js', 'characters.js', 'audio.js', 'input.js', 'save.js',
    'player.js', 'weapons.js', 'enemies.js', 'bosses.js', 'pickups.js', 'upgrades.js',
    'ui.js', 'game.js', 'main.js'];
  for (const f of files) {
    vm.runInContext('window = this; globalThis = this;', sandbox, { filename: '_alias.js' });
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f });
  }
  return { sandbox, canvas: getEl('game'), listeners, getEl, flushTimers: () => { const t = timers.splice(0); t.forEach(fn => fn()); } };
}

function state(env) {
  return vm.runInContext(
    '({ vw: NS.VIEW_W, vh: NS.VIEW_H, portrait: NS.portrait, ' +
    '  cw: document.getElementById("game").width, ch: document.getElementById("game").height })',
    env.sandbox);
}

/* Where does the player actually land in the canvas buffer? */
function playerScreenPos(env) {
  env.sandbox.NS.Game.newRun(false);
  /* let the follow lerp settle */
  for (let i = 0; i < 120; i++) { env.sandbox.NS.Game.update(1 / 60); env.sandbox.NS.Input.endFrame(); }
  return vm.runInContext(
    '({ x: NS.Game.player.x - NS.Game.camX, y: NS.Game.player.y - NS.Game.camY })',
    env.sandbox);
}

function runCase(label, opts, wantPortrait, wantW, wantH, wantYFrac) {
  console.log('\n' + label);
  const env = boot(opts);
  const s = state(env);
  check('orientation detected correctly', s.portrait === wantPortrait,
    'portrait=' + s.portrait + ' expected ' + wantPortrait);
  check('virtual res correct', s.vw === wantW && s.vh === wantH,
    s.vw + 'x' + s.vh + ' expected ' + wantW + 'x' + wantH);
  check('canvas backing store matches virtual res (no stale 320x180)',
    s.cw === s.vw && s.ch === s.vh,
    'canvas ' + s.cw + 'x' + s.ch + ' vs view ' + s.vw + 'x' + s.vh);

  /* Where the player SHOULD sit: landscape = dead center (0.5);
     portrait = horizontally centered, vertically MIDDLE-LOW (0.62).
     The 0.62 offset is the owner's Android readability request: more sky
     above (see incoming swarms), thumbs + HUD own the bottom. */
  const wantY = wantYFrac !== undefined ? wantYFrac : 0.5;
  const p = playerScreenPos(env);
  const offX = Math.abs(p.x - s.vw / 2), offY = Math.abs(p.y - s.vh * wantY);
  check('player at x-center, y=' + Math.round(wantY * 100) + '% of view',
    offX < 1 && offY < 1,
    'player at ' + p.x.toFixed(1) + ',' + p.y.toFixed(1) +
    ' want ' + (s.vw / 2).toFixed(1) + ',' + (s.vh * wantY).toFixed(1) +
    ' (off by ' + offX.toFixed(1) + ',' + offY.toFixed(1) + 'px)');
  return env;
}

/* --- the reported case: PC / phone held landscape --- */
runCase('CASE 1: desktop landscape (1280x720, not touch)', { w: 1280, h: 720, touch: false }, false, 448, 252);
runCase('CASE 2: phone landscape (844x390, touch)', { w: 844, h: 390, touch: true }, false, 448, 252);
runCase('CASE 3: phone portrait (390x844, touch) — player middle-low', { w: 390, h: 844, touch: true }, true, 252, 448, 0.62);

/* --- mid-run rotation must not leave the player misplaced --- */
console.log('\nCASE 4: rotate mid-run portrait -> landscape');
{
  const env = boot({ w: 390, h: 844, touch: true });
  vm.runInContext('NS.Game.newRun(false);', env.sandbox);
  for (let i = 0; i < 60; i++) { env.sandbox.NS.Game.update(1 / 60); env.sandbox.NS.Input.endFrame(); }
  /* simulate the phone rotating + the browser firing orientationchange */
  env.sandbox.innerWidth = 844; env.sandbox.innerHeight = 390;
  (env.listeners.orientationchange || []).forEach(fn => fn());
  env.flushTimers(); /* main.js debounces the flip by 120ms */
  const s = state(env);
  check('flipped to landscape res', s.vw === 448 && s.vh === 252, s.vw + 'x' + s.vh);
  check('canvas resized with it', s.cw === 448 && s.ch === 252, s.cw + 'x' + s.ch);
  const p = vm.runInContext('({ x: NS.Game.player.x - NS.Game.camX, y: NS.Game.player.y - NS.Game.camY })', env.sandbox);
  check('player re-centered after flip', Math.abs(p.x - 224) < 1 && Math.abs(p.y - 126) < 1,
    'player at ' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ' expected 224,126');
}

console.log('\n' + (fails ? '--- ' + fails + ' CHECK(S) FAILED ---' : '--- ALL ORIENTATION TESTS PASSED ---'));
process.exit(fails ? 1 : 0);
