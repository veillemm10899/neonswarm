'use strict';
/* ============================================================
   NEONSWARM — player.js
   Layered hero ship (white + gold): banking tilt, engine trail,
   animated fins, optional shield orbit (GUARDIAN), status rings.
   ============================================================ */

NS.Player = {
  create() {
    return {
      x: 0, y: 0, r: 9,
      speed: 118,
      hp: 100, maxHp: 100,
      regen: 0.2,          /* hp per second */
      armor: 0,            /* flat damage reduction */
      magnet: 54,          /* pickup radius */
      xp: 0, level: 1,
      xpNext: 5,
      invulnT: 0,
      hitFlash: 0,
      anim: 0,
      vx: 0, vy: 0,
      shieldCd: 0,         /* GUARDIAN block cooldown */
      trailT: 0,
      moveOut: { x: 0, y: 0 }
    };
  },

  xpFor(level) { return Math.floor(4 + (level - 1) * 3 + Math.pow(level - 1, 1.85)); },

  update(p, dt) {
    const mv = NS.Input.moveVector(p.moveOut);
    const sp = p.speed;
    p.vx = mv.x * sp; p.vy = mv.y * sp;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.anim += dt * (mv.x || mv.y ? 9 : 2);

    /* engine trail particles */
    p.trailT -= dt;
    if ((mv.x || mv.y) && p.trailT <= 0) {
      p.trailT = 0.05;
      NS.Particles.spawn(p.x - p.vx * 0.03, p.y - p.vy * 0.03, {
        color: '#ffd23f', glow: true, life: 0.32, size: 2,
        drag: 0.9, vx: -p.vx * 0.2, vy: -p.vy * 0.2
      });
    }

    /* regen */
    if (p.regen > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    }

    if (p.invulnT > 0) p.invulnT -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;
    if (p.shieldCd > 0) p.shieldCd -= dt;
  },

  gainXP(p, amount) {
    p.xp += amount;
    let leveled = false;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = this.xpFor(p.level);
      leveled = true;
    }
    if (leveled) {
      NS.Audio.levelup();
      NS.Shake.add(2, 0.2);
      NS.Particles.burst(p.x, p.y, 16, { color: '#ffd23f', glow: true, life: 0.6 });
      NS.Game.spawnRing(p.x, p.y, '#ffd23f', 10, 46, 0.45);
      /* ADRENALINE: heal on level up */
      const adr = NS.Game.state.adrenaline || 0;
      if (adr > 0 && p.hp < p.maxHp) {
        NS.Player.heal(p, 2 * adr);
      }
      NS.Game.pendingLevelUps++;
    }
  },

  damage(p, amount) {
    if (p.invulnT > 0) return false;
    /* PHASE DRIVE: chance to take zero damage */
    const dg = (NS.Game.state && NS.Game.state.dodge) || 0;
    if (dg > 0 && NS.rand.next() < dg) {
      p.invulnT = 0.15;
      NS.DmgNums.add(p.x, p.y - 14, 'DODGE', '#c77dff', true);
      NS.Audio.tone(1100, 0.08, 'sine', 0.05, 0, 500);
      return false;
    }
    /* BULWARK: flat damage reduction per rank */
    const bl = NS.Game.state.bulwark || 0;
    if (bl > 0) amount *= 1 - Math.min(0.3, bl * 0.06);
    /* GUARDIAN: shield orbit blocks one hit on cooldown */
    if (NS.Game.state.shieldLvl > 0 && p.shieldCd <= 0) {
      p.shieldCd = 9 - NS.Game.state.shieldLvl * 1.5; /* 7.5s .. 6s */
      p.invulnT = 0.8;
      NS.Audio.tone(520, 0.18, 'triangle', 0.12, 0, 1040);
      NS.Game.spawnRing(p.x, p.y, '#bfe8ff', 3, 24, 0.35);
      NS.Particles.burst(p.x, p.y, 10, { color: '#bfe8ff', glow: true, life: 0.4 });
      NS.DmgNums.add(p.x, p.y - 14, 'BLOCK', '#bfe8ff', true);
      return false;
    }
    const real = Math.max(1, Math.round(amount - p.armor));
    p.hp -= real;
    p.invulnT = 0.5;
    p.hitFlash = 0.25;
    NS.Shake.add(3, 0.25);
    NS.Audio.hurt();
    NS.DmgNums.add(p.x, p.y - 12, '-' + real, '#ff5e6c');
    /* RETRIBUTION: light the fuse — nova detonates ~0.35s after the hit */
    if (NS.Game.state.retribution > 0 && NS.Game.retriFuse <= 0) {
      NS.Game.retriFuse = 0.35;
    }
    if (p.hp <= 0) {
      /* SECOND WIND: one free revive per run if the passive is owned */
      if (NS.Game.state.secondWind) {
        NS.Game.state.secondWind = false;
        p.hp = Math.round(p.maxHp * 0.5);
        p.invulnT = 2;
        NS.Audio.victory();
        NS.Shake.add(5, 0.4);
        NS.Particles.burst(p.x, p.y, 26, { color: '#7dff9a', glow: true, life: 0.8 });
        NS.Game.spawnRing(p.x, p.y, '#7dff9a', 12, 70, 0.6);
        NS.UI.toast('SECOND WIND! You refuse to die.', true);
        NS.DmgNums.add(p.x, p.y - 18, 'REVIVED', '#7dff9a', true);
        return false;
      }
      p.hp = 0;
      NS.Game.onDeath();
    }
    return true;
  },

  heal(p, amount) {
    p.hp = Math.min(p.maxHp, p.hp + amount);
    NS.Audio.heal();
    NS.DmgNums.add(p.x, p.y - 14, '+' + amount, '#7dff9a');
  },

  /* ---------- rendering: layered white + gold hero ship ---------- */
  draw(ctx, p, cam, time) {
    const sx = p.x - cam.x, sy = p.y - cam.y;
    const blink = p.invulnT > 0 && Math.floor(p.invulnT * 16) % 2 === 0;
    const st = NS.Game.state;

    /* magnet field hint (soft gold) */
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(sx, sy, p.magnet, 0, NS.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    /* GUARDIAN shield orbit: bright when ready, fading while on cooldown */
    if (st && st.shieldLvl > 0) {
      const ready = p.shieldCd <= 0;
      const a = ready ? 0.5 + Math.sin(time * 5) * 0.12 : 0.14;
      ctx.strokeStyle = 'rgba(191,232,255,' + a.toFixed(2) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, p.r + 7, 0, NS.TAU);
      ctx.stroke();
      if (ready) {
        /* three orbiting sparks */
        ctx.fillStyle = '#bfe8ff';
        for (let k = 0; k < 3; k++) {
          const aa = time * 2.2 + k * NS.TAU / 3;
          ctx.fillRect(sx + Math.cos(aa) * (p.r + 7) - 1, sy + Math.sin(aa) * (p.r + 7) - 1, 2, 2);
        }
      }
      ctx.lineWidth = 1;
    }

    /* twin engine flames */
    const moving = p.vx !== 0 || p.vy !== 0;
    const fl = moving ? 9 + Math.sin(time * 34) * 3 : 4.5;
    NS.Glow.draw(ctx, '#ffb14f', sx, sy + 9, fl, 0.55);
    NS.Glow.draw(ctx, '#ffd23f', sx, sy + 7, fl * 0.55, 0.7);

    /* banking tilt: lean into horizontal movement */
    const bank = NS.clamp(p.vx * 0.004, -0.35, 0.35);
    const ang = moving ? Math.atan2(p.vy, p.vx) : -Math.PI / 2;
    if (blink) ctx.globalAlpha = 0.45;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate((moving ? ang + Math.PI / 2 : 0) + bank);

    /* white halo — hero signature */
    NS.Glow.draw(ctx, '#ffffff', 0, 0, 15, 0.5);

    /* diamond hull with gradient */
    const hull = ctx.createLinearGradient(0, -12, 0, 11);
    hull.addColorStop(0, p.hitFlash > 0 ? '#ffe9a3' : '#ffffff');
    hull.addColorStop(1, p.hitFlash > 0 ? '#ffb14f' : '#dfe9ff');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(8, 5);
    ctx.lineTo(0, 11);
    ctx.lineTo(-8, 5);
    ctx.closePath();
    ctx.fill();

    /* white rim light */
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();

    /* animated fins (flutter while moving) */
    const finY = moving ? Math.sin(time * 12) * 1.2 : 0;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(-8, 4 + finY); ctx.lineTo(-12, 8 + finY); ctx.lineTo(-7, 7); ctx.closePath();
    ctx.moveTo(8, 4 + finY); ctx.lineTo(12, 8 + finY); ctx.lineTo(7, 7); ctx.closePath();
    ctx.fill();

    /* gold core + dark eye + glint */
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-2.5, -4, 5, 7);
    ctx.fillStyle = '#0a0a16';
    ctx.fillRect(-1, -0.5, 2, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(-3, -7, 2, 2);
    ctx.restore();
    ctx.globalAlpha = 1;

    /* level crown: rotating gold ring at LV20+ */
    if (p.level >= 20) {
      ctx.strokeStyle = 'rgba(255,210,63,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(sx, sy, p.r + 11, time * 0.9, time * 0.9 + NS.TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
    }
  }
};
