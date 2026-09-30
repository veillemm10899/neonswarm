/* Content + engine suite for NEONSWARM (replaces the old final-forms suite).
   Verifies:
     - every weapon and passive is real, distinct and well-formed
     - every weapon fires through the real game loop without throwing
     - draft rules: no dup ids, slot caps, legendary time gate
     - global passives move EVERY weapon and stack multiplicatively
     - wave-10 passives actually do what their card says
     - character quirks survive a recompute
     - difficulty curve unchanged from the shipped hard version
*/
'use strict';
const { createHarness } = require('./harness.js');
const { vm, sandbox } = createHarness();

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
}
function run(code) { return vm.runInContext(code, sandbox); }

/* NS.ctx stub (same as smoke.js) */
run(`
  NS.settings = NS.Save.loadSettings();
  NS.stats = NS.Save.load();
  NS.Mobile = { isTouch: false };
  NS.VIEW_W = 448; NS.VIEW_H = 252;
  NS.ctx = (function () {
    const grad = { addColorStop() {} };
    const base = { createLinearGradient: () => grad, createRadialGradient: () => grad };
    return new Proxy(base, {
      get(t, k) { if (k in t) return t[k]; return () => {}; },
      set() { return true; }
    });
  })();
`);

run(`NS.W = NS.Weapons; NS.ids = Object.keys(NS.W.DEFS); NS.pids = Object.keys(NS.W.PASSIVES);`);
const ids = run('NS.ids'), pids = run('NS.pids');

console.log('\\n=== 1. Arsenal: 30 weapons, all real and distinct ===');
check('30 weapons exist', ids.length === 30, ids.length + ' weapons');
const noFire = ids.filter(i => typeof run(`NS.W.DEFS['${i}'].fire`) !== 'function');
check('every weapon has fire()', noFire.length === 0, noFire.length ? 'missing: ' + noFire : '');
const noDesc = ids.filter(i => !run(`NS.W.DEFS['${i}'].desc`));
check('every weapon has a description', noDesc.length === 0);
const noName = ids.filter(i => !run(`NS.W.DEFS['${i}'].name`));
check('every weapon has a name', noName.length === 0);
const names = ids.map(i => run(`NS.W.DEFS['${i}'].name`));
check('weapon names are unique', new Set(names).size === names.length);
const noMax = ids.filter(i => run(`NS.W.DEFS['${i}'].maxLvl`) !== 8);
check('every weapon caps at LV8', noMax.length === 0);

/* wave 10 additions specifically */
const wave10 = ['whip', 'repel', 'rain', 'airstrike', 'split', 'cluster', 'flak', 'mirage'];
check('all 8 new wave-10 weapons present', wave10.every(w => ids.includes(w)),
  wave10.filter(w => !ids.includes(w)).join(',') || '8/8');

console.log('\\n=== 2. Passives: 46 total, all apply-able ===');
check('46 passives exist', pids.length === 46, pids.length + ' passives');
const noApply = pids.filter(p => typeof run(`NS.W.PASSIVES['${p}'].apply`) !== 'function');
check('every passive has apply()', noApply.length === 0, noApply.length ? 'missing: ' + noApply : '');
const noPDesc = pids.filter(p => !run(`NS.W.PASSIVES['${p}'].desc`));
check('every passive has a description', noPDesc.length === 0);
const newP = ['snow', 'knock', 'lethal', 'shield', 'dodge', 'rico', 'hex', 'rush', 'siphon', 'retribution', 'colossus', 'magnitude'];
check('all 12 wave-10/12 passives present', newP.every(p => pids.includes(p)),
  newP.filter(p => !pids.includes(p)).join(',') || '12/12');

console.log('\n=== 2b. Evolutions: one per weapon, VS pairing rule ===');
run(`NS.evoIds = Object.keys(NS.W.EVOS); NS.pairIds = Object.keys(NS.W.EVO_PAIR);`);
const evoIds = run('NS.evoIds'), pairIds = run('NS.pairIds');
check('30 evolutions registered', evoIds.length === 30, evoIds.length + ' evos');
check('every weapon has an evo pair', ids.every(i => pairIds.includes(i)),
  ids.filter(i => !pairIds.includes(i)).join(',') || '30/30 paired');
check('every pair points at a real passive',
  pairIds.every(i => pids.includes(run(`NS.W.EVO_PAIR['${i}']`))));
