/* Headless smoke test for NEONSWARM — stub DOM, load modules, sim a run. */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

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

/* ---------- Stub canvas render context ---------- */
vm.runInContext(`
  NS.ctx = (function () {
    const grad = { addColorStop() {} };
    const base = {
      createLinearGradient: () => grad,
      createRadialGradient: () => grad
    };
    return new Proxy(base, {
      get(t, k) { if (k in t) return t[k]; return () => {}; },
      set() { return true; }
    });
  })();
  NS.VIEW_W = 320; NS.VIEW_H = 180;
`, sandbox);

/* ---------- Boot game ---------- */
vm.runInContext(`
  NS.settings = NS.Save.loadSettings();
  NS.stats = NS.Save.load();
  NS.Mobile = { isTouch: false };
  NS.Game.newRun(false);
  if (NS.Game.mode !== 'play') throw new Error('run did not start');
`, sandbox);

/* ---------- Kiting bot: move in circles, pick drafts, survive ---------- */
function sim(seconds, opts) {
  const o = opts || {};
  const step = 1 / 30;
  let simT = 0;
  let lastLog = 0;
  while (simT < seconds && sandboxNS().Game.mode === 'play') {
    vm.runInContext(`
      (function () {
        const p = NS.Game.player;
        const t = NS.Game.state.time;
        /* kiting bot: circle strafe */
        const a = t * 1.1;
        NS.Input.joy.x = Math.cos(a); NS.Input.joy.y = Math.sin(a); NS.Input.joy.active = true;
        NS.Game.update(${step.toFixed(6)});
        NS.Input.endFrame();
        /* auto-pick draft (prefer new weapons, then wlevel, then passive) */
        if (NS.Game.mode === 'draft' || NS.Upgrades.open) {
          const c = NS.Upgrades.choices;
          let idx = 0;
          for (let i = 0; i < c.length; i++) {
            if (c[i].type === 'wnew') { idx = i; break; }
            if (c[i].type === 'wlevel') { idx = i; break; }
          }
          NS.Upgrades.pick(idx);
        }
      })();
    `, sandbox);
    simT += step;
    const st = sandboxNS().Game.state;
    if (st && simT - lastLog >= 60) {
      lastLog = simT;
      const p = sandboxNS().Game.player;
      console.log(`  t=${Math.floor(simT / 60)}:${String(Math.floor(simT % 60)).padStart(2, '0')} LV${p.level} kills=${st.kills} bosses=${st.bossKills} hp=${Math.ceil(p.hp)}/${p.maxHp} weapons=${Object.keys(st.weapons).length} mode=${sandboxNS().Game.mode}`);
    }
    if (o.stopOnVictory && sandboxNS().Game.state && sandboxNS().Game.state.won) break;
  }
  return simT;
}
function sandboxNS() { return vm.runInContext('NS', sandbox); }

console.log('--- Phase 1: normal 15:00 run (bot) ---');
const t1 = sim(930, { stopOnVictory: true });
const st = sandboxNS().Game.state;
const p = sandboxNS().Game.player;
console.log(`Bot result: t=${Math.floor(t1 / 60)}:${String(Math.floor(t1 % 60)).padStart(2, '0')} mode=${sandboxNS().Game.mode} won=${st.won} kills=${st.kills} bosses=${st.bossKills} LV=${p.level} weapons=${JSON.stringify(Object.keys(st.weapons))} overcharge=${st.overcharge || 0}`);

console.log('--- Phase 2: new weapons fired? ---');
vm.runInContext(`
  const fired = { prism: false, missiles: false };
  /* check weapon states got exercise markers via run state (cd values changed) */
  const s = NS.Game.state;
  if (s.weapons.prism) fired.prism = true;
  if (s.weapons.missiles) fired.missiles = true;
  NS._newWeapons = fired;
`, sandbox);
const nw = vm.runInContext('NS._newWeapons', sandbox);
console.log('New weapon drafts acquired:', JSON.stringify(nw), '(draft RNG may or may not offer them — info only)');

