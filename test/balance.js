/* Balance probe for NEONSWARM. Two separate questions, two separate methods.

   Q1 "is the game harder than before?"
       A/B the same dumb kiting bot against the OLD difficulty curve and the
       NEW one, in the same process, with the same seed discipline. The only
       thing that changes is Enemies.difficulty().

   Q2 "how hard does each weapon actually hit?"
       A DPS probe: god mode, one weapon at LV8 vs one immortal dummy parked
       in range. Survival cannot rank weapons because a weak bot dies long
       before any weapon reaches max level.

   The bot never aims, never dodges and never uses a movement skill, so these
   are floors, not skill ceilings. Read the numbers, don't read them as
   "the game is balanced".

   usage: node test/balance.js [trials]
*/
'use strict';
const { createHarness } = require('./harness.js');
const { vm, sandbox } = createHarness();

const TRIALS = parseInt(process.argv[2], 10) || 8;
const STEP = 1 / 30;
const CAP = 930; /* 15:30 */

vm.runInContext(`
  NS.settings = NS.Save.loadSettings();
  NS.stats = NS.Save.load();
  NS.Mobile = { isTouch: false };
  NS.VIEW_W = 320; NS.VIEW_H = 180;
  NS.ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: () => true });

  /* the curve as it was before the 2026-09-27 difficulty raise */
  NS.DIFF_OLD = function (t) {
    const ab = (NS.Game.state && NS.Game.state.abyssMult) || 1;
    return {
      hp: (1 + (t / 60) * 0.42 + Math.pow(t / 60, 1.6) * 0.06) * ab,
      dmg: (1 + (t / 60) * 0.12) * Math.sqrt(ab),
      spd: 1 + Math.min(0.5, (t / 60) * 0.045)
    };
  };
`, sandbox);

const botStep = `
  (function () {
    const t = NS.Game.state.time;
    const a = t * 1.1;
    NS.Input.joy.x = Math.cos(a); NS.Input.joy.y = Math.sin(a); NS.Input.joy.active = true;
    NS.Game.update(${STEP.toFixed(6)});
    NS.Input.endFrame();
    if (NS.Game.mode === 'draft' || NS.Upgrades.open) {
      const c = NS.Upgrades.choices;
      if (c && c.length) {
        let idx = 0;
        for (let i = 0; i < c.length; i++) {
          if (c[i].type === 'wnew') { idx = i; break; }
          if (c[i].type === 'wlevel') { idx = i; break; }
        }
        NS.Upgrades.pick(idx);
      }
    }
  })();
`;

function mmss(t) { return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
function median(a) { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }
function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }

/* ---------------- Q1: survival A/B ---------------- */
/* snapshot both curves up front so overwriting is safe */
vm.runInContext('NS.DIFF_NEW = NS.Enemies.difficulty;', sandbox);

function runSurvival(curveKey, trials) {
  vm.runInContext(`NS.Enemies.difficulty = NS.DIFF_${curveKey.toUpperCase()};`, sandbox);
  const out = [];
  for (let i = 0; i < trials; i++) {
    vm.runInContext('NS.Game.newRun(false);', sandbox);
    let t = 0;
    while (t < CAP) {
      vm.runInContext(botStep, sandbox);
      t += STEP;
      if (vm.runInContext('NS.Game.mode', sandbox) !== 'play') break;
    }
    out.push(vm.runInContext('({t: NS.Game.state.time, k: NS.Game.state.kills, lv: NS.Game.player.level})', sandbox));
  }
  return out;
}

console.log('NEONSWARM balance probe — ' + TRIALS + ' trials, ' + mmss(CAP) + ' cap');
console.log('bot: circles at constant speed, never aims, never dodges. Floor, not ceiling.');
console.log('');

const oldRuns = runSurvival('old', TRIALS);
const newRuns = runSurvival('new', TRIALS);

function report(label, runs) {
  const ts = runs.map(r => r.t);
  console.log(label);
  console.log('  survival : ' + ts.map(mmss).join('  '));
  console.log('  median   : ' + mmss(median(ts)) + '   mean ' + mmss(mean(ts)) +
              '   min ' + mmss(Math.min(...ts)) + '   max ' + mmss(Math.max(...ts)));
  console.log('  kills    : median ' + median(runs.map(r => r.k)) + '   level: median ' + median(runs.map(r => r.lv)));
  console.log('');
}
report('OLD difficulty curve (pre-2026-09-27)', oldRuns);
report('NEW difficulty curve (shipped)', newRuns);