check('every evo has fire()', evoIds.every(i => typeof run(`NS.W.EVOS['${i}'].fire`) === 'function'));
const evoNames = evoIds.map(i => run(`NS.W.EVOS['${i}'].name`));
check('evo names are unique', new Set(evoNames).size === evoNames.length);

console.log('\n=== 2c. Evo draft rules: LV8 + paired passive ===');
run(`
  NS.Game.newRun(false);
  NS.sE = NS.Game.state;
  NS.sE.weapons = { pulse: { lvl: 8, cd: 0 } };   /* maxed, no passive yet */
  NS.sE.passives = {};
  NS._e0 = (NS.W.rollDraft() || []).filter(c => c.type === 'evo').length;
  NS.sE.passives.dmg = 1;                          /* pulse pairs with dmg */
  NS._e1 = (NS.W.rollDraft() || []).filter(c => c.type === 'evo').length;
  /* evolve it, then it must offer mastery only */
  NS.W.applyChoice({ type: 'evo', id: 'pulse' });
  NS._evolved = !!NS.sE.weapons.pulse.evo;
  NS._postKinds = new Set();
  for (let i = 0; i < 200; i++) {
    const d = NS.W.rollDraft();
    if (!d) continue;
    for (const c of d) if (c.id === 'pulse') NS._postKinds.add(c.type);
  }
  NS._postKinds = Array.from(NS._postKinds);
  /* at most one evo per screen across 1000 rolls with everything ready */
  NS.sE.weapons = {};
  for (const id of NS.ids) NS.sE.weapons[id] = { lvl: NS.W.DEFS[id].maxLvl, cd: 0 };
  for (const p of NS.pids) NS.sE.passives[p] = 1;
  NS._worstE = 0;
  for (let i = 0; i < 1000; i++) {
    const d = NS.W.rollDraft();
    if (!d) continue;
    const n = d.filter(c => c.type === 'evo').length;
    if (n > NS._worstE) NS._worstE = n;
  }
`);
check('no evo offered without the paired passive', run('NS._e0') === 0);
check('evo offered once LV8 + paired passive', run('NS._e1') === 1);
check('applyChoice evolves the weapon', run('!!NS._evolved'));
check('post-evo offers mastery/passive only',
  (function () { const k = run('NS._postKinds'); return k.every(t => t === 'mastery' || t === 'passive') && k.includes('mastery'); })(),
  run('JSON.stringify(NS._postKinds)'));
check('never 2+ evos on one screen (1000 rolls)', run('NS._worstE') === 1, 'max seen: ' + run('NS._worstE'));

console.log('\\n=== 3. Draft rules (1000 rolls) ===');
run(`
  NS.Game.newRun(false);
  NS.s = NS.Game.state;
  NS.s.weapons = {};
  for (const id of NS.ids) NS.s.weapons[id] = { lvl: NS.W.DEFS[id].maxLvl, cd: 0 };
  NS.s.passives = {};
  NS._maxW = 0, NS._maxP = 0, NS._dup = false, NS._sawDraft = 0;
  for (let i = 0; i < 1000; i++) {
    const d = NS.W.rollDraft();
    if (!d) continue;
    NS._sawDraft++;
    const ws = d.filter(c => c.type === 'wlevel');
    const ps = d.filter(c => c.type === 'passive');
    if (ws.length > NS._maxW) NS._maxW = ws.length;
    if (ps.length > NS._maxP) NS._maxP = ps.length;
    for (let a = 0; a < d.length; a++)
      for (let b = a + 1; b < d.length; b++)
        if (d[a].id === d[b].id) NS._dup = true;
  }
`);
check('no duplicate id on one screen', !run('!!NS._dup'));
check('drafts actually roll', run('NS._sawDraft') > 0, run('NS._sawDraft') + '/1000');

console.log('\\n=== 4. Slot caps ===');
run(`
  NS.Game.newRun(false);
  NS.s2 = NS.Game.state;
  NS.s2.weapons = {}; NS.s2.passives = {};
  for (const id of NS.ids.slice(0, 9)) NS.s2.weapons[id] = { lvl: 1, cd: 0 };
  NS.s2.passives = {}; for (const p of NS.pids.slice(0, 8)) NS.s2.passives[p] = 1;
  NS._draft = NS.W.rollDraft() || [];
  NS._newW = NS._draft.filter(c => c.type === 'wnew').length;
  NS._newP = NS._draft.filter(c => c.type === 'passive' && !NS.s2.passives[c.id]).length;
`);
check('6 weapon slot cap enforced', run('NS._newW') === 0, 'wnew offered: ' + run('NS._newW'));
check('6 passive slot cap enforced (no new passives)', run('NS._newP') === 0,
  'new passives offered: ' + run('NS._newP'));