console.log('--- Phase 3: endless abyss run (god mode) ---');
vm.runInContext(`
  NS.Game.newRun(true);
  NS.Game.state.time = 895;
  const p = NS.Game.player;
  p.maxHp = 999999; p.hp = 999999; p.armor = 9999;
  /* strong build: pulse LV8 + blades LV8 */
  NS.Game.state.weapons.pulse = { lvl: 8, cd: 0 };
  NS.Game.state.weapons.blades = { lvl: 8, cd: 0 };
  NS.Game.state.weapons.nova = { lvl: 8, cd: 0 };
`, sandbox);
sim(70);
vm.runInContext(`
  NS._abyss = {
    depth: NS.Game.state.abyssDepth || 0,
    mode: NS.Game.mode,
    omegaSpawned: NS.Bosses.active && NS.Bosses.active.def.final,
    bossName: NS.Bosses.active ? NS.Bosses.active.name : 'none',
    nextAt: NS.Bosses.nextAt
  };
`, sandbox);
console.log('Abyss:', JSON.stringify(vm.runInContext('NS._abyss', sandbox)));

console.log('--- Phase 4: meteor hazard (god mode, t=4:10 window) ---');
vm.runInContext(`
  NS.Game.newRun(false);
  NS.Game.state.time = 250;
  const pm = NS.Game.player;
  pm.maxHp = 999999; pm.hp = 999999; pm.armor = 9999;
  NS._meteorSeen = 0;
  for (let i = 0; i < 600; i++) {
    NS.Game.update(1/30);
    NS._meteorSeen += NS.Game.meteors.length;
    NS.Input.endFrame();
  }
  NS._meteorFired = NS._meteorSeen > 0;
`, sandbox);
console.log('Meteors spawned after 4:00:', vm.runInContext('NS._meteorFired', sandbox));

console.log('--- Phase 5: new bosses reachable? ---');
vm.runInContext(`
  NS._bossOrder = NS.Bosses.BOSSES.map(b => b.id).join(',');
`, sandbox);
console.log('Boss roster:', vm.runInContext('NS._bossOrder', sandbox));

console.log('--- Phase 6: draft variety (LV8 pulse) ---');
vm.runInContext(`
  (function () {
    NS.Game.newRun(false);
    const pl = NS.Game.player;
    pl.maxHp = 999999; pl.hp = 999999; pl.armor = 9999;
    NS.Game.state.weapons.pulse = { lvl: 8, cd: 0 };
    NS.Game.state.passives.dmg = 1;
    NS.Weapons.recomputeMods();
    /* a maxed weapon still drafts: new weapons + passives stay live */
    const d = NS.Weapons.rollDraft();
    NS._draftKinds = d ? d.map(c => c.type) : [];
    const k0 = NS.Game.state.kills;
    for (let i = 0; i < 240; i++) {
      NS.Game.update(1/30);
      NS.Input.endFrame();
      if (NS.Game.mode === 'draft' || NS.Upgrades.open) NS.Upgrades.pick(0);
    }
    NS._killsGrew = NS.Game.state.kills > k0;
    NS._pulseName = NS.Weapons.effectiveDef('pulse').name;
  })();
`, sandbox);
console.log('Draft at max pulse:', JSON.stringify(vm.runInContext('NS._draftKinds', sandbox)),
  '| kills grew:', vm.runInContext('NS._killsGrew', sandbox),
  '| weapon:', vm.runInContext('NS._pulseName', sandbox));

console.log('--- Phase 7: goblin + meta systems ---');
vm.runInContext(`
  (function () {
    /* goblin spawns, flees, can be caught (gate: after 1:00) */
    NS.Game.newRun(false);
    NS.Game.state.time = 70;
    const gp = NS.Game.player;
    gp.maxHp = 999999; gp.hp = 999999; gp.armor = 9999;
    NS.Pickups.goblinCd = 0.1;
    let seen = false;
    for (let i = 0; i < 300; i++) {
      NS.Game.update(1/30);
      if (NS.Pickups.goblin) seen = true;
      NS.Input.endFrame();
    }
    NS._goblinSeen = seen;
    /* meta: cores + rank computed from stats */
    NS.stats.totalKills = 3000; NS.stats.wins = 2; NS.stats.best.abyssDepth = 4; NS.stats.best.bossKills = 8;
    NS._cores = NS.Save.cores();
    NS._rank = NS.Save.rank();
    NS._bonuses = JSON.stringify(NS.Save.metaBonuses());
  })();
`, sandbox);
console.log('Goblin appeared:', vm.runInContext('NS._goblinSeen', sandbox),
  '| cores:', vm.runInContext('NS._cores', sandbox),
  '| rank:', vm.runInContext('NS._rank', sandbox),
  '| bonuses:', vm.runInContext('NS._bonuses', sandbox));

