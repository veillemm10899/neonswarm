'use strict';
/* ============================================================
   NEONSWARM — enemies.js
   7 enemy types, elite variants, difficulty-scaled spawner.
   Entities are pooled; collision via spatial grid.
   ============================================================ */

NS.Enemies = {
  list: [],
  pool: new NS.Pool(() => ({})),
  _id: 1,

  /* ================= DEFINITIONS ================= */
  DEFS: {
    drone:    { r: 6,  hp: 9,   spd: 56, dmg: 8,  xp: 1, color: '#ff6b6b', shape: 'tri' },
    dart:     { r: 5,  hp: 7,   spd: 98, dmg: 6,  xp: 1, color: '#ff9d3f', shape: 'dart' },
    orbiter:  { r: 7,  hp: 13,  spd: 74, dmg: 8,  xp: 2, color: '#59e0c9', shape: 'diamond', strafe: true },
    splitter: { r: 10, hp: 22,  spd: 44, dmg: 10, xp: 3, color: '#ff9df2', shape: 'hex', splits: true },
    shooter:  { r: 8,  hp: 16,  spd: 34, dmg: 8,  xp: 3, color: '#59e0c9', shape: 'square', ranged: true },
    brute:    { r: 13, hp: 48,  spd: 32, dmg: 18, xp: 5, color: '#8a4fd0', shape: 'square' },
    reaper:   { r: 7,  hp: 30,  spd: 88, dmg: 14, xp: 4, color: '#ff4757', shape: 'dart', lunge: true },
    /* wave 12: phase ghost — blinks forward, spoofs aiming weapons */
    shade:    { r: 8,  hp: 36,  spd: 60, dmg: 15, xp: 6, color: '#6a5acd', shape: 'diamond', phase: true }
  },

  /* unlock times (seconds) */
  UNLOCK: [
    { t: 0, kind: 'drone' },
    { t: 30, kind: 'dart' },
    { t: 65, kind: 'orbiter' },
    { t: 110, kind: 'splitter' },
    { t: 150, kind: 'shooter' },
    { t: 195, kind: 'brute' },
    { t: 245, kind: 'reaper' },
    { t: 330, kind: 'shade' }
  ],

  /* ================= SPAWNER ================= */
  spawnT: 0,

  reset() {
    while (this.list.length) this.pool.give(this.list.pop());
    this.spawnT = 0;
    this._sprites = {}; /* clear sprite cache on new run */
  },

  difficulty(t) {
    /* base curve × abyss multiplier. WAVE 12 (owner: "OP masyado ang character")
       — evolutions + 46 passives made the hero a monster; the swarm keeps pace:
       steeper HP, harder hits, faster late swarms. */
    const ab = (NS.Game.state && NS.Game.state.abyssMult) || 1;
    const m = t / 60;
    return {
      hp: (1 + m * 0.75 + Math.pow(m, 1.85) * 0.16) * ab,
      dmg: (1 + m * 0.26 + m * m * 0.017) * Math.sqrt(ab),
      spd: 1 + Math.min(1.0, m * 0.07)
    };
  },

  update(dt) {
    const s = NS.Game.state;
    const t = s.time;
    const cap = NS.Quality.enemyCap();

    /* spawner — SWARM BAIT passive speeds it up */
    const spawnMult = s.spawnMult || 1;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.list.length < cap) {
      const interval = Math.max(0.2, 1.7 - t / 200);
      this.spawnT = interval / spawnMult;
      const batch = Math.min(38, Math.round((3 + Math.floor(t / 26)) * spawnMult));
      const avail = this.UNLOCK.filter(u => u.t <= t);
      const d = this.difficulty(t);
      const eliteChance = t < 90 ? 0 : Math.min(0.32, 0.04 + (t - 90) / 60 * 0.024);

      /* weight newer unlocks so late waves skew harder (shades worth more) */
      let total = 0;
      for (const u of avail) { u.w = (u.kind === 'shade' ? 2.2 : 1) + Math.max(0, (t - u.t) / 60) * 0.4; total += u.w; }

      for (let i = 0; i < batch; i++) {
        if (this.list.length >= cap) break;
        let roll = NS.rand.next() * total;
        let kind = avail[0].kind;
        for (const u of avail) { roll -= u.w; if (roll <= 0) { kind = u.kind; break; } }
        const elite = NS.rand.next() < eliteChance;
        this.spawn(kind, elite, d);
      }
    }

    /* entity updates */
    const p = NS.Game.player;
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const e = L[i];
      if (e.dead) { this.pool.give(e); L[i] = L[L.length - 1]; L.pop(); continue; }

      if (e.hitT > 0) e.hitT -= dt;
      if (e.windup > 0) e.windup -= dt;
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowAmt = 0; }

      let sx = e.spd * (1 - (e.slowAmt || 0));
      const ang = NS.angleTo(e.x, e.y, p.x, p.y);

      /* shade: phase-blink — every ~2.5s it teleports a chunk closer */
      if (e.def.phase) {
        e.blinkT = (e.blinkT === undefined ? NS.rand.range(1, 2.5) : e.blinkT) - dt;
        if (e.blinkT <= 0) {
          e.blinkT = NS.rand.range(2, 3);
          const d = Math.sqrt(NS.dist2(e.x, e.y, p.x, p.y));
          if (d > 90) {
            const jump = Math.min(120, d - 70);
            e.x += Math.cos(ang) * jump; e.y += Math.sin(ang) * jump;
            NS.Particles.burst(e.x, e.y, 8, { color: '#6a5acd', glow: true, life: 0.35 });
          }
        }
      }

      if (e.def.strafe) {
        /* approach but keep circling */
        const tangent = ang + Math.PI / 2 * (e.dir || 1);
        const mx = Math.cos(ang) * 0.55 + Math.cos(tangent) * 0.8;
        const my = Math.sin(ang) * 0.55 + Math.sin(tangent) * 0.8;
        e.x += mx * sx * dt; e.y += my * sx * dt;
      } else if (e.def.lunge) {
        /* reaper: lunges — white flash telegraph just before it bolts */
        e.lungeT = (e.lungeT === undefined ? NS.rand.range(0, 2) : e.lungeT) - dt;
        if (e.lungeT <= 0) { e.lungeV = 2.6; e.lungeT = NS.rand.range(1.6, 2.6); e.windup = 0; }
        else if (e.lungeT < 0.35) { e.windup = 0.35; }
        if (e.lungeV > 1) { e.lungeV -= dt * 2.2; sx *= e.lungeV; }
        e.x += Math.cos(ang) * sx * dt; e.y += Math.sin(ang) * sx * dt;
      } else {
        e.x += Math.cos(ang) * sx * dt;
        e.y += Math.sin(ang) * sx * dt;
      }

      /* shooter: charge glow (telegraph) then fire */
      if (e.def.ranged) {
        e.shootT = (e.shootT === undefined ? NS.rand.range(1, 2.5) : e.shootT) - dt;
        if (e.shootT <= 0.45 && e.shootT + dt > 0.45) {
          NS.Audio.tone(700, 0.3, 'triangle', 0.035, 0, 950);
        }
        if (e.shootT <= 0 && NS.dist2(e.x, e.y, p.x, p.y) < 340 * 340) {
          e.shootT = 2.4;
          NS.Game.spawnEnemyBullet(e.x, e.y, ang, 120, e.dmg, '#59e0c9');
        }
      }

      /* splitter death handled in damage/kill */

      /* contact damage (+ thorns reflect) */
      const rr = e.r + p.r;
      if (NS.dist2(e.x, e.y, p.x, p.y) < rr * rr) {
        if (NS.Player.damage(p, e.dmg) && NS.Game.state.thorns > 0) {
          NS.Game.damageEnemy(e, NS.Game.state.thorns, 'thorns');
        }
      }

      /* grid insert for weapon queries */
      NS.Grid.insert(e);
    }
  },

  spawn(kind, elite, d) {
    const def = this.DEFS[kind];
    const e = this.pool.make();
    const p = NS.Game.player;
    /* spawn on ring outside view */
    const viewR = Math.hypot(NS.VIEW_W, NS.VIEW_H) / 2 + 30;
    const a = NS.rand.range(0, NS.TAU);
    e.id = this._id++;
    e.kind = kind;
    e.def = def;
    e.x = p.x + Math.cos(a) * viewR;
    e.y = p.y + Math.sin(a) * viewR;
    e.r = def.r * (elite ? 1.6 : 1);
    e.hp = e.maxHp = def.hp * d.hp * (elite ? 6 : 1);
    e.spd = def.spd * d.spd * (elite ? 0.85 : 1) * NS.rand.range(0.9, 1.1);
    e.dmg = def.dmg * d.dmg * (elite ? 1.5 : 1);
    e.xp = def.xp * (elite ? 10 : 1);
    e.color = def.color;
    e.elite = !!elite;
    e.hitT = 0; e.slowT = 0; e.slowAmt = 0;
    e.dead = false;
    e.dir = NS.rand.next() < 0.5 ? 1 : -1;
    e.wob = NS.rand.range(0, NS.TAU);
    this.list.push(e);
    NS.Particles.spawn(e.x, e.y, { color: def.color, glow: true, life: 0.3, size: 3 });
    return e;
  },

  kill(e, silent) {
    if (e.dead) return;
    e.dead = true;
    const s = NS.Game.state;
    s.kills++;
    NS.stats.totalKills++;

    if (e.def.splits && !silent) {
      /* splitters burst into 2 mini drones */
      for (let i = 0; i < 2; i++) {
        const m = this.spawn('drone', false, this.difficulty(s.time));
        m.x = e.x + NS.rand.range(-8, 8);
        m.y = e.y + NS.rand.range(-8, 8);
        m.hp = m.maxHp = m.maxHp * 0.5;
        m.xp = 1;
      }
    }

    NS.Audio.kill();
    NS.Particles.burst(e.x, e.y, e.elite ? 14 : 6, { color: e.color, glow: true, life: 0.45, drag: 0.86 });
    NS.Game.spawnRing(e.x, e.y, e.color, e.elite ? 3 : 1.5, e.r * 2 + (e.elite ? 14 : 7), e.elite ? 0.45 : 0.3);
    NS.Pickups.drop(e);
    if (e.elite) {
      NS.Shake.add(2, 0.2);
      if (NS.rand.next() < 0.3) NS.Pickups.spawnChest(e.x, e.y);
      else if (NS.rand.next() < 0.14) NS.Pickups.spawnPowerup(e.x, e.y, NS.rand.pick(['magnet', 'bomb', 'time']));
    }
    NS.Game.onKill(e);
  },

  /* ================= SPRITE CACHE (the big perf win) =================
     Each (kind, elite, r) renders ONCE to an offscreen canvas —
     body + red threat outline + rim + core + glint. Per-frame cost
     becomes a single drawImage. Flash variants pre-rendered too. */
  _sprites: {},

  sprite(e, flash) {
    const key = e.kind + (e.elite ? 'E' : '') + Math.round(e.r) + (flash ? 'F' : '');
    let c = this._sprites[key];
    if (c) return c;
    const pad = 8;
    const size = Math.ceil((e.r + pad) * 2);
    c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    const s = e.r;

    /* body path by shape */
    const trace = () => {
      g.beginPath();
      switch (e.def.shape) {
        case 'tri':
          g.moveTo(0, -s); g.lineTo(s * 0.9, s * 0.8); g.lineTo(-s * 0.9, s * 0.8); break;
        case 'dart':
          g.moveTo(0, -s * 1.3); g.lineTo(s * 0.7, s); g.lineTo(0, s * 0.4); g.lineTo(-s * 0.7, s); break;
        case 'diamond':
          g.moveTo(0, -s); g.lineTo(s, 0); g.lineTo(0, s); g.lineTo(-s, 0); break;
        case 'hex':
          for (let k = 0; k < 6; k++) {
            const a2 = k / 6 * NS.TAU;
            const px = Math.cos(a2) * s, py = Math.sin(a2) * s;
            if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
          }
          break;
        case 'square':
        default:
          g.rect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6);
      }
      g.closePath();
    };

    /* RED THREAT OUTLINE — hostiles always read as enemies */
    trace();
    g.strokeStyle = flash ? 'rgba(255,255,255,0.95)' : 'rgba(255,60,70,0.9)';
    g.lineWidth = 2;
    g.stroke();

    /* body fill */
    trace();
    g.fillStyle = flash ? '#ffffff' : e.color;
    g.fill();

    /* inner shade + glint */
    g.fillStyle = 'rgba(10,10,26,0.5)';
    g.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillRect(-s * 0.45, -s * 0.5, 1.5, 1.5);

    /* elite ring baked in */
    if (e.elite) {
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(0, 0, s + 4, 0, NS.TAU); g.stroke();
    }

    this._sprites[key] = c;
    return c;
  },

  /* ================= RENDER ================= */
  draw(ctx, cam, time) {
    const L = this.list;
    const lowQ = NS.Quality.level === 0;
    for (let i = 0; i < L.length; i++) {
      const e = L[i];
      if (e.dead) continue;
      const x = e.x - cam.x, y = e.y - cam.y;
      if (x < -30 || y < -30 || x > NS.VIEW_W + 30 || y > NS.VIEW_H + 30) continue;

      const flash = e.hitT > 0 || e.windup > 0;
      const charging = e.def.ranged && e.shootT !== undefined && e.shootT < 0.45;

      /* glow halo skipped on low quality */
      if (!lowQ) {
        NS.Glow.draw(ctx, e.color, x, y, e.r * (charging ? 3.1 : 2.4), e.elite ? 0.85 : (charging ? 0.8 : 0.5));
      }

      /* pre-rendered sprite blit (wobble via cheap rotation only on high q) */
      const spr = this.sprite(e, flash);
      if (lowQ) {
        ctx.drawImage(spr, x - spr.width / 2, y - spr.height / 2);
      } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(time * 6 + e.wob) * 0.15);
        ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
        ctx.restore();
      }

      /* charging telegraph */
      if (charging && !lowQ) {
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 + (0.45 - e.shootT) * 1.2).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(x, y, e.r + 5 + (0.45 - e.shootT) * 8, 0, NS.TAU);
        ctx.stroke();
      }

      /* elite crown pips */
      if (e.elite && !lowQ) {
        ctx.fillStyle = '#ffffff';
        for (let k = 0; k < 3; k++) {
          const aa = time * 1.5 + k * NS.TAU / 3;
          ctx.fillRect(x + Math.cos(aa) * (e.r + 7) - 1, y + Math.sin(aa) * (e.r + 7) - 1, 2, 2);
        }
      }

      /* elite hp bar */
      if (e.elite && e.hp < e.maxHp) {
        ctx.fillStyle = '#3a1a28';
        ctx.fillRect(x - 12, y - e.r - 9, 24, 3);
        ctx.fillStyle = '#ff4fa3';
        ctx.fillRect(x - 12, y - e.r - 9, 24 * (e.hp / e.maxHp), 3);
      }
    }
  }
};