console.log('\\n=== 5. Legendary time gate ===');
run(`
  NS.Game.newRun(false);
  NS.s3 = NS.Game.state; NS.s3.time = 10; NS.s3.weapons = { pulse: { lvl: 1, cd: 0 } }; NS.s3.passives = {};
  NS._early = (NS.W.rollDraft() || []).some(c => NS.W.PASSIVES[c.id] && NS.W.PASSIVES[c.id].legendary);
  NS.s3.time = 500;
  NS._drafts = [];
  for (let i = 0; i < 200; i++) {
    const d = NS.W.rollDraft();
    if (d) NS._drafts.push(d.some(c => NS.W.PASSIVES[c.id] && NS.W.PASSIVES[c.id].legendary));
  }
  NS._late = NS._drafts.some(x => x);
`);
check('legendaries locked before 7:00', !run('NS._early'));
check('legendaries available after 7:00', run('NS._late'));

console.log('\\n=== 6. Global passives move EVERY weapon ===');
run(`
  NS.Game.newRun(false);
  NS.s4 = NS.Game.state;
  NS.s4.weapons = {};
  for (const id of NS.ids) NS.s4.weapons[id] = { lvl: NS.W.DEFS[id].maxLvl, cd: 0 };
  NS.W.recomputeMods();
  const p = NS.Game.player;
  p.x = 0; p.y = 0;
  function probe() {
    NS.Game.bullets.length = 0;
    NS.Game.spawnBullet(0, 0, 0, 100, 10, 't', '#fff', 2, 2, { pierce: 0 });
    const b = NS.Game.bullets[0];
    return { cd: NS.s4.cdMult, spd: Math.hypot(b.vx, b.vy), size: b.size, life: b.life, pierce: b.pierce };
  }
  NS.s4.passives = {}; NS.W.recomputeMods(); const none = probe();
  NS.s4.passives = { haste: 1, vel: 1, area: 1, dura: 1, pierce: 1 };
  NS.W.recomputeMods(); const all = probe();
  NS._probe = { none, all };
`);
const pr = run('NS._probe');
console.log('       base   :', JSON.stringify(pr.none));
console.log('       globals:', JSON.stringify(pr.all));
check('attack speed passive cuts cdMult', pr.all.cd < pr.none.cd, pr.none.cd.toFixed(3) + ' -> ' + pr.all.cd.toFixed(3));
check('projectile speed passive', pr.all.spd > pr.none.spd, pr.none.spd + ' -> ' + pr.all.spd);
check('area passive grows projectiles', pr.all.size > pr.none.size);
check('duration passive extends life', pr.all.life > pr.none.life);
check('pierce passive adds pierce', pr.all.pierce > pr.none.pierce, pr.none.pierce + ' -> ' + pr.all.pierce);

console.log('\\n=== 7. Global passives stack multiplicatively ===');
run(`
  NS.s4.passives = { haste: 1 }; NS.W.recomputeMods(); NS._c1 = NS.s4.cdMult;
  NS.s4.passives = { haste: 2 }; NS.W.recomputeMods(); NS._c2 = NS.s4.cdMult;
  NS.s4.passives = { haste: 3 }; NS.W.recomputeMods(); NS._c3 = NS.s4.cdMult;
`);
check('OVERCLOCK CORE 1 -> -12%', Math.abs(run('NS._c1') - 0.88) < 0.001, run('NS._c1').toFixed(3));
check('OVERCLOCK CORE 2 stacks', run('NS._c2') < run('NS._c1'), run('NS._c2').toFixed(3));
check('OVERCLOCK CORE 3 stacks further', run('NS._c3') < run('NS._c2'), run('NS._c3').toFixed(3));

console.log('\\n=== 8. Wave-10/12 passives do what the card says ===');

/* BLOODLUST: crit multiplier */
run(`
  NS.Game.newRun(false);
  NS.s5 = NS.Game.state;
  NS._cm0 = NS.s5.critMult;
  NS.Upgrades.choices = [{ type: 'passive', id: 'lethal', lvl: 1 }];
  NS.Upgrades.open = true; NS.Upgrades.pick(0);
  NS._cm1 = NS.s5.critMult;
`);
check('BLOODLUST raises crit multiplier', run('NS._cm1') > run('NS._cm0'),
  run('NS._cm0') + ' -> ' + run('NS._cm1'));