const oM = median(oldRuns.map(r => r.t));
const nM = median(newRuns.map(r => r.t));
const oK = median(oldRuns.map(r => r.k));
const nK = median(newRuns.map(r => r.k));
console.log('Q1  IS IT HARDER?');
console.log('  median survival ' + mmss(oM) + ' -> ' + mmss(nM) +
            '  (' + ((nM / oM - 1) * 100).toFixed(0) + '%)');
console.log('  median kills    ' + oK + ' -> ' + nK + '  (' + ((nK / oK - 1) * 100).toFixed(0) + '%)');
console.log('  ' + (nM < oM && nK < oK
  ? 'YES — survival and kill count both dropped. The curve is genuinely harder.'
  : 'MIXED — one of survival/kills went up. Re-check the curve.'));
console.log('');

/* ---------------- Q2: single-target DPS per weapon ---------------- */
console.log('Q2  SINGLE-TARGET DPS PER WEAPON  (one immortal dummy, stationary player, 20s)');

/* Pure single-target DPS against one immortal dummy parked a fixed distance
   from a STATIONARY player. This is the only measurement that isolates weapon
   power: no positioning, no aim drift, no AoE overlap, no multi-target
   spread. A wave-clear test punishes fast single-target weapons and flatters
   AoE ones, so read it as one axis of many. */
const dpsProbe = vm.runInContext(`
  (function () {
    const cases = {};
    const FRAMES = 20 * 30;                        /* 20s */
    for (const id of Object.keys(NS.Weapons.DEFS)) {
      NS.Game.newRun(false);
      const s = NS.Game.state, p = NS.Game.player;
      p.maxHp = 1e9; p.hp = 1e9; p.armor = 1e9;
      p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
      s.weapons = {};
      s.weapons[id] = { lvl: NS.Weapons.DEFS[id].maxLvl, cd: 0 };
      s.passives = {};

      /* clean slate: leftover enemies/projectiles from the previous case
         were leaking across measurements and skewing the numbers */
      NS.Enemies.list.length = 0;
      NS.Game.bullets.length = 0;
      NS.Game.homing.length = 0;
      NS.Game.mines.length = 0;
      NS.Game.enemyBullets.length = 0;
      NS.Pickups.gems.length = 0;
      NS.Pickups.hearts.length = 0;
      NS.Grid.clear();
      NS.Input.joy.x = 0; NS.Input.joy.y = 0; NS.Input.joy.active = false;

      const diff = NS.Enemies.difficulty(0);
      const dummy = NS.Enemies.spawn('brute', false, diff);
      dummy.hp = dummy.maxHp = 1e9;
      dummy.x = 40; dummy.y = 0;                  /* close, in every weapon's range */
      let dealt = 0, lost = 0;
      for (let f = 0; f < FRAMES; f++) {
        NS.Input.joy.x = 0; NS.Input.joy.y = 0; NS.Input.joy.active = false;
        const before = dummy.dead ? 0 : dummy.hp;
        NS.Game.update(1 / 30);
        NS.Input.endFrame();
        if (!dummy.dead) dealt += Math.max(0, before - dummy.hp);
        /* keep it alive and parked so every frame is comparable */
        if (NS.Enemies.list.indexOf(dummy) < 0) { lost++; }
        dummy.hp = 1e9; dummy.x = 40; dummy.y = 0;
      }
      if (lost) console.error('  WARNING: dummy left the wave ' + lost + 'x during ' + id);
      cases[id] = { dps: Math.round(dealt / 20) };  /* per second */
    }
    return cases;
  })()
`, sandbox);

const rows = Object.keys(dpsProbe).map(id => [id, dpsProbe[id].dps]);
rows.sort((a, b) => b[1] - a[1]);
console.log('  weapon       single-target DPS (LV8, no passives)');
for (const [id, dps] of rows) {
  console.log('  ' + id.padEnd(10) + String(dps).padStart(8));
}
const dpsVals = rows.map(r => r[1]).filter(x => x > 0);
console.log('');
console.log('  median ' + median(dpsVals) + '   best ' + Math.max(...dpsVals) +
            '   zero/aura ' + rows.filter(r => r[1] === 0).map(r => r[0]).join(',') || '-');
console.log('');
console.log('  NOTE: single-target DPS flatters fast single-hit weapons and');
console.log('  under-rates pierce/AoE/aura ones. Crowd value is unmeasured here.');
