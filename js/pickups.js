'use strict';
/* ============================================================
   NEONSWARM — pickups.js
   XP gems (merge to keep counts sane), hearts, chests,
   magnet vacuum. Everything pooled.
   ============================================================ */

NS.Pickups = {
  gems: [], hearts: [], chests: [], powers: [],
  goblin: null, goblinCd: 60,
  pool: new NS.Pool(() => ({})),

  reset() {
    while (this.gems.length) this.pool.give(this.gems.pop());
    while (this.hearts.length) this.pool.give(this.hearts.pop());
    while (this.chests.length) this.pool.give(this.chests.pop());
    while (this.powers.length) this.pool.give(this.powers.pop());
    this.goblin = null; this.goblinCd = 60;
  },

  /* ---------- XP gems ---------- */
  drop(e) {
    const n = Math.min(5, Math.ceil(e.xp / 4));
    const per = Math.max(1, Math.round(e.xp / n));
    for (let i = 0; i < n; i++) {
      this.spawnGem(e.x + NS.rand.range(-6, 6), e.y + NS.rand.range(-6, 6), per);
    }
  },

  spawnGem(x, y, value) {
    /* merge nearby gems if too many */
    if (this.gems.length > 240) {
      /* find any gem near and add value */
      for (let i = 0; i < this.gems.length; i += 7) {
        const g = this.gems[i];
        if (NS.dist2(g.x, g.y, x, y) < 40 * 40) { g.value += value; return; }
      }
      /* else upgrade oldest */
      this.gems[0].value += value;
      return;
    }
    const g = this.pool.make();
    g.x = x; g.y = y;
    g.value = value;
    g.vx = NS.rand.range(-40, 40); g.vy = NS.rand.range(-40, 40);
    g.t = NS.rand.range(0, NS.TAU);
    this.gems.push(g);
  },

  spawnHeart(x, y) {
    const h = this.pool.make();
    h.x = x; h.y = y; h.t = 0;
    this.hearts.push(h);
  },

  /* powerups: magnet (vacuum all gems) / bomb (nuke the screen) /
     time (bullet-time slow-mo) */
  spawnPowerup(x, y, kind) {
    const pw = this.pool.make();
    pw.x = x; pw.y = y; pw.t = 0; pw.kind = kind;
    pw.life = 12; /* despawn if ignored */
    this.powers.push(pw);
  },

  spawnChest(x, y) {
    const c = this.pool.make();
    c.x = x; c.y = y; c.t = 0;
    this.chests.push(c);
  },

  update(dt) {
    const p = NS.Game.player;
    const mag2 = p.magnet * p.magnet;

    /* gems: scatter, then vacuum. Weak "scent" pull at 1.8x magnet keeps
       gems from being permanently left behind (esp. on mobile). */
    const G = this.gems;
    const scent2 = (p.magnet * 1.8) * (p.magnet * 1.8);
    for (let i = G.length - 1; i >= 0; i--) {
      const g = G[i];
      g.t += dt;
      const d2 = NS.dist2(g.x, g.y, p.x, p.y);
      if (d2 < mag2) {
        /* accelerate toward player */
        const a = NS.angleTo(g.x, g.y, p.x, p.y);
        const pull = 380;
        g.vx = NS.lerp(g.vx, Math.cos(a) * pull, dt * 8);
        g.vy = NS.lerp(g.vy, Math.sin(a) * pull, dt * 8);
      } else if (d2 < scent2) {
        const a = NS.angleTo(g.x, g.y, p.x, p.y);
        g.vx = NS.lerp(g.vx, Math.cos(a) * 46, dt * 1.2);
        g.vy = NS.lerp(g.vy, Math.sin(a) * 46, dt * 1.2);
      } else {
        g.vx *= Math.pow(0.85, dt * 60);
        g.vy *= Math.pow(0.85, dt * 60);
      }
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (d2 < 14 * 14) {
        NS.Player.gainXP(p, Math.max(1, Math.round(g.value * NS.Game.state.xpMult)));
        NS.Audio.pickup();
        this.pool.give(g);
        G[i] = G[G.length - 1]; G.pop();
      }
    }

    /* hearts */
    const H = this.hearts;
    for (let i = H.length - 1; i >= 0; i--) {
      const h = H[i];
      h.t += dt;
      const d2 = NS.dist2(h.x, h.y, p.x, p.y);
      if (d2 < mag2) {
        const a = NS.angleTo(h.x, h.y, p.x, p.y);
        h.x += Math.cos(a) * 200 * dt; h.y += Math.sin(a) * 200 * dt;
      }
      if (d2 < 16 * 16) {
        const p2 = NS.Game.player;
        p2.hp = Math.min(p2.maxHp, p2.hp + 30);
        NS.Audio.heal();
        NS.DmgNums.add(p2.x, p2.y - 14, '+30', '#7dff9a', true);
        this.pool.give(h);
        H[i] = H[H.length - 1]; H.pop();
      }
    }

    /* chests — walk over to open */
    const C = this.chests;
    for (let i = C.length - 1; i >= 0; i--) {
      const c = C[i];
      c.t += dt;
      if (NS.dist2(c.x, c.y, p.x, p.y) < 22 * 22) {
        this.openChest(c);
        this.pool.give(c);
        C[i] = C[C.length - 1]; C.pop();
      }
    }

    /* ---------- TREASURE GOBLIN: flee + fire trail, jackpot on catch ---------- */
    if (!this.goblin) {
      this.goblinCd -= dt;
      if (this.goblinCd <= 0 && NS.Game.state.time > 60) {
        this.goblinCd = NS.rand.range(75, 110);
        const a = NS.rand.range(0, NS.TAU);
        const viewR = Math.hypot(NS.VIEW_W, NS.VIEW_H) / 2 + 40;
        this.goblin = {
          x: p.x + Math.cos(a) * viewR, y: p.y + Math.sin(a) * viewR,
          t: 0, life: 10, hitT: 0
        };
        NS.UI.toast('A TREASURE GOBLIN APPEARED — CATCH IT!', true);
        NS.Audio.tone(1300, 0.12, 'square', 0.08, 0, 1700);
      }
    } else {
      const g = this.goblin;
      g.t += dt; g.life -= dt;
      if (g.hitT > 0) g.hitT -= dt;
      /* flee from player, zig-zag */
      const ang = NS.angleTo(p.x, p.y, g.x, g.y);
      const wig = Math.sin(g.t * 7) * 0.7;
      const fa = ang + wig;
      g.x += Math.cos(fa) * 165 * dt;
      g.y += Math.sin(fa) * 165 * dt;
      /* fire trail: gold sparks */
      if (Math.floor(g.t * 14) % 2 === 0) {
        NS.Particles.spawn(g.x, g.y, { color: '#ffd23f', glow: true, life: 0.5, size: 2, drag: 0.9 });
      }
      /* caught? → jackpot fountain */
      if (NS.dist2(g.x, g.y, p.x, p.y) < 20 * 20) {
        NS.Audio.victory();
        NS.Shake.add(5, 0.4);
        NS.Game.spawnRing(g.x, g.y, '#ffd23f', 6, 110, 0.6);
        NS.Particles.burst(g.x, g.y, 30, { color: '#ffd23f', glow: true, life: 0.8 });
        for (let i = 0; i < 12; i++) NS.Pickups.spawnGem(g.x + NS.rand.range(-24, 24), g.y + NS.rand.range(-24, 24), 5);
        NS.Pickups.spawnChest(g.x + 12, g.y);
        NS.Pickups.spawnPowerup(g.x - 12, g.y, NS.rand.pick(['magnet', 'bomb', 'time']));
        NS.UI.toast('GOBLIN JACKPOT!', true);
        this.goblin = null;
      } else if (g.life <= 0) {
        NS.UI.toast('The goblin escaped...');
        this.goblin = null;
      }
    }

    /* powerups */
    const P = this.powers;
    for (let i = P.length - 1; i >= 0; i--) {
      const pw = P[i];
      pw.t += dt; pw.life -= dt;
      const d2 = NS.dist2(pw.x, pw.y, p.x, p.y);
      if (d2 < mag2) {
        const a = NS.angleTo(pw.x, pw.y, p.x, p.y);
        pw.x += Math.cos(a) * 170 * dt; pw.y += Math.sin(a) * 170 * dt;
      }
      if (d2 < 16 * 16) {
        this.activate(pw);
        this.pool.give(pw);
        P[i] = P[P.length - 1]; P.pop();
      } else if (pw.life <= 0) {
        this.pool.give(pw);
        P[i] = P[P.length - 1]; P.pop();
      }
    }
  },

  activate(pw) {
    const p = NS.Game.player;
    if (pw.kind === 'magnet') {
      /* vacuum every gem on the field */
      for (const g of this.gems) {
        const a = NS.angleTo(g.x, g.y, p.x, p.y);
        g.vx = Math.cos(a) * 560;
        g.vy = Math.sin(a) * 560;
        g.vacuum = true;
      }
      NS.Audio.powerup();
      NS.Game.spawnRing(p.x, p.y, '#c77dff', 3, 130, 0.55);
      NS.UI.toast('MAGNET! All XP incoming!');
    } else if (pw.kind === 'bomb') {
      /* damage + knock back everything on screen */
      NS.Audio.bombSfx();
      NS.Shake.add(7, 0.55);
      NS.Game.spawnRing(p.x, p.y, '#ff9d3f', 5, 260, 0.7);
      NS.Particles.burst(p.x, p.y, 34, { color: '#ffd23f', glow: true, life: 0.8, drag: 0.9 });
      const R = 300;
      NS.Grid.query(p.x, p.y, R, NS.Game._q);
      for (let i = 0; i < NS.Game._q.length; i++) {
        const e = NS.Game._q[i];
        if (e.dead) continue;
        const d2e = NS.dist2(p.x, p.y, e.x, e.y);
        if (d2e < R * R) {
          const dmg = e.isBoss ? 120 : 9999;
          NS.Game.damageEnemy(e, dmg, 'bomb');
          if (!e.dead && !e.isBoss) {
            const a = NS.angleTo(p.x, p.y, e.x, e.y);
            e.x += Math.cos(a) * 90; e.y += Math.sin(a) * 90;
          }
        }
      }
      NS.UI.toast('BOOM! Screen cleared!');
    } else if (pw.kind === 'time') {
      /* BULLET TIME: the swarm crawls for 5s — the power fantasy moment */
      NS.Game.state.timeSlow = 5;
      NS.Audio.victory();
      NS.Game.spawnRing(p.x, p.y, '#c8f4ff', 4, 200, 0.8);
      NS.UI.toast('⏱ BULLET TIME!', true);
    }
  },

  heal() { /* referenced by hearts */ },

  openChest(c) {
    NS.Audio.chest();
    NS.Shake.add(2, 0.25);
    NS.Particles.burst(c.x, c.y, 18, { color: '#ffd23f', glow: true, life: 0.7 });
    /* chest = bonus draft; a pending EVOLUTION wins the roll if one is ready */
    const st = NS.Game.state;
    const evoReady = Object.keys(NS.Weapons.EVOS).some(id => {
      const w = st.weapons[id];
      return w && !w.evo && w.lvl >= NS.Weapons.DEFS[id].maxLvl &&
             (st.passives[NS.Weapons.EVO_PAIR[id]] || 0) > 0;
    });
    if (evoReady) {
      st.evoChest = true;
      NS.UI.toast('CHEST! Something resonates...', true);
    } else {
      NS.UI.toast('CHEST! Bonus upgrade!', false);
    }
    NS.Game.pendingLevelUps++;
  },

  draw(ctx, cam, time) {
    /* gems — GREEN family only (enemy bullets are warm/orange; green is
       reserved for XP so nothing gets confused mid-swarm) */
    for (const g of this.gems) {
      const x = g.x - cam.x, y = g.y - cam.y;
      if (x < -20 || y < -20 || x > NS.VIEW_W + 20 || y > NS.VIEW_H + 20) continue;
      const bob = Math.sin(time * 4 + g.t) * 1.5;
      const big = g.value >= 10;
      const col = big ? '#baff6e' : (g.value >= 5 ? '#7dff9a' : '#4ef2c0');
      NS.Glow.draw(ctx, col, x, y + bob, big ? 10 : 6, 0.8);
      /* diamond shape — instantly distinct from round bullets */
      ctx.fillStyle = '#eafff2';
      ctx.save();
      ctx.translate(x, y + bob);
      ctx.rotate(Math.PI / 4);
      const gs2 = big ? 2.4 : 1.7;
      ctx.fillRect(-gs2, -gs2, gs2 * 2, gs2 * 2);
      ctx.restore();
    }
    /* hearts */
    for (const h of this.hearts) {
      const x = h.x - cam.x, y = h.y - cam.y + Math.sin(time * 3 + h.t) * 2;
      NS.Glow.draw(ctx, '#ff5e6c', x, y, 12, 0.9);
      ctx.fillStyle = '#ffdde3';
      ctx.fillRect(x - 3, y - 2, 2, 2); ctx.fillRect(x + 1, y - 2, 2, 2);
      ctx.fillRect(x - 3, y, 6, 2); ctx.fillRect(x - 2, y + 2, 4, 2); ctx.fillRect(x - 1, y + 4, 2, 1);
    }
    /* chests */
    for (const c of this.chests) {
      const x = c.x - cam.x, y = c.y - cam.y + Math.sin(time * 3 + c.t) * 2;
      NS.Glow.draw(ctx, '#ffd23f', x, y, 16, 0.9);
      ctx.fillStyle = '#8a5a2a';
      ctx.fillRect(x - 6, y - 4, 12, 8);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x - 6, y - 4, 12, 3);
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(x - 1, y - 2, 2, 3);
    }
    /* treasure goblin: gold running chest w/ legs */
    if (this.goblin) {
      const g = this.goblin;
      const x = g.x - cam.x, y = g.y - cam.y;
      if (x > -30 && y > -30 && x < NS.VIEW_W + 30 && y < NS.VIEW_H + 30) {
        NS.Glow.draw(ctx, '#ffd23f', x, y, 20, 0.95);
        /* arrow marker when off-screen */
        if (x < 0 || y < 0 || x > NS.VIEW_W || y > NS.VIEW_H) {
          const cx = NS.VIEW_W / 2, cy = NS.VIEW_H / 2;
          const aa = Math.atan2(y - cy, x - cx);
          const ax = cx + Math.cos(aa) * (Math.min(NS.VIEW_W, NS.VIEW_H) / 2 - 10);
          const ay = cy + Math.sin(aa) * (Math.min(NS.VIEW_W, NS.VIEW_H) / 2 - 10);
          ctx.fillStyle = '#ffd23f';
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(aa);
          ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
          ctx.restore();
        } else {
          /* chest body + flashing outline when hit */
          ctx.strokeStyle = g.hitT > 0 ? '#ffffff' : 'rgba(255,210,63,0.9)';
          ctx.lineWidth = g.hitT > 0 ? 2 : 1;
          ctx.strokeRect(x - 7, y - 5, 14, 10);
          ctx.lineWidth = 1;
          ctx.fillStyle = '#8a5a2a';
          ctx.fillRect(x - 6, y - 4, 12, 8);
          ctx.fillStyle = '#ffd23f';
          ctx.fillRect(x - 6, y - 4, 12, 3);
          ctx.fillStyle = '#fff6d8';
          ctx.fillRect(x - 1, y - 2, 2, 3);
          /* running legs */
          const lp = Math.sin(g.t * 20) * 2.5;
          ctx.strokeStyle = '#8a5a2a';
          ctx.beginPath();
          ctx.moveTo(x - 4, y + 5); ctx.lineTo(x - 4 + lp, y + 9);
          ctx.moveTo(x + 4, y + 5); ctx.lineTo(x + 4 - lp, y + 9);
          ctx.stroke();
        }
      }
    }
    /* powerups: pulsing capsules */
    for (const pw of this.powers) {
      const x = pw.x - cam.x, y = pw.y - cam.y + Math.sin(time * 4 + pw.t) * 2;
      const blink = pw.life < 3 && Math.floor(pw.life * 6) % 2 === 0;
      if (blink) continue;
      const col = pw.kind === 'magnet' ? '#c77dff' : (pw.kind === 'time' ? '#c8f4ff' : '#ff9d3f');
      NS.Glow.draw(ctx, col, x, y, 14 + Math.sin(time * 6 + pw.t) * 2, 0.95);
      ctx.fillStyle = '#0a0a16';
      ctx.beginPath(); ctx.arc(x, y, 5.5, 0, NS.TAU); ctx.fill();
      ctx.fillStyle = col;
      if (pw.kind === 'magnet') {
        ctx.fillRect(x - 3, y - 1, 2, 3); ctx.fillRect(x + 1, y - 1, 2, 3);
        ctx.fillRect(x - 3, y - 3, 6, 1.5);
      } else if (pw.kind === 'time') {
        /* hourglass glyph */
        ctx.fillRect(x - 3, y - 4, 6, 1.2); ctx.fillRect(x - 3, y + 2.8, 6, 1.2);
        ctx.fillRect(x - 2, y - 2.8, 4, 1.2); ctx.fillRect(x - 1, y - 1.6, 2, 3.2); ctx.fillRect(x - 2, y + 1.6, 4, 1.2);
      } else {
        ctx.fillRect(x - 1, y - 4, 2, 5); ctx.fillRect(x - 1, y + 1, 2, 2);
      }
    }
  }
};
