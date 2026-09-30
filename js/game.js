'use strict';
/* ============================================================
   NEONSWARM — game.js
   Orchestrator: run state, bullets, mines, beams, camera,
   update/render pipeline. Performance: zero allocations in
   hot loops, grid rebuilt in place each frame.
   ============================================================ */

NS.Game = {
  state: null, player: null, mode: 'menu',
  pendingLevelUps: 0,
  bullets: [], homing: [], mines: [], enemyBullets: [],
  bPool: new NS.Pool(() => ({})),
  camX: 0, camY: 0,
  _q: [],          /* reused query scratch array */
  gridSaved: null, /* grid snapshot before enemy updates for blade pass */

  /* ---------- Juice state ---------- */
  combo: 0, comboT: 0, slowmo: 0, stars: [],
  debris: [],
  meteors: [], meteorT: undefined,
  TILE2: 900,

  /* streak banner: RAMPAGE / GODLIKE / UNSTOPPABLE... */
  banner: null,
  streakTiers: [
    { at: 15, name: 'KILLING SPREE' },
    { at: 30, name: 'RAMPAGE' },
    { at: 50, name: 'UNSTOPPABLE' },
    { at: 80, name: 'GODLIKE' },
    { at: 120, name: 'BEYOND GODLIKE' },
    { at: 200, name: 'THE SWARM FEARS YOU' }
  ],

  showBanner(text, color) {
    this.banner = { text, color: color || '#ff4fa3', t: 0, life: 2.2 };
  },

  makeStars() {
    this.stars.length = 0;
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: NS.rand.range(0, 900), y: NS.rand.range(0, 900),
        z: NS.rand.range(0.25, 0.95),          /* parallax depth */
        r: NS.rand.range(0.6, 1.8),
        c: NS.rand.pick(['#5ef2ff', '#ff4fa3', '#ffd23f', '#c77dff', '#8a93c9'])
      });
    }
    /* drifting debris field */
    this.debris = this.debris || [];
    this.debris.length = 0;
    for (let i = 0; i < 26; i++) {
      this.debris.push({
        x: NS.rand.range(0, this.TILE2), y: NS.rand.range(0, this.TILE2),
        z: NS.rand.range(0.3, 0.6), r: NS.rand.range(1.5, 4),
        rot: NS.rand.range(0, NS.TAU), spin: NS.rand.range(-0.4, 0.4)
      });
    }
  },

  /* pre-rendered nebula cloud tile */
  makeNebula(color) {
    const size = 600;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    for (let i = 0; i < 22; i++) {
      const x = NS.rand.range(0, size), y = NS.rand.range(0, size);
      const r = NS.rand.range(60, 170);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.globalAlpha = 0.35;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return c;
  },

  onKill(e) {
    this.combo++;
    this.comboT = 2;
    const st = this.state;
    /* STREAK BANNERS: hit the next tier = screen-filling text + hit-stop.
       Classic arena-shooter dopamine. */
    if (this.streakTiers.some(tier => this.combo === tier.at)) {
      const tier = this.streakTiers.find(t2 => t2.at === this.combo);
      this.showBanner(tier.name, this.combo >= 80 ? '#ffd23f' : '#ff4fa3');
      this.slowmo = Math.max(this.slowmo, 0.28);
      NS.Audio.victory();
    }
    /* KILL MILESTONES: half-hundo hype */
    if (this.combo > 0 && this.combo % 250 === 0) {
      this.showBanner(this.combo + ' KILLS', '#5ef2ff');
      NS.Audio.levelup();
    }
    /* FRENZY: stack attack speed on kill */
    if (st.frenzyCap > 0 && st.frenzy < st.frenzyCap) {
      st.frenzy++;
      st.frenzyT = 2;
    }
    /* COMBO FIRE: x100+ = burning aura around the hero (drains boss armor) */
    if (this.combo >= 100) {
      const R = 46 + Math.min(34, (this.combo - 100) / 10);
      NS.Grid.query(this.player.x, this.player.y, R, this._q);
      for (let i = 0; i < this._q.length; i++) {
        const en = this._q[i];
        if (!en.dead && NS.dist2(this.player.x, this.player.y, en.x, en.y) < R * R) {
          NS.Game.damageEnemy(en, 10, 'aura');
        }
      }
      if (this.combo % 20 === 0) {
        NS.Particles.burst(this.player.x, this.player.y, 6, { color: '#ff9d3f', glow: true, life: 0.4 });
      }
    }
    /* VAMPIRE FANG: periodic heal on kill streaks */
    if (st.fang > 0) {
      st.fangKills += st.fang;
      if (st.fangKills >= 10) {
        st.fangKills -= 10;
        this.healPlayer(st.fang);
      }
    }
    /* SIPHON: every kill closes the wound a little */
    if (st.siphon > 0 && this.player.hp < this.player.maxHp) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + st.siphon * 0.3);
    }
    /* (formerly the IMMORTAL aspect hook — retired with Final Forms) */
    if (this.combo % 25 === 0) {
      this.healPlayer(5);
      NS.UI.toast('COMBO x' + this.combo + ' — +5 HP');
    }
    if (this.combo > 0 && this.combo % 60 === 0) {
      NS.Pickups.spawnChest(this.player.x + NS.rand.range(-24, 24), this.player.y + NS.rand.range(-24, 24));
      NS.UI.toast('COMBO x' + this.combo + ' — CHEST!', true);
    }
  },

  retriFuse: 0,

  /* ---------- Run lifecycle ---------- */
  newRun(endless) {
    NS.Quality.reset();
    NS.Pickups.goblinRate = 1;
    this.retriFuse = 0;
    const ch = NS.Characters.current();
    /* fresh run state — single source of truth in Weapons.newRunState() */
    this.state = NS.Weapons.newRunState();
    this.state.time = 0; this.state.kills = 0; this.state.bossKills = 0;
    this.state.won = false; this.state.endless = !!endless;
    this.state.shieldLvl = 0; this.state.timeLock = 0;
    this.state.abyssDepth = 0; this.state.abyssMult = 1;
    /* merge weapon cd fields */
    for (const id in this.state.weapons) this.state.weapons[id].cd = 0;
    this.player = NS.Player.create();
    const mb = NS.Save.metaBonuses();
    if (mb.hp) this.player.maxHp += mb.hp * 15;
    if (mb.speed) this.player.speed *= 1 + mb.speed * 0.04;
    /* CHARACTER: starting weapon + innate quirk */
    if (ch && NS.Weapons.DEFS[ch.weapon]) {
      this.state.weapons = {};
      this.state.weapons[ch.weapon] = { lvl: 1, cd: 0 };
    }
    if (ch && ch.apply) ch.apply(this.state, this.player);
    /* Aggregate AFTER the character quirk — the quirk writes into state.flat,
       so dmgMult/cdMult/critChance/xpMult must be rebuilt once it has landed. */
    NS.Weapons.recomputeMods();
    if (mb.startLvl > 0) {
      this.player.level = 1 + mb.startLvl;
      this.player.xpNext = NS.Player.xpFor(this.player.level);
      this.pendingLevelUps = mb.startLvl; /* draft the skipped levels */
    }
    NS.Enemies.reset();
    NS.Bosses.reset();
    NS.Pickups.reset();
    this.bullets.length = 0; this.homing.length = 0; this.mines.length = 0; this.enemyBullets.length = 0;
    this.meteors.length = 0; this.meteorT = undefined;
    this.rings.length = 0;
    this.meteors.length = 0; this.meteorT = undefined;
    this.combo = 0; this.comboT = 0; this.slowmo = 0;
    this.makeStars();
    NS.Particles.clear(); NS.DmgNums.clear();
    this.pendingLevelUps = 0;
    this.snapCamera();
    NS.stats.runs++;
    NS.Save.write();
    this.mode = 'play';
    NS.UI.hideAll();
    document.getElementById('hud').style.display = 'block';
    NS.Audio.startMusic();
    NS.UI.toast((ch ? ch.name + ' — ' : '') + (endless ? 'THE ABYSS HAS NO FLOOR. SURVIVE.' : 'SURVIVE. 30:00 UNTIL OMEGA.'), true);
  },

  /* snap camera instantly to the player (orientation flips, run start) */
  snapCamera() {
    if (!this.player) return;
    this.camX = this.player.x - this.viewOffX();
    this.camY = this.player.y - this.viewOffY();
  },

  /* ---------- VIEW OFFSETS ----------
     Landscape: dead center. Portrait (Android/phones): the player sits
     horizontally centered but vertically at ~62% down — "middle low".
     More sky above = incoming swarms read earlier; HUD and thumbs own the
     bottom. Camera offset ≠ view center, so everything downstream
     (snapCamera, radar, goblin marker, threat arrows) just works. */
  viewOffX() { return NS.VIEW_W / 2; },
  viewOffY() {
    return NS.portrait ? NS.VIEW_H * 0.62 : NS.VIEW_H / 2;
  },

  /* ---------- Helpers used by weapons ---------- */
  nearestEnemy(x, y, maxR) {
    NS.Grid.query(x, y, maxR, this._q);
    let best = null, bd = maxR * maxR;
    for (let i = 0; i < this._q.length; i++) {
      const e = this._q[i];
      if (e.dead) continue;
      const d2 = NS.dist2(x, y, e.x, e.y);
      if (d2 < bd) { bd = d2; best = e; }
    }
    return best;
  },

  nearestEnemyTo(x, y, maxR, exclude) {
    NS.Grid.query(x, y, maxR, this._q);
    let best = null, bd = maxR * maxR;
    outer:
    for (let i = 0; i < this._q.length; i++) {
      const e = this._q[i];
      if (e.dead) continue;
      for (let j = 0; j < exclude.length; j++) if (exclude[j] === e) continue outer;
      const d2 = NS.dist2(x, y, e.x, e.y);
      if (d2 < bd) { bd = d2; best = e; }
    }
    return best;
  },

  damageEnemy(e, base, source) {
    if (e.dead) return;
    const st = this.state;
    const crit = NS.rand.next() < st.critChance;
    /* FRENZY: up to +40% attack speed → expressed as damage/cd amplification here */
    const frenzyMult = 1 + Math.min(0.4, (st.frenzy || 0) * 0.03);
    /* KINETIC AMP: up to +30% dmg at low HP */
    const kineticMult = 1 + Math.min(0.30, (st.kinetic || 0) * 0.10 * (1 - this.player.hp / this.player.maxHp));
    /* OVERCLOCK: FRENZY never decays (handled in update) */
    /* BLOODLUST: crits land harder than the base 2x */
    const critMult = st.critMult || 2;
    /* HEX SIGN: everything the enemy takes is amplified */
    const hexMult = 1 + (st.hex || 0) * 0.08;
    /* evo mastery scaling on the source weapon */
    let masteryMult = 1;
    const wsrc = source && st.weapons ? st.weapons[source] : null;
    if (wsrc && wsrc.evo) masteryMult = NS.Weapons.masteryMult(wsrc);
    const dmg = base * st.dmgMult * frenzyMult * kineticMult * hexMult * masteryMult * (crit ? critMult : 1);
    /* SEISMIC ROUNDS: every hit shoves the target back a little */
    if (st.knock > 0 && !e.isBoss) {
      const ka = NS.angleTo(this.player.x, this.player.y, e.x, e.y);
      e.x += Math.cos(ka) * (5 + st.knock * 4);
      e.y += Math.sin(ka) * (5 + st.knock * 4);
    }
    this.lastDmg = dmg;
    e.hp -= dmg;
    e.hitT = 0.1;
    NS.Audio.hit();
    if (crit) {
      NS.DmgNums.add(e.x + NS.rand.range(-4, 4), e.y - e.r - 4, String(Math.round(dmg)) + '!', '#ffd23f', true);
      NS.Game.spawnRing(e.x, e.y, '#ffd23f', 2, e.r + 8, 0.3);
    } else if (NS.rand.next() < 0.3) {
      NS.DmgNums.add(e.x + NS.rand.range(-4, 4), e.y - e.r, String(Math.round(dmg)), '#ffffff');
    }
    /* EXECUTIONER: chance to instantly kill weakened enemies (not bosses/elites) */
    if (st.executioner > 0 && !e.isBoss && !e.elite && e.hp > 0) {
      const thresh = 0.12 + st.executioner * 0.06; /* 18/24/30% */
      if (e.hp / e.maxHp < thresh && NS.rand.next() < 0.25) {
        e.hp = 0;
        NS.DmgNums.add(e.x, e.y - e.r - 10, 'EXECUTE', '#ff5e6c', true);
      }
    }
    if (e.hp <= 0) {
      if (e.isBoss) NS.Bosses.damageBoss(e, 0);
      else NS.Enemies.kill(e);
    } else if (e.isBoss) {
      NS.Bosses.damageBoss(e, 0);
    }
  },

  /* CRYO SHELL: every 5s a freezing nova pulses out of the player.
     Slow + chip damage in a ring — runs itself off state, not a weapon slot. */
  updateCryo(dt) {
    const st = this.state;
    if (!st.cryo) return;
    if (st.cryoT === undefined) st.cryoT = 5;
    st.cryoT -= dt;
    if (st.cryoT > 0) return;
    st.cryoT = 5;
    const R = 70 + st.cryo * 22;
    const p = this.player;
    NS.Grid.query(p.x, p.y, R, this._q);
    for (let i = 0; i < this._q.length; i++) {
      const e = this._q[i];
      if (e.dead) continue;
      if (NS.dist2(p.x, p.y, e.x, e.y) > R * R) continue;
      e.slowT = Math.max(e.slowT || 0, 1.6);
      e.slowAmt = Math.min(0.65, 0.3 + st.cryo * 0.09);
      this.damageEnemy(e, 4 + st.cryo * 3, 'cryo');
    }
    NS.Game.spawnRing(p.x, p.y, '#bfe8ff', 3, R, 0.5);
    NS.Particles.burst(p.x, p.y, 12, { color: '#bfe8ff', glow: true, life: 0.5 });
    NS.Audio.tone(900, 0.2, 'sine', 0.05, 0, 300);
  },

  /* RICOCHET ROUNDS: a killing projectile shot jumps to the next enemy.
     Called from the bullet loop when a hit turns out lethal. */
  ricochetFrom(b) {
    const st = this.state;
    if (!st.rico || !b.src) return false;
    const next = this.nearestEnemyTo(b.x, b.y, 240, b._ricoSeen || (b._ricoSeen = []));
    if (!next) return false;
    b._ricoSeen.push(next);
    if (b._ricoSeen.length > st.rico + 2) return false;
    const a = NS.angleTo(b.x, b.y, next.x, next.y);
    const spd = Math.hypot(b.vx, b.vy) || 200;
    b.vx = Math.cos(a) * spd; b.vy = Math.sin(a) * spd;
    b.x = next.x - Math.cos(a) * (next.r + 4);
    b.y = next.y - Math.sin(a) * (next.r + 4);
    b.t = 0; b.life = Math.max(b.life, 0.8);
    b.pierce = Math.max(b.pierce, 0);
    b.dmg *= 0.8;
    return true;
  },

  /* SALVAGER: central heal choke point — all heals land +50%/rank stronger */
  healPlayer(amount) {
    const amt = Math.round(amount * (1 + ((this.state && this.state.salvager) || 0) * 0.5));
    NS.Player.heal(this.player, amt);
  },

  /* visual: expanding ring (level-ups, revives, big hits) */
  rings: [],

  /* sector banners: milestone moments (2:00 SPIDERS etc.) */
  sector: 0,
  spawnRing(x, y, color, w, r, life) {
    if (this.rings.length > 10) return;
    this.rings.push({ x, y, color, w, r, t: 0, life });
  },

  /* ---------- SIGNATURE IMPACT EFFECTS (shared by signature skills) ----------
     STARFALL impact: 4-point star flare + sparks + shock ring.
     ORBITAL LANCE impact: white beam flash + energy ring + debris. */
  starFlare(x, y, r) {
    const c = NS.ctx;
    void c; /* drawn via rings + particles so it works headless too */
    /* 4-point flare: two crossing elongated diamond rings */
    this.rings.push({ x, y, color: '#fff6d8', w: 3, r: r * 0.9, t: 0, life: 0.3, star: true });
    this.rings.push({ x, y, color: '#ffe45e', w: 2, r: r * 0.6, t: 0, life: 0.45 });
    NS.Particles.burst(x, y, 14, { color: '#ffe45e', glow: true, life: 0.5 });
    NS.Particles.burst(x, y, 6, { color: '#ffffff', glow: true, life: 0.35 });
  },

  lanceImpact(x, y, r) {
    this.rings.push({ x, y, color: '#ffffff', w: 4, r: r * 0.8, t: 0, life: 0.28 });
    this.rings.push({ x, y, color: '#bfe8ff', w: 2, r, t: 0, life: 0.45 });
    NS.Particles.burst(x, y, 12, { color: '#bfe8ff', glow: true, life: 0.55 });
    NS.Particles.burst(x, y - 20, 8, { color: '#ffffff', glow: true, life: 0.4, vy: -120 });
  },

  spawnHoming(x, y, target, speed, dmg, type, color, size, life, splash, src) {
    if (this.homing.length > 40) return;
    const m = NS.Weapons.mods(); /* global weapon passives reach every weapon here */
    const h = this.bPool.make();
    h.x = x; h.y = y;
    h.vx = NS.rand.range(-60, 60); h.vy = NS.rand.range(-60, 60);
    h.target = target; h.speed = speed * m.spd;
    h.dmg = dmg; h.type = type; h.color = color;
    h.size = (size || 3) * m.size; h.life = (life || 2) * m.life; h.t = 0;
    h.splash = (splash || 0) * m.size;
    h.src = src || null;
    this.homing.push(h);
  },

  /* AoE explosion used by swarm rockets */
  explode(x, y, radius, dmg, color) {
    NS.Grid.query(x, y, radius, this._q);
    for (let i = 0; i < this._q.length; i++) {
      const e = this._q[i];
      if (e.dead) continue;
      if (NS.dist2(x, y, e.x, e.y) < radius * radius) this.damageEnemy(e, dmg, 'explosion');
    }
    NS.Particles.burst(x, y, 10, { color: color || '#ffb14f', glow: true, life: 0.4, drag: 0.85 });
    NS.Game.spawnRing(x, y, color || '#ffb14f', 2, radius, 0.3);
  },

  spawnBullet(x, y, ang, speed, dmg, type, color, size, life, opts) {
    if (this.bullets.length > 220) return;
    const m = NS.Weapons.mods(); /* global weapon passives reach every weapon here */
    const b = this.bPool.make();
    b.x = x; b.y = y;
    b.vx = Math.cos(ang) * speed * m.spd; b.vy = Math.sin(ang) * speed * m.spd;
    b.dmg = dmg; b.type = type; b.color = color;
    b.size = (size || 2) * m.size; b.life = (life || 2) * m.life; b.t = 0;
    b.pierce = ((opts && opts.pierce) || 0) + m.pierce;
    b.src = (opts && opts.src) || null;
    /* per-hit cooldown: pierce/orbit bullets re-hit the same enemy slower
       instead of either once-ever or every frame */
    b.perHitCd = (opts && opts.perHitCd) || 0;
    b.hitAt = null;
    /* boomerang: real out-and-back — flies out turnT seconds, then steers home */
    if (opts && opts.boom) { b.boom = true; b.turnT = opts.turnT || 0.55; }
    /* saw: re-aim at the nearest enemy on each hit */
    if (opts && opts.reaim) b.reaim = true;
    /* cluster: burst into a ring of bomblets on death */
    if (opts && opts.shrap) b.shrap = opts.shrap;
    /* flak: burst into shards on FIRST contact (or death) */
    if (opts && opts.shards) b.shards = opts.shards;
    /* split: fork in two mid-flight */
    if (opts && opts.split) { b.split = opts.split; b.splitAt = opts.splitAt || 0.35; }
    /* ricochet bookkeeping */
    b._ricoSeen = null;
    this.bullets.push(b);
  },

  /* burst helpers for cluster/flak/split */
  spawnShards(x, y, n, dmg, spd, life, pierce, type, color, src) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * NS.TAU + NS.rand.range(-0.15, 0.15);
      this.spawnBullet(x, y, a, spd, dmg, type, color, 1.8, life, { pierce, src });
    }
    NS.Particles.burst(x, y, 6, { color, glow: true, life: 0.3, drag: 0.85 });
    NS.Audio.noise(0.1, 0.05, 1100);
  },

  /* split a bullet into two forks perpendicular-ish to its heading */
  splitBullet(b) {
    if (this.bullets.length > 210) return;
    const a0 = Math.atan2(b.vy, b.vx);
    const spd = Math.hypot(b.vx, b.vy);
    const m = NS.Weapons.mods();
    for (const da of [-0.6, 0.6]) {
      const nb = this.bPool.make();
      nb.x = b.x; nb.y = b.y;
      nb.vx = Math.cos(a0 + da) * spd * m.spd; nb.vy = Math.sin(a0 + da) * spd * m.spd;
      nb.dmg = b.dmg * 0.6; nb.type = b.type; nb.color = b.color;
      nb.size = b.size * 0.85; nb.life = b.life * 0.8; nb.t = 0;
      nb.pierce = b.pierce; nb.src = b.src;
      nb.perHitCd = b.perHitCd; nb.hitAt = null;
      nb.boom = false; nb.reaim = false; nb.shrap = null; nb.shards = null; nb.split = null;
      nb._ricoSeen = null;
      this.bullets.push(nb);
    }
  },

  spawnEnemyBullet(x, y, ang, speed, dmg, color) {
    if (this.enemyBullets.length > 90) return;
    const b = this.bPool.make();
    b.x = x; b.y = y;
    b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed;
    b.dmg = dmg; b.color = color;
    b.life = 6; b.t = 0;
    this.enemyBullets.push(b);
  },

  spawnMine(x, y, radius, dmg) {
    if (this.mines.length > 24) return;
    this.mines.push({ x, y, radius, dmg, armT: 0.5, life: 12, t: 0 });
  },

  railBeam(ang, dmg) {
    const p = this.player;
    const c = Math.cos(ang), s2 = Math.sin(ang);
    const maxLen = 420;
    /* damage all enemies whose distance-to-line < their r+3, within maxLen, ahead of player */
    NS.Grid.query(p.x, p.y, maxLen, this._q);
    for (let i = 0; i < this._q.length; i++) {
      const e = this._q[i];
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const along = dx * c + dy * s2;
      if (along < 0 || along > maxLen) continue;
      const perp = Math.abs(-dx * s2 + dy * c);
      if (perp < e.r + 4) this.damageEnemy(e, dmg, 'rail');
    }
    NS.Shake.add(2, 0.15);
    NS.Audio.tone(200, 0.25, 'sawtooth', 0.12, 0, 90);
  },

  onDeath() {
    if (this.mode === 'over') return;
    this.mode = 'over';
    NS.Audio.die();
    NS.Shake.add(6, 0.7);
    NS.Particles.burst(this.player.x, this.player.y, 30, { color: '#5ef2ff', glow: true, life: 0.9 });
    setTimeout(() => {
      this.finishRun(false);
    }, 1100);
  },

  onVictory() {
    this.mode = 'over';
    setTimeout(() => this.finishRun(true), 1200);
  },

  finishRun(won) {
    const s = this.state, p = this.player;
    NS.stats.totalSeconds += Math.floor(s.time);
    NS.stats.totalLevel += p.level;
    if (s.time > NS.stats.best.time) NS.stats.best.time = Math.floor(s.time);
    if (s.kills > NS.stats.best.kills) NS.stats.best.kills = s.kills;
    if (p.level > NS.stats.best.level) NS.stats.best.level = p.level;
    if (s.abyssDepth > (NS.stats.best.abyssDepth || 0)) NS.stats.best.abyssDepth = s.abyssDepth || 0;
    for (const id in s.weapons) NS.stats.weaponsUsed[id] = (NS.stats.weaponsUsed[id] || 0) + 1;
    NS.Save.write();
    this.lastRank = NS.Save.rank();
    this.lastCores = NS.Save.cores();
    document.getElementById('hud').style.display = 'none';
    NS.UI.showGameOver(won);
    this.mode = 'menu';
  },

  /* ---------- UPDATE ---------- */
  update(dt) {
    if (this.mode !== 'play') return;
    const s = this.state, p = this.player;

    /* slow-motion window (boss deaths, victory) */
    if (this.slowmo > 0) { this.slowmo -= dt; dt *= 0.3; }

    /* BULLET TIME powerup: the world crawls, the player does not */
    if (s.timeSlow > 0) {
      s.timeSlow -= dt;
      this.worldDt = dt * 0.35;
    } else this.worldDt = dt;
    /* NOTE: cryo uses real dt via updateCryo below (called after pickups) */

    /* adaptive quality sampling (only while actually playing) */
    NS.Quality.check(dt);

    /* 30:00 OMEGA warning banners */
    if (!s.endless) {
      const warnAt = [1740, 1770, 1790];
      if (warnAt.indexOf(Math.floor(s.time)) >= 0 && !s._omegaWarned) {
        s._omegaWarned = Math.floor(s.time);
        NS.UI.toast('⚠ OMEGA PROTOCOL INBOUND — ' + Math.ceil((1800 - s.time) / 60) + ' MIN', true);
        NS.Audio.tone(70, 0.8, 'sawtooth', 0.15, 0, 40);
      }
    }

    /* combo timer */
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

    /* streak banner timing */
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.life) this.banner = null;
    }

    s.time += dt;

    /* TIME-LOCK (Chronos): countdown then weapons freeze below */
    if (s.timeLock > 0) s.timeLock -= dt;

    /* ---------- METEOR STORM (arena hazard, after 4:00) ---------- */
    if (s.time > 240 && !this.meteors) this.meteors = [];
    if (s.time > 240) {
      this.meteorT = (this.meteorT === undefined ? 6 : this.meteorT) - dt;
      if (this.meteorT <= 0) {
        this.meteorT = Math.max(2.6, 7 - (s.time - 240) / 240); /* intensifies */
        const n = s.endless ? 4 : 2;
        for (let i = 0; i < n; i++) {
          this.meteors.push({
            x: p.x + NS.rand.range(-170, 170),
            y: p.y + NS.rand.range(-170, 170),
            t: 0, warn: 1.25, r: 30
          });
        }
      }
      for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i];
        m.t += dt;
        if (m.t >= m.warn) {
          if (NS.dist2(p.x, p.y, m.x, m.y) < m.r * m.r) NS.Player.damage(p, 16);
          NS.Grid.query(m.x, m.y, m.r, this._q);
          for (const e of this._q) {
            if (!e.dead && !e.isBoss && NS.dist2(m.x, m.y, e.x, e.y) < m.r * m.r) this.damageEnemy(e, 60, 'meteor');
          }
          NS.Game.spawnRing(m.x, m.y, '#ff9d3f', 3, m.r + 6, 0.4);
          NS.Particles.burst(m.x, m.y, 14, { color: '#ff9d3f', glow: true, life: 0.45 });
          NS.Shake.add(2, 0.2);
          NS.Audio.noise(0.3, 0.12, 400);
          this.meteors.splice(i, 1);
        }
      }
    }

    /* build s-like object weapons expect (wid is set per-weapon below) */
    const wctx = {
      dt: this.worldDt, time: s.time, player: p,
      weapons: s.weapons, cam: { x: this.camX, y: this.camY },
      ctx: null, wid: null
    };
    for (const wid in s.weapons) {
      if (s.timeLock > 0) break; /* CHRONOS time-lock: all weapons frozen */
      const id = wid;
      const def = NS.Weapons.effectiveDef(id, s.weapons[id]);
      if (!def) continue;
      const st = s.weapons[id];
      wctx.wid = wid; /* weapons tag their projectiles with their own id */
      /* cooldown = global passives (COOLANT/OVERCLOCK CORE) × evo mastery */
      const savedCd = st.cd;
      def.fire(wctx, st.lvl);
      if (st.cd !== savedCd && st.cd > 0) {
        const mult = this.state.cdMult * (st.evo ? NS.Weapons.masteryCdMult(st) : 1);
        st.cd = savedCd + (st.cd - savedCd) * mult;
      }
      /* weapons with their own per-frame simulation (lotus petals, coil pods) */
      if (def.advance) def.advance(wctx, st.lvl);
    }

    NS.Player.update(p, dt);
    NS.Grid.clear();

    /* FRENZY: kill-streak attack speed (decays unless OVERCLOCK) */
    const stF = this.state;
    if (stF.frenzyCap > 0) {
      if (stF.overclock) { stF.frenzyT = 2; }
      if (stF.frenzyT > 0) stF.frenzyT -= dt;
      else if (stF.frenzy > 0) { stF.frenzy -= Math.max(1, dt * 4) | 0; if (stF.frenzy < 0) stF.frenzy = 0; stF.frenzyT = 1; }
    }

    NS.Enemies.update(this.worldDt);
    NS.Bosses.update(this.worldDt);
    NS.Pickups.update(dt);

    /* player bullets — per-hit cooldown, boomerang return, saw re-aim,
       cluster/flak bursts, split forks, ricochet jumps */
    const B = this.bullets;
    const p2 = this.player;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i];
      b.t += dt;

      /* boomerang: after turnT, steer back toward the player; despawn on arrival */
      if (b.boom) {
        if (b.t < b.turnT) { /* outbound, straight */ }
        else {
          const ba = NS.angleTo(b.x, b.y, p2.x, p2.y);
          const bsp = Math.hypot(b.vx, b.vy) || 260;
          const cur = Math.atan2(b.vy, b.vx);
          let diff = ba - cur;
          while (diff > Math.PI) diff -= NS.TAU;
          while (diff < -Math.PI) diff += NS.TAU;
          const na = cur + NS.clamp(diff, -8 * dt, 8 * dt);
          b.vx = Math.cos(na) * bsp; b.vy = Math.sin(na) * bsp;
          if (b.t > b.turnT && NS.dist2(b.x, b.y, p2.x, p2.y) < 18 * 18) {
            if (b.shards) this.spawnShards(b.x, b.y, b.shards.n, b.shards.dmg, b.shards.spd, b.shards.life, b.shards.pierce, 'shard', b.color, b.src);
            this.bPool.give(b); B[i] = B[B.length - 1]; B.pop();
            continue;
          }
        }
      }

      /* split: fork once when the timer fires */
      if (b.split && b.t >= b.splitAt) {
        this.splitBullet(b);
        b.split = null;
      }

      b.x += b.vx * dt; b.y += b.vy * dt;
      const hit = this.nearestEnemy(b.x, b.y, b.size + 10);
      let dead = b.t > b.life;
      if (!dead && hit) {
        const rr = (hit.r + b.size) * (hit.r + b.size);
        if (NS.dist2(b.x, b.y, hit.x, hit.y) < rr) {
          /* per-hit cooldown gates re-hits on pierce/orbit bullets */
          if (b.perHitCd > 0) {
            if (b.hitAt && b.hitAt[hit.id] && s.time - b.hitAt[hit.id] < b.perHitCd) continue;
            if (!b.hitAt) b.hitAt = {};
            b.hitAt[hit.id] = s.time;
          }
          this.damageEnemy(hit, b.dmg, b.type);
          /* SEISMIC shove + ricochet check + first-contact burst */
          const wasLethal = hit.dead;
          if (b.reaim && !dead) {
            const nextT = this.nearestEnemy(b.x, b.y, 200);
            if (nextT && nextT !== hit) {
              const na = NS.angleTo(b.x, b.y, nextT.x, nextT.y);
              const bsp = Math.hypot(b.vx, b.vy) || 240;
              b.vx = Math.cos(na) * bsp; b.vy = Math.sin(na) * bsp;
            }
          }
          if (b.shards) {
            this.spawnShards(b.x, b.y, b.shards.n, b.shards.dmg, b.shards.spd, b.shards.life, b.shards.pierce, 'shard', b.color, b.src);
            b.shards = null; /* burst once */
            dead = true;
          } else if (wasLethal && this.ricochetFrom(b)) {
            /* ricochet kept the bullet alive — skip the death branch */
          } else {
            NS.Particles.burst(b.x, b.y, 3, { color: b.color, life: 0.25, drag: 0.8 });
            dead = b.pierce > 0 ? (b.pierce--, false) : true;
          }
        }
      }
      if (dead && b.shrap) {
        /* cluster bomb: ring of bomblets on death */
        this.spawnShards(b.x, b.y, b.shrap.n, b.shrap.dmg, b.shrap.spd, b.shrap.life, b.shrap.pierce, b.shrap.type || 'shard', b.color, b.src);
        b.shrap = null;
      }
      if (dead) { this.bPool.give(b); B[i] = B[B.length - 1]; B.pop(); }
    }

    /* homing seekers */
    const H = this.homing;
    for (let i = H.length - 1; i >= 0; i--) {
      const h = H[i];
      h.t += dt;
      /* steer toward target (re-acquire if dead) */
      if (!h.target || h.target.dead) {
        h.target = this.nearestEnemy(h.x, h.y, 300);
      }
      if (h.target && !h.target.dead) {
        const want = NS.angleTo(h.x, h.y, h.target.x, h.target.y);
        const cur = Math.atan2(h.vy, h.vx);
        let diff = want - cur;
        while (diff > Math.PI) diff -= NS.TAU;
        while (diff < -Math.PI) diff += NS.TAU;
        const na = cur + NS.clamp(diff, -6 * dt, 6 * dt);
        h.vx = Math.cos(na) * h.speed; h.vy = Math.sin(na) * h.speed;
      }
      h.x += h.vx * dt; h.y += h.vy * dt;
      let dead = h.t > h.life;
      const hit = this.nearestEnemy(h.x, h.y, h.size + 10);
      if (!dead && hit) {
        const rr = (hit.r + h.size) * (hit.r + h.size);
        if (NS.dist2(h.x, h.y, hit.x, hit.y) < rr) {
          if (h.splash) this.explode(h.x, h.y, h.splash, h.dmg * 0.6, h.color);
          this.damageEnemy(hit, h.dmg, h.type);
          NS.Particles.burst(h.x, h.y, 5, { color: h.color, glow: true, life: 0.3 });
          dead = true;
        }
      }
      if (dead) { this.bPool.give(h); H[i] = H[H.length - 1]; H.pop(); }
    }

    /* CRYO SHELL: periodic freezing nova */
    this.updateCryo(dt);

    /* RETRIBUTION: nova detonation after taking a hit (fused fuse) */
    if (this.state.retribution > 0 && this.retriFuse > 0) {
      this.retriFuse -= dt;
      if (this.retriFuse <= 0) {
        const lvl = this.state.retribution;
        const R = 120 + lvl * 30, DMG = 60 + lvl * 40;
        NS.Grid.query(p.x, p.y, R, this._q);
        for (let i = 0; i < this._q.length; i++) {
          const e = this._q[i];
          if (e.dead) continue;
          if (NS.dist2(p.x, p.y, e.x, e.y) < R * R) this.damageEnemy(e, DMG, 'retribution');
        }
        this.spawnRing(p.x, p.y, '#ff5e6c', 6, R, 0.5);
        NS.Particles.burst(p.x, p.y, 24, { color: '#ff5e6c', glow: true, life: 0.6 });
        NS.Shake.add(4, 0.3);
        NS.Audio.bombSfx();
        NS.UI.toast('RETRIBUTION!', false);
      }
    }

    /* enemy bullets (TIME SNAP passive: projectiles slower) */
    const E = this.enemyBullets;
    const bs = 1 - (this.state.bulletSlow || 0);
    for (let i = E.length - 1; i >= 0; i--) {
      const b = E[i];
      b.t += dt;
      b.x += b.vx * dt * bs; b.y += b.vy * dt * bs;
      let dead = b.t > b.life;
      if (!dead) {
        const rr = (p.r + 3) * (p.r + 3);
        if (NS.dist2(b.x, b.y, p.x, p.y) < rr) {
          NS.Player.damage(p, b.dmg);
          dead = true;
        }
      }
      if (dead) { this.bPool.give(b); E[i] = E[E.length - 1]; E.pop(); }
    }

    /* mines */
    const M = this.mines;
    for (let i = M.length - 1; i >= 0; i--) {
      const m = M[i];
      m.t += dt;
      if (m.armT > 0) { m.armT -= dt; continue; }
      m.life -= dt;
      /* detonate when enemy near or expired */
      const trig = this.nearestEnemy(m.x, m.y, m.radius);
      if (trig || m.life <= 0) {
        NS.Grid.query(m.x, m.y, m.radius * 1.4, this._q);
        for (const e of this._q) {
          if (e.dead) continue;
          if (NS.dist2(m.x, m.y, e.x, e.y) < m.radius * m.radius * 1.4) {
            this.damageEnemy(e, m.dmg, 'mine');
          }
        }
        NS.Particles.burst(m.x, m.y, 14, { color: '#ff5e6c', glow: true, life: 0.5 });
        NS.Shake.add(2, 0.2);
        NS.Audio.kill();
        this.bPool.give(m);
        M[i] = M[M.length - 1]; M.pop();
      }
    }

    /* rings (level-up / crit / revive flashes) */
    const R = this.rings;
    for (let i = R.length - 1; i >= 0; i--) {
      const r = R[i];
      r.t += dt;
      if (r.t >= r.life) { R[i] = R[R.length - 1]; R.pop(); }
    }

    /* particles & numbers */
    NS.Particles.update(dt);
    NS.DmgNums.update(dt);
    NS.Shake.update(dt);
    NS.FPS.tick(dt);

    /* SECTOR BANNERS: every 2 minutes = milestone hype (15 sectors to 30:00) */
    const sect = Math.floor(s.time / 120);
    if (sect > (this.sector || 0) && sect <= 15) {
      this.sector = sect;
      const names = ['THE SWARM STIRS', 'ELITE SIGNS', 'THE DEEP', 'PACKS HUNT', 'STORMS ROLL', 'THE GAUNTLET', 'FIRST TRIAL', 'IRON TIDE', 'THE CRUCIBLE', 'ABYSS HUNGER', 'SHATTERED SKY', 'THE HORDE KING', 'DEAD STARS', 'THE THRESHOLD', 'OMEGA AIRSPACE'];
      NS.UI.toast('SECTOR ' + sect + ' — ' + names[sect - 1], true);
      NS.Audio.tone(140, 0.4, 'sawtooth', 0.1, 0, 70);
    }

    /* level-up drafts */
    if (this.pendingLevelUps > 0 && this.mode === 'play') {
      NS.Upgrades.show();
    }

    /* ---------- ENDLESS ABYSS: deepening scaling ----------
       Layers multiply difficulty — the player keeps getting stronger
       (final forms), so the abyss keeps pace. */
    if (s.endless && s.time > 900) {
      const deep = Math.floor((s.time - 900) / 60); /* minutes past OMEGA */
      if (deep > (s.abyssDepth || 0)) {
        s.abyssDepth = deep;
        s.abyssMult = Math.pow(1.35, deep);
        NS.UI.toast('THE ABYSS DEEPENS — LAYER ' + deep, true);
        NS.Audio.tone(90, 0.6, 'sawtooth', 0.12, 0, 40);
      }
    }

    /* camera: smooth follow — portrait locks the player horizontal-center,
       middle-low (0.62 of the view height) per owner request */
    const k = Math.min(1, dt * 7);
    this.camX = NS.lerp(this.camX, p.x - this.viewOffX(), k);
    this.camY = NS.lerp(this.camY, p.y - this.viewOffY(), k);
  },

  /* ---------- RENDER ---------- */
  render() {
    const ctx = NS.ctx;
    const cam = { x: this.camX, y: this.camY };
    const shake = NS.Shake.offset();
    cam.x += shake.x; cam.y += shake.y;

    /* background: deep space — parallax starfield + faint grid */
    ctx.fillStyle = '#0a0a16';
    ctx.fillRect(0, 0, NS.VIEW_W, NS.VIEW_H);
    const TILE = 900;
    const stars = this.stars;
    for (let i = 0; i < stars.length; i++) {
      const st = stars[i];
      const px = (((st.x - cam.x * st.z) % TILE) + TILE) % TILE;
      const py = (((st.y - cam.y * st.z) % TILE) + TILE) % TILE;
      if (px > NS.VIEW_W || py > NS.VIEW_H) continue;
      NS.Glow.draw(ctx, st.c, px, py, st.r * 2.2, 0.5 * st.z);
    }
    /* nebula clouds (pre-rendered, two parallax layers; skipped on low quality) */
    if (NS.Quality.level > 0) {
      if (!this._neb) this._neb = [this.makeNebula('#2a1a5e'), this.makeNebula('#133a52')];
      for (let n = 0; n < 2; n++) {
        const z = n === 0 ? 0.12 : 0.22;
        const TILE = 600;
        const nx = -((cam.x * z) % TILE + TILE) % TILE;
        const ny = -((cam.y * z) % TILE + TILE) % TILE;
        ctx.globalAlpha = n === 0 ? 0.5 : 0.35;
        ctx.drawImage(this._neb[n], nx, ny);
        ctx.drawImage(this._neb[n], nx - TILE, ny);
        ctx.drawImage(this._neb[n], nx, ny - TILE);
        ctx.drawImage(this._neb[n], nx - TILE, ny - TILE);
      }
      ctx.globalAlpha = 1;
    }

    /* drifting debris rocks (very slow parallax; skipped on low quality) */
    if (NS.Quality.level > 1) {
      const db = this.debris || (this.debris = []), nowT = performance.now() / 1000;
      for (let i = 0; i < db.length; i++) {
        const d = db[i];
        const T2 = this.TILE2;
        const px = (((d.x - cam.x * d.z) % T2) + T2) % T2;
        const py = (((d.y - cam.y * d.z) % T2) + T2) % T2;
        if (px > NS.VIEW_W || py > NS.VIEW_H) continue;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(d.rot + nowT * d.spin);
        ctx.fillStyle = 'rgba(90,100,150,0.25)';
        ctx.beginPath();
        ctx.moveTo(-d.r, 0); ctx.lineTo(0, -d.r * 0.8); ctx.lineTo(d.r, -d.r * 0.2); ctx.lineTo(d.r * 0.6, d.r * 0.7); ctx.lineTo(-d.r * 0.5, d.r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    const gs = 48;
    const ox = -(cam.x % gs), oy = -(cam.y % gs);
    ctx.strokeStyle = 'rgba(94,242,255,0.04)';
    ctx.beginPath();
    for (let x = ox; x < NS.VIEW_W; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, NS.VIEW_H); }
    for (let y = oy; y < NS.VIEW_H; y += gs) { ctx.moveTo(0, y); ctx.lineTo(NS.VIEW_W, y); }
    ctx.stroke();

    if (!this.state || this.mode === 'menu') {
      this.renderMenuBG(ctx);
      return;
    }

    /* world layer — depth order: pickups under enemies under bosses */
    NS.Pickups.draw(ctx, cam, this.state.time);
    NS.Enemies.draw(ctx, cam, this.state.time);
    NS.Bosses.draw(ctx, cam, this.state.time);

    /* enemy spawn flash: rising column of light (readability: where threats come from) */

    /* mines */
    for (const m of this.mines) {
      const x = m.x - cam.x, y = m.y - cam.y;
      const blink = m.armT <= 0 && Math.floor(m.t * 4) % 2 === 0;
      NS.Glow.draw(ctx, blink ? '#ff5e6c' : '#7a2a33', x, y, 7, 0.9);
      ctx.fillStyle = blink ? '#ffdde3' : '#ff5e6c';
      ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.strokeStyle = 'rgba(255,94,108,0.25)';
      ctx.beginPath(); ctx.arc(x, y, m.radius, 0, NS.TAU); ctx.stroke();
    }

    /* bullets */
    for (const b of this.bullets) {
      const x = b.x - cam.x, y = b.y - cam.y;
      NS.Glow.draw(ctx, b.color, x, y, b.size * 3, 0.8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - b.size / 2, y - b.size / 2, b.size, b.size);
    }
    /* homing seekers: white core + purple comet tail */
    for (const h of this.homing) {
      const x = h.x - cam.x, y = h.y - cam.y;
      NS.Glow.draw(ctx, h.color, x, y, h.size * 4, 0.85);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - h.size / 2, y - h.size / 2, h.size, h.size);
      const spd = Math.hypot(h.vx, h.vy) || 1;
      ctx.strokeStyle = 'rgba(199,125,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - h.vx / spd * 10, y - h.vy / spd * 10);
      ctx.stroke();
    }
    /* enemy bullets: chunky, pulsing, impossible to miss */
    for (const b of this.enemyBullets) {
      const x = b.x - cam.x, y = b.y - cam.y;
      const pulse = 1 + Math.sin(performance.now() / 90 + b.x) * 0.18;
      NS.Glow.draw(ctx, b.color, x, y, 9 * pulse, 0.95);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(x, y, 3.2 * pulse, 0, NS.TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, NS.TAU);
      ctx.fill();
    }

    /* weapon overlays (blades, drones, beams, rings) */
    const wctx = {
      time: this.state.time, player: this.player,
      weapons: this.state.weapons, cam, ctx
    };
    for (const id in this.state.weapons) {
      const st = this.state.weapons[id];
      const def = NS.Weapons.effectiveDef(id, st);
      if (def && def.drawExtra) def.drawExtra(wctx, st.lvl);
    }

    /* BOSS RADAR: directional arrow when boss is off-screen */
    if (NS.Bosses.active) {
      const b = NS.Bosses.active;
      const bx = b.x - cam.x, by = b.y - cam.y;
      if (bx < -20 || by < -20 || bx > NS.VIEW_W + 20 || by > NS.VIEW_H + 20) {
        const cx = NS.VIEW_W / 2, cy = NS.VIEW_H / 2;
        const aa = Math.atan2(by - cy, bx - cx);
        const rad = Math.min(NS.VIEW_W, NS.VIEW_H) / 2 - 12;
        const ax = cx + Math.cos(aa) * rad, ay = cy + Math.sin(aa) * rad;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(aa);
        const blink = Math.floor(performance.now() / 250) % 2 === 0;
        ctx.globalAlpha = blink ? 0.9 : 0.5;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(9, 0); ctx.lineTo(-5, -6); ctx.lineTo(-5, 6);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    /* STREAK BANNER: screen-filling arcade text, slams in then fades */
    if (this.banner) {
      const b = this.banner;
      const bt = b.t / b.life;
      const slam = bt < 0.12 ? (bt / 0.12) : 1;            /* scale-in */
      const fade = bt > 0.75 ? 1 - (bt - 0.75) / 0.25 : 1; /* fade-out */
      const sc = (0.6 + 0.4 * slam) * (1 + Math.sin(bt * Math.PI) * 0.06);
      ctx.save();
      ctx.translate(NS.VIEW_W / 2, NS.VIEW_H * 0.3);
      ctx.scale(sc, sc);
      ctx.globalAlpha = NS.clamp(fade, 0, 1);
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = b.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 4;
      const txt = b.text;
      ctx.strokeText(txt, 0, 0);
      ctx.fillText(txt, 0, 0);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = NS.clamp(fade * 0.6, 0, 1);
      ctx.strokeText(txt, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    NS.Player.draw(ctx, this.player, cam, this.state.time);
    /* expanding rings on top of everything (star variant = 4-point flare) */
    for (const r of this.rings) {
      const prog = r.t / r.life;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 1 - prog;
      ctx.lineWidth = r.w * (1 - prog) + 0.5;
      const rr = r.r * prog + 2;
      ctx.beginPath();
      if (r.star) {
        /* 4-point star: two rotated diamonds, shrink with progress */
        const cx2 = r.x - cam.x, cy2 = r.y - cam.y;
        for (const rot of [0, Math.PI / 2]) {
          ctx.moveTo(cx2 + Math.cos(rot) * rr * 1.9, cy2 + Math.sin(rot) * rr * 1.9);
          ctx.lineTo(cx2 + Math.cos(rot + Math.PI / 4) * rr * 0.35, cy2 + Math.sin(rot + Math.PI / 4) * rr * 0.35);
          ctx.lineTo(cx2 + Math.cos(rot + Math.PI / 2) * rr * 1.9, cy2 + Math.sin(rot + Math.PI / 2) * rr * 1.9);
          ctx.lineTo(cx2 + Math.cos(rot - Math.PI / 4) * rr * 0.35, cy2 + Math.sin(rot - Math.PI / 4) * rr * 0.35);
          ctx.closePath();
        }
      } else {
        ctx.arc(r.x - cam.x, r.y - cam.y, rr, 0, NS.TAU);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
    }
    NS.Particles.draw(ctx, cam);
    NS.DmgNums.draw(ctx, cam);
    NS.Bosses.drawWarn(ctx);

    /* combo fire aura (drawn over player, under HUD flash) */
    if (this.combo >= 100 && this.mode === 'play') {
      const R = 46 + Math.min(34, (this.combo - 100) / 10);
      const flick = 0.16 + Math.sin(performance.now() / 70) * 0.05;
      ctx.fillStyle = 'rgba(255,157,63,' + flick.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(this.player.x - cam.x, this.player.y - cam.y, R, 0, NS.TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,63,0.35)';
      ctx.beginPath();
      ctx.arc(this.player.x - cam.x, this.player.y - cam.y, R, 0, NS.TAU);
      ctx.stroke();
    }

    /* meteor telegraphs */
    if (this.meteors) {
      for (const m of this.meteors) {
        const mx = m.x - cam.x, my = m.y - cam.y;
        if (mx < -40 || my < -40 || mx > NS.VIEW_W + 40 || my > NS.VIEW_H + 40) continue;
        const prog = NS.clamp(m.t / m.warn, 0, 1);
        ctx.strokeStyle = 'rgba(255,157,63,0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mx, my, m.r, 0, NS.TAU);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,157,63,' + (0.1 + prog * 0.35).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(mx, my, m.r * prog, 0, NS.TAU);
        ctx.fill();
        /* falling meteor streak above */
        ctx.strokeStyle = 'rgba(255,210,63,0.7)';
        ctx.beginPath();
        ctx.moveTo(mx + 10 - prog * 8, my - 26 + prog * 10);
        ctx.lineTo(mx + 14 - prog * 8, my - 34 + prog * 10);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    /* hurt flash + low-HP heartbeat */
    if (this.player.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,60,80,' + (this.player.hitFlash / 0.25 * 0.16).toFixed(3) + ')';
      ctx.fillRect(0, 0, NS.VIEW_W, NS.VIEW_H);
    } else if (this.player.hp / this.player.maxHp < 0.3) {
      const pulse = 0.06 + Math.sin(this.state.time * 6) * 0.04;
      ctx.fillStyle = 'rgba(255,60,80,' + pulse.toFixed(3) + ')';
      ctx.fillRect(0, 0, NS.VIEW_W, NS.VIEW_H);
    }

    /* vignette for mood (skipped on low quality) */
    if (NS.Quality.level > 0) {
      const vg = NS.Glow.get('#000000', 200);
      ctx.globalAlpha = 0.35;
      ctx.drawImage(vg, NS.VIEW_W / 2 - 200, NS.VIEW_H / 2 - 200);
      ctx.globalAlpha = 1;
    }

    /* CRT scanlines — pre-rendered once, blitted per frame (style, near-free) */
    if (NS.Quality.level > 1) {
      if (!this._scan) {
        this._scan = document.createElement('canvas');
        this._scan.width = NS.VIEW_W; this._scan.height = 3;
        const sg = this._scan.getContext('2d');
        sg.fillStyle = 'rgba(0,0,0,0.16)';
        sg.fillRect(0, 2, NS.VIEW_W, 1);
      }
      ctx.globalAlpha = 0.5;
      for (let sy = 0; sy < NS.VIEW_H; sy += 3) ctx.drawImage(this._scan, 0, sy);
      ctx.globalAlpha = 1;
    }
  },

  renderMenuBG(ctx) {
    /* drifting neon particles behind menu */
    const t = performance.now() / 1000;
    for (let i = 0; i < 34; i++) {
      const x = (i * 137 + t * (10 + (i % 5) * 8)) % NS.VIEW_W;
      const y = (i * 61 + Math.sin(t * 0.6 + i) * 20) % NS.VIEW_H;
      const col = ['#5ef2ff', '#ff4fa3', '#ffd23f', '#c77dff'][i % 4];
      NS.Glow.draw(ctx, col, x, y, 5 + (i % 3) * 3, 0.25);
    }
  }
};