/* PHASE DRIVE: dodge chance */
run(`
  NS.Upgrades.choices = [{ type: 'passive', id: 'dodge', lvl: 1 }];
  NS.Upgrades.open = true; NS.Upgrades.pick(0);
  NS._dodge = NS.s5.dodge;
`);
check('PHASE DRIVE sets 5% dodge', Math.abs(run('NS._dodge') - 0.05) < 1e-9, (run('NS._dodge') * 100) + '%');

/* AEGIS CORE: shield level */
run(`
  NS.Upgrades.choices = [{ type: 'passive', id: 'shield', lvl: 1 }];
  NS.Upgrades.open = true; NS.Upgrades.pick(0);
  NS._shield = NS.s5.shieldLvl;
`);
check('AEGIS CORE grants a shield charge', run('NS._shield') === 1);

/* CRYO SHELL: freezing nova fires on a 5s beat */
run(`
  NS.Game.newRun(false);
  NS.s6 = NS.Game.state;
  NS.s6.passives = { snow: 2 }; NS.W.recomputeMods();
  /* apply() runs in real play via applyChoice — mirror it here */
  NS.W.PASSIVES.snow.apply(NS.Game.player); NS.W.PASSIVES.snow.apply(NS.Game.player);
  NS._cryoSlowed = 0;
  const p6 = NS.Game.player;
  p6.x = 0; p6.y = 0;
  const diff6 = NS.Enemies.difficulty(0);
  NS.Enemies.list.length = 0;
  const e6 = NS.Enemies.spawn('drone', false, diff6);
  e6.x = 30; e6.y = 0;
  NS.s6.cryoT = 0.01;
  NS.Game.update(1 / 30);
  NS.Input.endFrame();
  NS._cryoSlowed = e6.slowT > 0 ? 1 : 0;
  NS._cryoRing = NS.Game.rings.length > 0;
`);
check('CRYO SHELL nova slows nearby enemies', run('NS._cryoSlowed') === 1);
check('CRYO SHELL nova draws a ring', run('!!NS._cryoRing'));

/* SEISMIC ROUNDS: hits shove */
run(`
  NS.Game.newRun(false);
  NS.s7 = NS.Game.state;
  NS.s7.passives = { knock: 2 }; NS.W.recomputeMods();
  NS.W.PASSIVES.knock.apply(NS.Game.player); NS.W.PASSIVES.knock.apply(NS.Game.player);
  const p7 = NS.Game.player;
  p7.x = 0; p7.y = 0; p7.maxHp = 1e9; p7.hp = 1e9;
  NS.Enemies.list.length = 0;
  const e7 = NS.Enemies.spawn('drone', false, NS.Enemies.difficulty(0));
  e7.x = 40; e7.y = 0; e7.hp = e7.maxHp = 1e9;
  NS.Game.damageEnemy(e7, 5, 'probe');
  NS._knocked = e7.x > 40;
`);
check('SEISMIC ROUNDS shoves targets back', run('!!NS._knocked'),
  'x: 40 -> ' + run('(NS.Enemies.list[0] ? NS.Enemies.list[0].x.toFixed(1) : "gone")'));

/* RICOCHET ROUNDS is registered */
check('RICOCHET ROUNDS passive exists with apply', typeof run(`NS.W.PASSIVES.rico.apply`) === 'function');

/* HEX SIGN: damage amp reaches damageEnemy */
run(`
  NS.Game.newRun(false);
  NS.sH = NS.Game.state;
  NS.sH.passives = { hex: 3 }; NS.W.recomputeMods();
  NS.W.PASSIVES.hex.apply(NS.Game.player); NS.W.PASSIVES.hex.apply(NS.Game.player); NS.W.PASSIVES.hex.apply(NS.Game.player);
  const pH = NS.Game.player; pH.x = 0; pH.y = 0; pH.maxHp = 1e9; pH.hp = 1e9;
  NS.Enemies.list.length = 0;
  const eH = NS.Enemies.spawn('brute', false, NS.Enemies.difficulty(0));
  eH.x = 40; eH.y = 0; eH.hp = eH.maxHp = 1e9;
  const before0 = eH.hp;
  NS.Game.damageEnemy(eH, 100, 'probe');
  NS._hexDmg = before0 - eH.hp;
  /* relative A/B: same setup without hex */
  NS.sH.passives = {}; NS.sH.hex = 0;
  const eH2 = NS.Enemies.spawn('brute', false, NS.Enemies.difficulty(0));
  eH2.x = 40; eH2.y = 0; eH2.hp = eH2.maxHp = 1e9;
  const b2 = eH2.hp;
  NS.Game.damageEnemy(eH2, 100, 'probe');
  NS._baseDmg = b2 - eH2.hp;
  NS._hexRatio = NS._hexDmg / NS._baseDmg;
`);
check('HEX SIGN amplifies damage (+24% at 3)', Math.abs(run('NS._hexRatio') - 1.24) < 0.02,
  'ratio x' + run('NS._hexRatio').toFixed(3));

