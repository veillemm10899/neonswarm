'use strict';
/* ============================================================
   NEONSWARM — bosses.js
   6 boss patterns cycling with rising mk-levels; OMEGA at 15:00.
   Every attack is telegraphed. Kill OMEGA to win (or continue
   into the endless abyss).
   ============================================================ */

NS.Bosses = {
  active: null,   /* current boss entity */
  nextAt: 80,
  mk: 1,
  cycle: 0,
  warnT: 0, warnName: '',

  BOSSES: [
    {
      id: 'devourer', name: 'DEVOURER', color: '#ff4757', r: 22,
      hp: 560, spd: 46, dmg: 25, xp: 60,
      /* pattern: chase + telegraphed charge */
      update(b, dt) {
        b.t += dt;
        const p = NS.Game.player;
        const ang = NS.angleTo(b.x, b.y, p.x, p.y);
        if (b.phase === 'chase') {
          b.x += Math.cos(ang) * b.spd * dt;
          b.y += Math.sin(ang) * b.spd * dt;
          if (b.t > 3.2) { b.phase = 'aim'; b.t = 0; b.aimAng = ang; }
        } else if (b.phase === 'aim') {
          b.aimAng = NS.lerp(b.aimAng, ang, dt * 2);
          if (b.t > 0.7) { b.phase = 'dash'; b.t = 0; NS.Audio.boss(); }
        } else if (b.phase === 'dash') {
          b.x += Math.cos(b.aimAng) * 320 * dt;
          b.y += Math.sin(b.aimAng) * 320 * dt;
          NS.Particles.spawn(b.x, b.y, { color: b.color, glow: true, life: 0.3 });
          if (b.t > 0.55) { b.phase = 'chase'; b.t = 0; }
        }
      }
    },
    {
      id: 'hivequeen', name: 'HIVE QUEEN', color: '#ff9df2', r: 24,
      hp: 900, spd: 30, dmg: 22, xp: 80,
      /* pattern: orbit player loosely, spawn drones, radial bursts */
      update(b, dt) {
        b.t += dt;
        const p = NS.Game.player;
        const ang = NS.angleTo(b.x, b.y, p.x, p.y);
        const d = NS.dist(b.x, b.y, p.x, p.y);
        const want = 160;
        const move = d > want ? 1 : -0.6;
        const tangent = ang + Math.PI / 2 * (b.dir || 1);
        b.x += (Math.cos(ang) * 0.5 * move + Math.cos(tangent) * 0.7) * b.spd * dt;
        b.y += (Math.sin(ang) * 0.5 * move + Math.sin(tangent) * 0.7) * b.spd * dt;

        if (b.t > 3.0) {
          b.t = 0;
          if (NS.rand.next() < 0.55) {
            const n = 3 + (b.mk > 2 ? 2 : 0);
            for (let i = 0; i < n; i++) NS.Enemies.spawn('drone', false, NS.Enemies.difficulty(NS.Game.state.time));
          } else {
            const n = 10 + b.mk * 2;
            for (let i = 0; i < n; i++) {
              NS.Game.spawnEnemyBullet(b.x, b.y, i / n * NS.TAU + b.t, 100, b.dmg * 0.6, b.color);
            }
            NS.Audio.boss();
          }
        }
      }
    },
    {
      id: 'sentinel', name: 'VOID SENTINEL', color: '#b56cff', r: 26,
      hp: 1250, spd: 22, dmg: 25, xp: 100,
      /* pattern: slow drift + spiral bullets */
      update(b, dt) {
        b.t += dt;
        const p = NS.Game.player;
        const ang = NS.angleTo(b.x, b.y, p.x, p.y);
        b.x += Math.cos(ang) * b.spd * dt * 0.5;
        b.y += Math.sin(ang) * b.spd * dt * 0.5;
        b.spiral = (b.spiral || 0) + dt * 3.4;
        b.fireT = (b.fireT || 0) - dt;
        if (b.fireT <= 0) {
          b.fireT = 0.16;
          const arms = 3 + (b.mk > 2 ? 1 : 0);
          for (let i = 0; i < arms; i++) {
            NS.Game.spawnEnemyBullet(b.x, b.y, b.spiral + i * NS.TAU / arms, 95, b.dmg * 0.5, b.color);
          }
        }
      }
    },
    /* ---------- NEW: telegraphed lightning strikes ---------- */
    {
      id: 'storm', name: 'STORMBRINGER', color: '#ffe45e', r: 24,
      hp: 1500, spd: 42, dmg: 26, xp: 120,
      update(b, dt) {
        b.t += dt;
        const p = NS.Game.player;
        /* lazy drift toward player */
        const ang = NS.angleTo(b.x, b.y, p.x, p.y);
        b.x += Math.cos(ang) * b.spd * dt * 0.55;
        b.y += Math.sin(ang) * b.spd * dt * 0.55;

        b.castT = (b.castT === undefined ? 1.5 : b.castT) - dt;
        if (b.castT <= 0) {
          b.castT = 3.2;
          const n = 3 + (b.mk > 1 ? 2 : 0);
          b.strikes = [];
          for (let i = 0; i < n; i++) {
            b.strikes.push({
              x: p.x + NS.rand.range(-80, 80),
              y: p.y + NS.rand.range(-80, 80),
              t: 0, warn: 1.1
            });
          }
          NS.Audio.tone(160, 0.35, 'sawtooth', 0.1, 0, 900);
        }
        if (b.strikes) {
          for (let i = b.strikes.length - 1; i >= 0; i--) {
            const st = b.strikes[i];
            st.t += dt;
            if (st.t >= st.warn) {
              const rr = 34;
              if (NS.dist2(p.x, p.y, st.x, st.y) < rr * rr) NS.Player.damage(p, b.dmg);
              NS.Game.spawnRing(st.x, st.y, '#ffe45e', 3, 42, 0.35);
              NS.Particles.burst(st.x, st.y, 12, { color: '#ffe45e', glow: true, life: 0.4 });
              NS.Audio.tone(1500, 0.12, 'square', 0.09, 0, 220);
              NS.Shake.add(2, 0.15);
              b.strikes.splice(i, 1);
            }
          }
        }
      }
    },
    /* ---------- NEW: shield phases — burst it when open ---------- */
    {
      id: 'crystal', name: 'MOTHER CRYSTAL', color: '#59e0c9', r: 27,
      hp: 1900, spd: 26, dmg: 24, xp: 150,
      update(b, dt) {
        b.t += dt;
        const p = NS.Game.player;
        /* slow approach, keeps distance */
        const ang = NS.angleTo(b.x, b.y, p.x, p.y);
        const d = NS.dist(b.x, b.y, p.x, p.y);
        const move = d > 190 ? 0.8 : -0.4;
        b.x += Math.cos(ang) * b.spd * dt * move;
        b.y += Math.sin(ang) * b.spd * dt * move;

        b.phaseT = (b.phaseT === undefined ? 3.5 : b.phaseT) - dt;
        if (b.shieldUp) {
          if (b.phaseT <= 0) {
            /* shield OPENS — radial burst + vulnerable window */
            b.shieldUp = false;
            b.phaseT = 3.6;
            const n = 14;
            for (let i = 0; i < n; i++) {
              NS.Game.spawnEnemyBullet(b.x, b.y, i / n * NS.TAU, 90, b.dmg * 0.5, b.color);
            }
            NS.Game.spawnRing(b.x, b.y, '#ffffff', 3, 60, 0.4);
            NS.Audio.boss();
            /* escorts while exposed */
            for (let i = 0; i < 2; i++) NS.Enemies.spawn('orbiter', false, NS.Enemies.difficulty(NS.Game.state.time));
          }
        } else {
          if (b.phaseT <= 0) {
            b.shieldUp = true;
            b.phaseT = 4.2;
            NS.Audio.tone(300, 0.2, 'triangle', 0.1, 0, 600);
          }
        }
      }
    },
    /* ---------- NEW: rotating laser sweep ---------- */
    {
      id: 'architect', name: 'THE ARCHITECT', color: '#ff4fa3', r: 25,
      hp: 2300, spd: 30, dmg: 26, xp: 180,
      update(b, dt) {
        b.t += dt;
        const p = NS.Game.player;
        /* keeps mid distance, strafes */
        const ang = NS.angleTo(b.x, b.y, p.x, p.y);
        const d = NS.dist(b.x, b.y, p.x, p.y);
        const move = d > 200 ? 0.9 : (d < 150 ? -0.7 : 0);
        const tangent = ang + Math.PI / 2 * (b.dir || 1);
        b.x += (Math.cos(ang) * move + Math.cos(tangent) * 0.5) * b.spd * dt;
        b.y += (Math.sin(ang) * move + Math.sin(tangent) * 0.5) * b.spd * dt;

        /* rotating beam */
        b.laserAng = (b.laserAng || 0) + dt * (0.9 + b.mk * 0.15);
        b.laserLen = 300;
        const c = Math.cos(b.laserAng), s2 = Math.sin(b.laserAng);
        const dx = p.x - b.x, dy = p.y - b.y;
        const along = dx * c + dy * s2;
        const perp = Math.abs(-dx * s2 + dy * c);
        if (along > 0 && along < b.laserLen && perp < 6 + p.r) {
          NS.Player.damage(p, b.dmg * 0.8);
        }

        /* aimed spread */
        b.fireT = (b.fireT === undefined ? 2.5 : b.fireT) - dt;
        if (b.fireT <= 0) {
          b.fireT = 2.6;
          for (let i = -1; i <= 1; i++) {
            NS.Game.spawnEnemyBullet(b.x, b.y, ang + i * 0.22, 130, b.dmg * 0.5, b.color);
          }
        }
      }
    },

    /* ---------- NEW wave 12: MOLOCH — bullet-hell walls + summoner ---------- */
    {
      id: 'moloch', name: 'MOLOCH', color: '#ff6b9d', r: 30,
      hp: 3400, spd: 26, dmg: 30, xp: 240,
      update(b, dt) {
        b.t += dt;
        const p = NS.Game.player;
        const ang = NS.angleTo(b.x, b.y, p.x, p.y);
        const d = NS.dist(b.x, b.y, p.x, p.y);
        /* keeps mid distance, slowly herding the player */
        const move = d > 220 ? 0.8 : (d < 150 ? -0.5 : 0);
        const tangent = ang + Math.PI / 2 * (b.dir || 1);
        b.x += (Math.cos(ang) * move + Math.cos(tangent) * 0.4) * b.spd * dt;
        b.y += (Math.sin(ang) * move + Math.sin(tangent) * 0.4) * b.spd * dt;

        /* WALL: two rotating fans of bullets with a dodge gap */
        b.wallA = (b.wallA || 0) + dt * 0.8;
        b.wallT = (b.wallT === undefined ? 2.5 : b.wallT) - dt;
        if (b.wallT <= 0) {
          b.wallT = 3.2;
          const gap = NS.rand.range(0, NS.TAU);
          const n = 22;
          for (let i = 0; i < n; i++) {
            const a = b.wallA + i / n * NS.TAU;
            let da = Math.abs(a - gap) % NS.TAU;
            if (da > Math.PI) da = NS.TAU - da;
            if (da < 0.55) continue; /* the dodge gap */
            NS.Game.spawnEnemyBullet(b.x, b.y, a, 95, b.dmg * 0.45, b.color);
          }
          NS.Audio.tone(90, 0.4, 'sawtooth', 0.12, 0, 40);
        }

        /* summons shades while alive */
        b.summonT = (b.summonT === undefined ? 4 : b.summonT) - dt;
        if (b.summonT <= 0) {
          b.summonT = 6.5;
          for (let i = 0; i < 3; i++) NS.Enemies.spawn('shade', false, NS.Enemies.difficulty(NS.Game.state.time));
          NS.UI.toast('MOLOCH calls the shades...', false);
        }
      }
    },

    /* ---------- NEW: time warden — freezes your weapons ---------- */
    {
      id: 'chronos', name: 'CHRONOS', color: '#eaf2ff', r: 26,
      hp: 2600, spd: 36, dmg: 24, xp: 200,
      update(b, dt) {
        b.t += dt;
        const p = NS.Game.player;
        const ang = NS.angleTo(b.x, b.y, p.x, p.y);
        const d = NS.dist(b.x, b.y, p.x, p.y);
        /* drifts to mid-range */
        const move = d > 180 ? 0.9 : (d < 120 ? -0.5 : 0.15);
        b.x += Math.cos(ang) * b.spd * dt * move;
        b.y += Math.sin(ang) * b.spd * dt * move;

        /* clock hands always turning (visual anchor) */
        b.clockA = (b.clockA || 0) + dt * 2;

        /* TIME-LOCK: freeze all weapon cooldowns for 2.2s */
        b.lockT = (b.lockT === undefined ? 4 : b.lockT) - dt;
        if (b.lockT <= 0) {
          b.lockT = 6.5;
          NS.Game.state.timeLock = 2.2;
          NS.UI.toast('TIME-LOCK! Weapons frozen!', true);
          NS.Audio.tone(200, 0.4, 'sine', 0.12, 0, 800);
        }

        /* slow bullets while locked (player must dodge, not shoot) */
        b.fireT = (b.fireT === undefined ? 2 : b.fireT) - dt;
        if (b.fireT <= 0) {
          b.fireT = 1.6;
          for (let i = 0; i < 8; i++) {
            NS.Game.spawnEnemyBullet(b.x, b.y, i / 8 * NS.TAU + b.clockA, 85, b.dmg * 0.5, b.color);
          }
        }
      }
    }
  ],

  OMEGA: {
    id: 'omega', name: 'OMEGA PROTOCOL', color: '#5ef2ff', r: 34,
    hp: 26000, spd: 40, dmg: 34, xp: 600,
    final: true,
    update(b, dt) {
      b.t += dt;
      const p = NS.Game.player;
      const ang = NS.angleTo(b.x, b.y, p.x, p.y);
      if (b.phase === undefined) b.phase = 'spiral';
      b.spiral = (b.spiral || 0) + dt * 3;
      if (b.phase === 'spiral') {
        b.x += Math.cos(ang) * b.spd * dt * 0.4;
        b.y += Math.sin(ang) * b.spd * dt * 0.4;
        b.fireT = (b.fireT || 0) - dt;
        if (b.fireT <= 0) {
          b.fireT = 0.14;
          for (let i = 0; i < 2; i++) {
            NS.Game.spawnEnemyBullet(b.x, b.y, b.spiral + i * Math.PI, 100, b.dmg * 0.45, b.color);
          }
        }
        if (b.t > 4) { b.phase = 'spawn'; b.t = 0; }
      } else if (b.phase === 'spawn') {
        if (b.t > 0.8) {
          for (let i = 0; i < 4; i++) NS.Enemies.spawn('reaper', false, NS.Enemies.difficulty(NS.Game.state.time));
          b.phase = 'aim'; b.t = 0;
        }
      } else if (b.phase === 'aim') {
        b.aimAng = NS.lerp(b.aimAng || ang, ang, dt * 3);
        if (b.t > 0.6) { b.phase = 'dash'; b.t = 0; NS.Audio.boss(); }
      } else if (b.phase === 'dash') {
        b.x += Math.cos(b.aimAng) * 360 * dt;
        b.y += Math.sin(b.aimAng) * 360 * dt;
        if (b.t > 0.5) { b.phase = 'spiral'; b.t = 0; }
      }
    }
  },

  reset() {
    this.active = null;
    this.nextAt = 80;
    this.mk = 1;
    this.cycle = 0;
    this.warnT = 0;
  },

  update(dt) {
    const s = NS.Game.state;
    const t = s.time;

    if (this.warnT > 0) this.warnT -= dt;

    /* schedule bosses — OMEGA at 30:00 (1800s), not 15:00.
       Between 15:00 and 30:00, regular bosses keep cycling with
       escalating MK levels so the player is never bored. */
    if (!this.active && t >= this.nextAt && this.nextAt > 0) {
      const isFinal = t >= 1800 && !s.endless;
      this.spawnBoss(isFinal);
      this.nextAt = isFinal ? 0 : this.nextAt + (t > 900 ? 60 : 75);
    }

    const b = this.active;
    if (b) {
      /* ENRAGE at 30% HP: boss gets faster, meaner, visibly on fire.
         One-shot per boss — the toast is the warning. */
      if (!b.enraged && b.hp < b.maxHp * 0.3) {
        b.enraged = true;
        b.spd *= 1.35;
        NS.UI.toast('⚠ ' + b.name + ' IS ENRAGED!', true);
        NS.Audio.setIntense(true);
        NS.Shake.add(5, 0.5);
        NS.Audio.tone(60, 0.6, 'sawtooth', 0.16, 0, 30);
      }
      b.def.update(b, b.enraged ? dt * 1.25 : dt);
      const p = NS.Game.player;
      const rr = b.r + p.r;
      if (NS.dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        NS.Player.damage(p, b.dmg);
      }
      /* leash keeps the schedule moving */
      const far = NS.dist2(b.x, b.y, p.x, p.y) > 700 * 700;
      if (far) {
        b.away = (b.away || 0) + dt;
        if (b.away > 8) {
          this.active = null;
          NS.UI.toast(b.name + ' lost interest... next boss soon.');
          this.nextAt = t + 25;
          return;
        }
      } else b.away = 0;
      NS.Grid.insert(b);
    }
  },

  spawnBoss(isFinal) {
    const def = isFinal ? this.OMEGA : this.BOSSES[this.cycle % this.BOSSES.length];
    const p = NS.Game.player;
    const a = NS.rand.range(0, NS.TAU);
    const viewR = Math.hypot(NS.VIEW_W, NS.VIEW_H) / 2 + 60;
    const mkMult = Math.pow(1.65, this.mk - 1);

    const b = {
      isBoss: true, id: 'boss',
      def, kind: def.id,
      x: p.x + Math.cos(a) * viewR,
      y: p.y + Math.sin(a) * viewR,
      r: def.r,
      hp: def.hp * mkMult, maxHp: def.hp * mkMult,
      spd: def.spd, dmg: def.dmg,
      xp: def.xp,
      color: def.color,
      t: 0, phase: 'chase',
      shieldUp: def.id === 'crystal',
      mk: this.mk,
      name: def.name + (this.mk > 1 ? ' MK-' + this.mk : ''),
      hitT: 0, dead: false
    };
    this.active = b;
    this.warnT = 2.2;
    this.warnName = b.name;
    NS.Audio.boss();
    NS.Audio.setIntense(true);
    NS.Shake.add(4, 0.5);
    if (isFinal) NS.UI && NS.UI.toast && NS.UI.toast('FINAL BOSS — ' + b.name, true);
    this.cycle++;
    if (this.cycle % 2 === 0) this.mk++;
  },

  damageBoss(b, dmg) {
    b.hp -= dmg;
    b.hitT = 0.08;
    if (b.hp <= 0 && !b.dead) {
      b.dead = true;
      this.active = null;
      const s = NS.Game.state;
      s.bossKills++;
      NS.stats.best.bossKills++;
      if (b.def.final && !s.endless) {
        s.won = true;
        NS.stats.wins++;
        NS.Audio.victory();
        NS.Game.onVictory();
      } else {
        NS.Audio.chest();
        NS.UI.toast('BOSS DOWN — ' + b.name, true);
      }
      NS.Audio.setIntense(false);
      NS.Game.slowmo = b.def.final ? 2.5 : 1.2;
      NS.Shake.add(6, 0.6);
      NS.Particles.burst(b.x, b.y, 40, { color: b.color, glow: true, life: 0.9, drag: 0.9 });
      NS.Game.spawnRing(b.x, b.y, b.color, 5, 150, 0.8);
      NS.Game.spawnRing(b.x, b.y, '#ffffff', 3, 90, 0.5);
      for (let i = 0; i < 14; i++) NS.Pickups.spawnGem(b.x + NS.rand.range(-30, 30), b.y + NS.rand.range(-30, 30), 5);
      NS.Pickups.spawnGem(b.x, b.y, 25);
      NS.Pickups.spawnHeart(b.x + 14, b.y);
      NS.Pickups.spawnChest(b.x - 14, b.y);
    }
  },

  draw(ctx, cam, time) {
    const b = this.active;
    if (!b) return;
    const x = b.x - cam.x, y = b.y - cam.y;
    const flash = b.hitT > 0;
    if (b.hitT > 0) b.hitT -= 1 / 60;

    /* enrage aura: pulsing red ring while the boss is over 9000 */
    if (b.enraged) {
      const ra = 0.25 + Math.sin(time * 10) * 0.15;
      ctx.strokeStyle = 'rgba(255,60,70,' + ra.toFixed(2) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, b.r + 10 + Math.sin(time * 10) * 3, 0, NS.TAU);
      ctx.stroke();
      ctx.lineWidth = 1;
      NS.Glow.draw(ctx, '#ff4757', x, y, b.r * 4, 0.5);
    }
    NS.Glow.draw(ctx, b.color, x, y, b.r * 3, 0.9);
    const pulse = 1 + Math.sin(time * 5) * 0.08;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * (b.def.final ? 1.2 : 0.7));
    ctx.fillStyle = flash ? '#ffffff' : b.color;
    const s = b.r * pulse;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a2 = k / 8 * NS.TAU;
      const rr = k % 2 === 0 ? s : s * 0.62;
      const px = Math.cos(a2) * rr, py = Math.sin(a2) * rr;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(8,8,22,0.6)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.4, 0, NS.TAU);
    ctx.fill();
    ctx.restore();

    /* stormbringer: lightning strike telegraphs */
    if (b.strikes) {
      for (const st of b.strikes) {
        const sx = st.x - cam.x, sy = st.y - cam.y;
        const prog = NS.clamp(st.t / st.warn, 0, 1);
        ctx.strokeStyle = 'rgba(255,228,94,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 34, 0, NS.TAU);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,228,94,' + (0.15 + prog * 0.4).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(sx, sy, 34 * prog, 0, NS.TAU);
        ctx.fill();
        ctx.lineWidth = 1;
      }
    }

    /* mother crystal: shield bubble */
    if (b.shieldUp) {
      const shimmer = 0.35 + Math.sin(time * 6) * 0.12;
      ctx.strokeStyle = 'rgba(255,255,255,' + shimmer.toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, b.r + 9, 0, NS.TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(89,224,201,0.08)';
      ctx.beginPath();
      ctx.arc(x, y, b.r + 9, 0, NS.TAU);
      ctx.fill();
      ctx.lineWidth = 1;
    }

    /* architect: rotating laser */
    if (b.laserAng !== undefined) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(b.laserAng);
      const grad = ctx.createLinearGradient(0, 0, b.laserLen, 0);
      grad.addColorStop(0, 'rgba(255,79,163,0.75)');
      grad.addColorStop(1, 'rgba(255,79,163,0.12)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, -2.5, b.laserLen, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(0, -1, b.laserLen, 2);
      NS.Glow.draw(ctx, '#ff4fa3', 0, 0, 8, 0.7);
      ctx.restore();
    }

    /* CHRONOS: rotating clock hands */
    if (b.clockA !== undefined) {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = 'rgba(234,242,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(b.clockA) * b.r * 1.3, Math.sin(b.clockA) * b.r * 1.3); ctx.stroke();
      ctx.strokeStyle = 'rgba(160,180,230,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(b.clockA * 0.5 + 2) * b.r * 1.05, Math.sin(b.clockA * 0.5 + 2) * b.r * 1.05); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.restore();
    }

    /* top HP bar */
    const w = NS.VIEW_W * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect((NS.VIEW_W - w) / 2 - 2, 14, w + 4, 10);
    ctx.fillStyle = b.color;
    ctx.fillRect((NS.VIEW_W - w) / 2, 16, w * NS.clamp(b.hp / b.maxHp, 0, 1), 6);
    if (b.shieldUp) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect((NS.VIEW_W - w) / 2, 16, w * NS.clamp(b.hp / b.maxHp, 0, 1), 2);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(b.name, NS.VIEW_W / 2, 12);
    ctx.textAlign = 'left';
  },

  drawWarn(ctx) {
    if (this.warnT <= 0) return;
    const a = Math.min(1, this.warnT) * (Math.floor(this.warnT * 6) % 2 === 0 ? 1 : 0.4);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ff4757';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ ' + this.warnName + ' ⚠', NS.VIEW_W / 2, NS.VIEW_H * 0.3);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
};