console.log('--- Phase 8: character select ---');
vm.runInContext(`
  (function () {
    NS.Characters.select(2); /* WRAITH */
    NS.Game.newRun(false);
    const ch = NS.Characters.current();
    NS._charOk = NS.Game.state.weapons.ghost !== undefined &&
                 NS.Game.state.critChance > 0.05 &&
                 NS.Game.state.dmgMult === 1;
    NS._charName = ch.name;
  })();
`, sandbox);
console.log('Char select:', vm.runInContext('NS._charName', sandbox),
  '| starting weapon + quirk applied:', vm.runInContext('NS._charOk', sandbox));

console.log('--- Phase 9: GLOBAL weapon passives (affect ALL weapons) ---');
/* (kept: global passives remain the build-diversity mechanism) */
vm.runInContext(`
  (function () {
    NS.Game.newRun(false);
    const s = NS.Game.state;
    s.weapons.pulse = { lvl: 8, cd: 0 };
    s.weapons.frost = { lvl: 5, cd: 0 };
    NS.Weapons.recomputeMods();

    const before = NS.Game.spawnBullet.length;
    /* OVERCLOCK CORE = attack speed on every weapon */
    NS.Upgrades.choices = [{ type: 'passive', id: 'haste', lvl: 1 }];
    NS.Upgrades.open = true; NS.Upgrades.pick(0);
    NS._hasteCd = s.cdMult;

    /* every projectile spawned now inherits the global mods */
    const p = NS.Game.player;
    NS.Game.spawnBullet(p.x, p.y, 0, 100, 10, 't', '#fff', 2, 2, { pierce: 0 });
    const b = NS.Game.bullets[NS.Game.bullets.length - 1];
    NS._spd = Math.round(Math.hypot(b.vx, b.vy));
    NS._baseSpd = 100;
    NS._pierce0 = b.pierce;

    /* LANCE PROTOCOL adds pierce to everything */
    NS.Upgrades.choices = [{ type: 'passive', id: 'pierce', lvl: 1 }];
    NS.Upgrades.open = true; NS.Upgrades.pick(0);
    NS.Game.spawnBullet(p.x, p.y, 0, 100, 10, 't', '#fff', 2, 2, { pierce: 0 });
    const b2 = NS.Game.bullets[NS.Game.bullets.length - 1];
    NS._pierce1 = b2.pierce;

    /* BLAST SHAPE scales size globally */
    NS.Upgrades.choices = [{ type: 'passive', id: 'area', lvl: 1 }];
    NS.Upgrades.open = true; NS.Upgrades.pick(0);
    NS.Game.spawnBullet(p.x, p.y, 0, 100, 10, 't', '#fff', 2, 2, {});
    const b3 = NS.Game.bullets[NS.Game.bullets.length - 1];
    NS._size = b3.size;

    NS._mods = s.mods;
    NS._frostStillWorks = !!NS.Weapons.DEFS.frost.fire; /* other weapons untouched */
  })();
`, sandbox);
console.log('haste -> cdMult:', vm.runInContext('NS._hasteCd', sandbox).toFixed(3),
  '| proj speed:', vm.runInContext('NS._spd', sandbox), '(base 100)',
  '| pierce:', vm.runInContext('NS._pierce0', sandbox), '->', vm.runInContext('NS._pierce1', sandbox),
  '| size:', vm.runInContext('NS._size', sandbox).toFixed(2), '(base 2)');

console.log('--- ALL SMOKE TESTS DONE ---');