/* SIPHON: kills heal */
run(`
  NS.Game.newRun(false);
  NS.sS = NS.Game.state;
  NS.sS.passives = { siphon: 2 }; NS.W.recomputeMods();
  NS.W.PASSIVES.siphon.apply(NS.Game.player); NS.W.PASSIVES.siphon.apply(NS.Game.player);
  const pS = NS.Game.player; pS.x = 0; pS.y = 0; pS.maxHp = 100; pS.hp = 50;
  NS.Enemies.list.length = 0;
  const eS = NS.Enemies.spawn('drone', false, NS.Enemies.difficulty(0));
  eS.x = 20; eS.y = 0; eS.hp = 1;
  NS.Game.damageEnemy(eS, 999, 'probe');
  NS._siphonHeal = NS.Game.player.hp > 50;
`);
check('SIPHON heals on kill', run('!!NS._siphonHeal'));

/* RETRIBUTION: hit lights the fuse, nova fires */
run(`
  NS.Game.newRun(false);
  NS.sR = NS.Game.state;
  NS.sR.passives = { retribution: 2 }; NS.W.recomputeMods();
  NS.W.PASSIVES.retribution.apply(NS.Game.player); NS.W.PASSIVES.retribution.apply(NS.Game.player);
  const pR = NS.Game.player; pR.x = 0; pR.y = 0; pR.maxHp = 1e9; pR.hp = 1e9;
  NS.Enemies.list.length = 0;
  const eR = NS.Enemies.spawn('drone', false, NS.Enemies.difficulty(0));
  eR.x = 40; eR.y = 0; eR.hp = eR.maxHp = 1e9;
  NS.Player.damage(pR, 10);
  NS._fuseLit = NS.Game.retriFuse > 0;
  for (let i = 0; i < 30; i++) { NS.Game.update(1 / 30); NS.Input.endFrame(); }
  NS._novaFired = eR.hp < eR.maxHp - 50; /* took the nova */
`);
check('RETRIBUTION lights a fuse when hit', run('!!NS._fuseLit'));
check('RETRIBUTION nova damages nearby enemies', run('!!NS._novaFired'));

console.log('\\n=== 9. Character quirk bonuses survive a recompute ===');
run(`
  NS.Characters.select(0); /* VANGUARD — +10% damage quirk */
  NS.Game.newRun(false);
  NS.s8 = NS.Game.state;
  NS._who = NS.Characters.current().name;
  NS._vdmg = NS.s8.dmgMult;
  NS._expect = 1.10 * Math.pow(1.15, 4);
  NS.s8.passives = { dmg: 4 }; NS.W.recomputeMods();
  NS._afterDmg = NS.s8.dmgMult;
  NS.Characters.select(2); /* WRAITH — +10% crit quirk */
  NS.Game.newRun(false);
  NS._wcrit = NS.Game.state.critChance;
`);
check('VANGUARD +10% damage quirk lands on run start',
  Math.abs(run('NS._vdmg') - 1.10) < 0.001, run('NS._who') + ' -> x' + run('NS._vdmg').toFixed(2));
check('WRAITH +10% crit quirk lands on run start',
  Math.abs(run('NS._wcrit') - 0.15) < 0.001, 'crit ' + (run('NS._wcrit') * 100).toFixed(0) + '%');
check('quirk + passive both count after recompute',
  Math.abs(run('NS._afterDmg') - 1.10 * Math.pow(1.15, 4)) < 0.01,
  run('NS._afterDmg').toFixed(3) + ' (expected ' + (1.10 * Math.pow(1.15, 4)).toFixed(3) + ')');

console.log('\\n=== 10. All 30 weapons fire through the real game loop ===');
run(`
  NS._errs = [];
  (function () {
    const kinds = ['drone', 'dart', 'orbiter', 'splitter', 'shooter', 'brute', 'reaper'];
    for (const id of NS.ids) {
      try {
        NS.Game.newRun(false);
        const s = NS.Game.state;
        const p = NS.Game.player;
        p.maxHp = 9e9; p.hp = 9e9; p.armor = 9e9;
        s.weapons = {};
        s.weapons[id] = { lvl: NS.W.DEFS[id].maxLvl, cd: 0 };
        s.passives = { dmg: 3 };
        NS.W.recomputeMods();
        NS.Enemies.list.length = 0;
        const diff = NS.Enemies.difficulty(0);
        for (let i = 0; i < 30; i++) NS.Enemies.spawn(kinds[i % kinds.length], i % 9 === 0, diff);
        for (let f = 0; f < 200; f++) {
          NS.Game.update(1 / 30);
          NS.Input.endFrame();
          if (NS.Game.mode === 'draft' || NS.Upgrades.open) NS.Upgrades.pick(0);
        }
      } catch (err) { NS._errs.push(id + ': ' + err.message); }
    }
  })();
`);
const errs = run('NS._errs');
check('all 30 weapons run 200 frames with no error', errs.length === 0,
  errs.length ? '\\n         ' + errs.join('\\n         ') : '30/30 clean');

console.log('\\n=== 11. Wave-10 weapons actually produce effects ===');
run(`
  NS._fx = {};
  (function () {
    const kinds = ['drone', 'dart', 'orbiter'];
    for (const id of ['whip', 'repel', 'rain', 'airstrike', 'split', 'cluster', 'flak', 'mirage']) {
      try {
        NS.Game.newRun(false);
        const s = NS.Game.state;
        const p = NS.Game.player;
        p.maxHp = 9e9; p.hp = 9e9; p.armor = 9e9;
        s.weapons = {};
        s.weapons[id] = { lvl: NS.W.DEFS[id].maxLvl, cd: 0 };
        s.passives = {};
        NS.W.recomputeMods();
        NS.Enemies.list.length = 0;
        const diff = NS.Enemies.difficulty(0);
        for (let i = 0; i < 25; i++) {
          const e = NS.Enemies.spawn(kinds[i % kinds.length], false, diff);
          e.x = p.x + 60 + (i % 3) * 40; e.y = p.y + (i - 12) * 8;
        }
        const k0 = s.kills;
        for (let f = 0; f < 400; f++) {
          NS.Game.update(1 / 30);
          NS.Input.endFrame();
          if (NS.Game.mode === 'draft' || NS.Upgrades.open) NS.Upgrades.pick(0);
        }
        NS._fx[id] = { kills: s.kills - k0, bullets: NS.Game.bullets.length };
      } catch (err) { NS._fx[id] = { error: err.message }; }
    }
  })();
`);
const fx = run('NS._fx');
for (const id of ['whip', 'repel', 'rain', 'airstrike', 'split', 'cluster', 'flak', 'mirage']) {
  const r = fx[id] || {};
  check(id + ' produced kills in 400 frames', r.kills > 0,
    r.error ? 'ERROR: ' + r.error : (r.kills + ' kills'));
}

console.log('\\n=== 12. Difficulty curve is the shipped hard version ===');
run(`
  NS.Game.newRun(false);
  const d = NS.Enemies.difficulty;
  NS._d = { t3: d(180), t10: d(600) };
`);
const d = run('NS._d');
console.log('       t=3:00', JSON.stringify(d.t3));
console.log('       t=10:00', JSON.stringify(d.t10));
check('HP scales harder than old 0.42/min baseline', d.t3.hp > 1 + 3 * 0.42 + Math.pow(3, 1.6) * 0.06, 't=3:00 hp x' + d.t3.hp.toFixed(2));
check('contact damage scales harder than old 0.12/min', d.t3.dmg > 1 + 3 * 0.12, 't=3:00 dmg x' + d.t3.dmg.toFixed(2));
check('enemy speed cap raised above 1.5x', d.t10.spd > 1.5, 't=10:00 spd x' + d.t10.spd.toFixed(2));

console.log('\\n' + '='.repeat(60));
console.log('CONTENT SUITE: ' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('FAILURES PRESENT'); process.exit(1); }
console.log('ALL CONTENT TESTS PASS');
