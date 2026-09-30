'use strict';
/* ============================================================
   NEONSWARM — weapons.js
   30 auto-firing weapons (LV 1–8) + 40 passives + legendaries.
   Slots: 6 active / 6 passive. No evolutions — every weapon is
   complete at LV8 and the draft stays wide all run.
   ============================================================ */

NS.Weapons = {
  /* ================= DEFINITIONS ================= */
  DEFS: {
    pulse: {
      name: 'PULSE CANNON', color: '#5ef2ff', desc: 'Fires at the nearest enemy. Reliable.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.pulse;
        st.cd -= s.dt;
        const n = lvl; /* 1..8 shots per volley */
        if (st.cd <= 0) {
          st.cd = Math.max(0.3, 0.85 - lvl * 0.06);
          const target = NS.Game.nearestEnemy(s.player.x, s.player.y, 280);
          if (target) {
            const base = NS.angleTo(s.player.x, s.player.y, target.x, target.y);
            for (let i = 0; i < n; i++) {
              const a = base + (i - (n - 1) / 2) * 0.13;
              NS.Game.spawnBullet(s.player.x, s.player.y, a, 320, 8 + lvl * 2, 'pulse', '#5ef2ff', 2.5, 2, { src: s.wid });
            }
            NS.Audio.shoot();
          }
        }
      }
    },
    blades: {
      name: 'ORBIT BLADES', color: '#ffd23f', desc: 'Blades orbit you, shredding on contact.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.blades;
        st.ang = (st.ang || 0) + s.dt * (2.6 + lvl * 0.1);
        const count = Math.min(6, 1 + lvl);
        const radius = Math.min(78, 42 + lvl * 4);
        st.pos = st.pos || [];
        for (let i = 0; i < count; i++) {
          const a = st.ang + i * NS.TAU / count;
          const bx = s.player.x + Math.cos(a) * radius;
          const by = s.player.y + Math.sin(a) * radius;
          st.pos[i] = st.pos[i] || { x: 0, y: 0, hitCd: {} };
          const b = st.pos[i];
          b.x = bx; b.y = by;
          const near = NS.Grid.query(bx, by, 16, NS.Game._q);
          for (let k = 0; k < near.length; k++) {
            const e = near[k];
            if (e.dead) continue;
            const rr = (e.r + 8) * (e.r + 8);
            if (NS.dist2(bx, by, e.x, e.y) < rr) {
              const key = e.id;
              const last = b.hitCd[key] || 0;
              if (s.time - last > 0.35) {
                b.hitCd[key] = s.time;
                NS.Game.damageEnemy(e, 6 + lvl * 3, 'blades');
              }
            }
          }
        }
      },
      drawExtra(s) {
        const st = s.weapons.blades;
        if (!st.pos) return;
        for (const b of st.pos) {
          if (!b) continue;
          const x = b.x - s.cam.x, y = b.y - s.cam.y;
          NS.Glow.draw(s.ctx, '#ffd23f', x, y, 12, 0.8);
          s.ctx.fillStyle = '#fff6d8';
          s.ctx.save();
          s.ctx.translate(x, y);
          s.ctx.rotate(s.time * 8);
          s.ctx.fillRect(-4, -1.5, 8, 3);
          s.ctx.fillRect(-1.5, -4, 3, 8);
          s.ctx.restore();
        }
      }
    },
    nova: {
      name: 'NOVA RING', color: '#c77dff', desc: 'Periodic shockwave around you.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.nova;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(0.9, 3.2 - lvl * 0.3);
          const R = Math.min(200, 60 + lvl * 18);
          st.anim = 0.35; st.r = R;
          const near = NS.Grid.query(s.player.x, s.player.y, R, NS.Game._q);
          for (const e of near) {
            if (!e.dead && NS.dist2(s.player.x, s.player.y, e.x, e.y) < R * R) {
              NS.Game.damageEnemy(e, 10 + lvl * 5, 'nova');
              const a = NS.angleTo(s.player.x, s.player.y, e.x, e.y);
              e.x += Math.cos(a) * 14; e.y += Math.sin(a) * 14;
            }
          }
          NS.Particles.burst(s.player.x, s.player.y, 10, { color: '#c77dff', glow: true, life: 0.4, drag: 0.85 });
        }
        if (st.anim > 0) st.anim -= s.dt;
      },
      drawExtra(s) {
        const st = s.weapons.nova;
        if (st.anim > 0) {
          const prog = 1 - st.anim / 0.35;
          s.ctx.strokeStyle = 'rgba(199,125,255,' + (1 - prog) + ')';
          s.ctx.lineWidth = 3;
          s.ctx.beginPath();
          s.ctx.arc(s.player.x - s.cam.x, s.player.y - s.cam.y, st.r * prog, 0, NS.TAU);
          s.ctx.stroke();
          s.ctx.lineWidth = 1;
        }
      }
    },
    lightning: {
      name: 'CHAIN LIGHTNING', color: '#9dff57', desc: 'Zaps and chains between enemies.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.lightning;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(0.35, 1.6 - lvl * 0.15);
          const first = NS.Game.nearestEnemy(s.player.x, s.player.y, 240);
          if (first) {
            const chains = 1 + lvl;
            let cur = first;
            const hitList = [cur];
            let dmg = 12 + lvl * 6;
            NS.Game.damageEnemy(cur, dmg, 'lightning');
            for (let c = 1; c < chains; c++) {
              const next = NS.Game.nearestEnemyTo(cur.x, cur.y, 130, hitList);
              if (!next) break;
              NS.Game.damageEnemy(next, dmg, 'lightning');
              hitList.push(next);
              cur = next;
              dmg *= 0.8;
            }
            st.bolt = { pts: [], t: 0.12 };
            st.bolt.pts.push({ x: s.player.x, y: s.player.y });
            for (const e of hitList) st.bolt.pts.push({ x: e.x, y: e.y });
            NS.Audio.tone(1200, 0.06, 'sawtooth', 0.05, 0, 200);
          }
        }
        if (st.bolt) {
          st.bolt.t -= s.dt;
          if (st.bolt.t <= 0) st.bolt = null;
        }
      },
      drawExtra(s) {
        const st = s.weapons.lightning;
        if (st.bolt) {
          const a = st.bolt.t / 0.12;
          s.ctx.strokeStyle = 'rgba(157,255,87,' + a + ')';
          s.ctx.lineWidth = 2;
          s.ctx.beginPath();
          for (let i = 0; i < st.bolt.pts.length; i++) {
            const p = st.bolt.pts[i];
            const x = p.x - s.cam.x + NS.rand.range(-3, 3);
            const y = p.y - s.cam.y + NS.rand.range(-3, 3);
            if (i === 0) s.ctx.moveTo(x, y); else s.ctx.lineTo(x, y);
          }
          s.ctx.stroke();
          s.ctx.lineWidth = 1;
        }
      }
    },
    mines: {
      name: 'PLASMA MINES', color: '#ff5e6c', desc: 'Drops mines that explode. Boom.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.mines;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(0.55, 1.8 - lvl * 0.15);
          NS.Game.spawnMine(s.player.x + NS.rand.range(-20, 20), s.player.y + NS.rand.range(-20, 20),
            Math.min(78, 22 + lvl * 8), 40 + lvl * 14);
        }
      }
    },
    drone: {
      name: 'ATTACK DRONE', color: '#ff9d3f', desc: 'Autonomous drones shoot beside you.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.drone;
        st.cd = st.cd || 0;
        st.cd -= s.dt;
        const count = Math.min(4, 1 + (lvl - 1 >> 1)); /* 1,1,2,2,3,3,4,4 */
        st.orbit = (st.orbit || 0) + s.dt * 1.5;
        st.drones = count;
        st.px = st.px || [];
        for (let i = 0; i < count; i++) {
          const a = st.orbit + i * NS.TAU / count;
          st.px[i] = {
            x: s.player.x + Math.cos(a) * 26,
            y: s.player.y + Math.sin(a) * 26
          };
        }
        if (st.cd <= 0) {
          st.cd = Math.max(0.28, 0.75 - lvl * 0.06);
          for (let i = 0; i < count; i++) {
            const d = st.px[i];
            const t = NS.Game.nearestEnemy(d.x, d.y, 220);
            if (t) {
              NS.Game.spawnBullet(d.x, d.y, NS.angleTo(d.x, d.y, t.x, t.y), 300, 5 + lvl * 2, 'drone', '#ff9d3f', 2, 1.6);
            }
          }
        }
      },
      drawExtra(s) {
        const st = s.weapons.drone;
        if (!st.px) return;
        for (const d of st.px) {
          if (!d) continue;
          const x = d.x - s.cam.x, y = d.y - s.cam.y;
          NS.Glow.draw(s.ctx, '#ff9d3f', x, y, 10, 0.7);
          s.ctx.fillStyle = '#fff1dd';
          s.ctx.fillRect(x - 2, y - 2, 4, 4);
        }
      }
    },
    frost: {
      name: 'CRYO FIELD', color: '#7dd7ff', desc: 'Slows all enemies near you.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.frost;
        st.tick = (st.tick || 0) - s.dt;
        const R = Math.min(170, 70 + lvl * 14);
        st.r = R;
        st.slow = Math.min(0.68, 0.25 + lvl * 0.06);
        if (st.tick <= 0) {
          st.tick = 0.25;
          const near = NS.Grid.query(s.player.x, s.player.y, R, NS.Game._q);
          for (const e of near) {
            if (!e.dead && NS.dist2(s.player.x, s.player.y, e.x, e.y) < R * R) {
              e.slowT = Math.max(e.slowT || 0, 0.4);
              e.slowAmt = st.slow;
            }
          }
        }
      },
      drawExtra(s) {
        const st = s.weapons.frost;
        if (!st.r) return;
        s.ctx.strokeStyle = 'rgba(125,215,255,0.18)';
        s.ctx.beginPath();
        s.ctx.arc(s.player.x - s.cam.x, s.player.y - s.cam.y, st.r, 0, NS.TAU);
        s.ctx.stroke();
      }
    },
    railgun: {
      name: 'RAILGUN', color: '#ff4fa3', desc: 'Pierces everything in a line. Slow but huge.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.railgun;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(0.9, 2.4 - lvl * 0.2);
          const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 320);
          if (t) {
            const a = NS.angleTo(s.player.x, s.player.y, t.x, t.y);
            const dmg = 25 + lvl * 14;
            NS.Game.railBeam(a, dmg);
            st.beam = { a, t: 0.15, len: 400 };
          }
        }
        if (st.beam) {
          st.beam.t -= s.dt;
          if (st.beam.t <= 0) st.beam = null;
        }
      },
      drawExtra(s) {
        const st = s.weapons.railgun;
        if (st.beam) {
          const a = st.beam.t / 0.15;
          s.ctx.save();
          s.ctx.translate(s.player.x - s.cam.x, s.player.y - s.cam.y);
          s.ctx.rotate(st.beam.a);
          s.ctx.fillStyle = 'rgba(255,79,163,' + a + ')';
          s.ctx.fillRect(0, -2, st.beam.len, 4);
          s.ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
          s.ctx.fillRect(0, -1, st.beam.len, 2);
          s.ctx.restore();
        }
      }
    },
    beam: {
      name: 'SOLAR BEAM', color: '#ff9d3f', desc: 'Sweeping beam that follows your movement.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.beam;
        st.on = (st.on || 0) + s.dt;
        st.ang = (st.ang || 0);
        const p = s.player;
        if (p.vx || p.vy) {
          const target = Math.atan2(p.vy, p.vx);
          let diff = target - st.ang;
          while (diff > Math.PI) diff -= NS.TAU;
          while (diff < -Math.PI) diff += NS.TAU;
          st.ang += diff * Math.min(1, s.dt * 3);
        }
        st.tick = (st.tick || 0) - s.dt;
        const len = Math.min(260, 150 + lvl * 20);
        const width = Math.min(34, 14 + lvl * 3);
        st.len = len; st.width = width;
        if (st.tick <= 0) {
          st.tick = 0.22;
          const c = Math.cos(st.ang), s2 = Math.sin(st.ang);
          NS.Grid.query(p.x, p.y, len, NS.Game._q);
          for (let i = 0; i < NS.Game._q.length; i++) {
            const e = NS.Game._q[i];
            if (e.dead) continue;
            const dx = e.x - p.x, dy = e.y - p.y;
            const along = dx * c + dy * s2;
            if (along < 0 || along > len) continue;
            const perp = Math.abs(-dx * s2 + dy * c);
            if (perp < width / 2 + e.r) NS.Game.damageEnemy(e, 3 + lvl * 1.6, 'beam');
          }
        }
      },
      drawExtra(s) {
        const st = s.weapons.beam;
        if (!st.len) return;
        const c = s.ctx;
        c.save();
        c.translate(s.player.x - s.cam.x, s.player.y - s.cam.y);
        c.rotate(st.ang);
        const grad = c.createLinearGradient(0, 0, st.len, 0);
        grad.addColorStop(0, 'rgba(255,157,63,0.55)');
        grad.addColorStop(1, 'rgba(255,157,63,0)');
        c.fillStyle = grad;
        c.fillRect(0, -st.width / 2, st.len, st.width);
        c.fillStyle = 'rgba(255,240,200,0.75)';
        c.fillRect(0, -st.width / 6, st.len, st.width / 3);
        c.restore();
      }
    },
    spike: {
      name: 'THORN BURST', color: '#ff4fa3', desc: 'Fires spikes in all directions.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.spike;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(0.8, 2.1 - lvl * 0.14);
          const n = 6 + lvl * 2;
          const off = NS.rand.range(0, NS.TAU);
          for (let i = 0; i < n; i++) {
            NS.Game.spawnBullet(s.player.x, s.player.y, off + i * NS.TAU / n, 190, 9 + lvl * 4, 'spike', '#ff4fa3', 2.5, 2, { src: s.wid });
          }
          NS.Audio.shoot();
        }
      }
    },
    tornado: {
      name: 'VORTEX', color: '#9dff57', desc: 'Pulls enemies in and grinds them.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.tornado;
        st.ang = (st.ang || 0) + s.dt * 5;
        st.r = Math.min(140, 55 + lvl * 12);
        st.tick = (st.tick || 0) - s.dt;
        const p = s.player;
        const near = NS.Grid.query(p.x, p.y, st.r, NS.Game._q);
        const pull = 60 + lvl * 14;
        for (let i = 0; i < near.length; i++) {
          const e = near[i];
          if (e.dead) continue;
          const d2 = NS.dist2(p.x, p.y, e.x, e.y);
          if (d2 > st.r * st.r) continue;
          if (e.isBoss) continue;
          const a = NS.angleTo(e.x, e.y, p.x, p.y);
          const swirl = a + Math.PI / 2;
          e.x += (Math.cos(a) * pull * 0.55 + Math.cos(swirl) * pull) * s.dt;
          e.y += (Math.sin(a) * pull * 0.55 + Math.sin(swirl) * pull) * s.dt;
        }
        if (st.tick <= 0) {
          st.tick = 0.5;
          for (let i = 0; i < near.length; i++) {
            const e = near[i];
            if (!e.dead && NS.dist2(p.x, p.y, e.x, e.y) < 30 * 30) {
              NS.Game.damageEnemy(e, 4 + lvl * 2, 'vortex');
            }
          }
        }
      },
      drawExtra(s) {
        const st = s.weapons.tornado;
        if (!st.r) return;
        const c = s.ctx;
        const x = s.player.x - s.cam.x, y = s.player.y - s.cam.y;
        c.strokeStyle = 'rgba(157,255,87,0.22)';
        for (let k = 1; k <= 3; k++) {
          c.beginPath();
          c.arc(x, y, st.r * k / 3, st.ang * (k % 2 ? 1 : -1), st.ang * (k % 2 ? 1 : -1) + 4.2);
          c.stroke();
        }
      }
    },
    ghost: {
      name: 'PHANTOM STRIKE', color: '#c77dff', desc: 'Spectral blades seek far enemies.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.ghost;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(0.6, 1.7 - lvl * 0.12);
          const shots = Math.min(5, 1 + Math.ceil(lvl / 2));
          for (let i = 0; i < shots; i++) {
            const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 400);
            if (!t) break;
            NS.Game.spawnHoming(s.player.x, s.player.y, t, 240, 14 + lvl * 6, 'ghost', '#c77dff', 3, 2.2, 0, s.wid);
          }
          if (shots) NS.Audio.tone(1500, 0.07, 'sine', 0.05, 0, 400);
        }
      }
    },
    seeker: {
      name: 'SEEKER BARRAGE', color: '#bfe8ff', desc: 'Volley of light homing darts.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.seeker;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(0.8, 1.9 - lvl * 0.11);
          const n = 2 + Math.floor(lvl / 2);
          for (let i = 0; i < n; i++) {
            const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 380);
            if (!t) break;
            NS.Game.spawnHoming(s.player.x, s.player.y, t, 260, 6 + lvl * 2, 'seeker', '#bfe8ff', 2.5, 2.4, 0, s.wid);
          }
        }
      }
    },
    gpulse: {
      name: 'GRAVITY PULSE', color: '#8a93c9', desc: 'Blast that hurls enemies away from you.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.gpulse;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(1.2, 2.8 - lvl * 0.16);
          const R = 90 + lvl * 10;
          st.anim = 0.3; st.r = R;
          const near = NS.Grid.query(s.player.x, s.player.y, R, NS.Game._q);
          for (const e of near) {
            if (e.dead || NS.dist2(s.player.x, s.player.y, e.x, e.y) > R * R) continue;
            NS.Game.damageEnemy(e, 8 + lvl * 3, 'gpulse');
            if (!e.isBoss) {
              const a = NS.angleTo(s.player.x, s.player.y, e.x, e.y);
              e.x += Math.cos(a) * (26 + lvl * 2);
              e.y += Math.sin(a) * (26 + lvl * 2);
            }
          }
        }
        if (st.anim > 0) st.anim -= s.dt;
      },
      drawExtra(s) {
        const st = s.weapons.gpulse;
        if (st.anim > 0) {
          const prog = 1 - st.anim / 0.3;
          s.ctx.strokeStyle = 'rgba(138,147,201,' + (1 - prog) + ')';
          s.ctx.lineWidth = 2.5;
          s.ctx.beginPath();
          s.ctx.arc(s.player.x - s.cam.x, s.player.y - s.cam.y, st.r * prog, 0, NS.TAU);
          s.ctx.stroke();
          s.ctx.lineWidth = 1;
        }
      }
    },
    omines: {
      name: 'ORBIT MINES', color: '#ff4757', desc: 'Seeds a ring of mines around you.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.omines;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(1.4, 3.2 - lvl * 0.18);
          const n = 3 + Math.floor(lvl / 2);
          const R = 70;
          for (let i = 0; i < n; i++) {
            const a = i / n * NS.TAU + NS.rand.range(0, NS.TAU);
            NS.Game.spawnMine(s.player.x + Math.cos(a) * R, s.player.y + Math.sin(a) * R, 20 + lvl * 6, 30 + lvl * 12);
          }
        }
      }
    },
    turret: {
      name: 'ARC TURRET', color: '#9dff57', desc: 'Deploys turrets that guard the area for 8s.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.turret;
        st.cd -= s.dt;
        st.list = st.list || [];
        if (st.cd <= 0) {
          st.cd = Math.max(3.5, 8 - lvl * 0.5);
          st.list.push({ x: s.player.x, y: s.player.y, life: 8, cd: 0 });
        }
        for (let i = st.list.length - 1; i >= 0; i--) {
          const t = st.list[i];
          t.life -= s.dt;
          t.cd -= s.dt;
          if (t.cd <= 0) {
            t.cd = 0.5;
            const target = NS.Game.nearestEnemy(t.x, t.y, 240);
            if (target) {
              NS.Game.spawnBullet(t.x, t.y, NS.angleTo(t.x, t.y, target.x, target.y), 310, 7 + lvl * 2.5, 'turret', '#9dff57', 2.5, 1.5);
            }
          }
          if (t.life <= 0) st.list.splice(i, 1);
        }
      },
      drawExtra(s) {
        const st = s.weapons.turret;
        if (!st.list) return;
        for (const t of st.list) {
          const x = t.x - s.cam.x, y = t.y - s.cam.y;
          NS.Glow.draw(s.ctx, '#9dff57', x, y, 11, 0.7);
          s.ctx.fillStyle = t.life < 2 && Math.floor(t.life * 6) % 2 === 0 ? 'rgba(157,255,87,0.4)' : '#dfffc8';
          s.ctx.fillRect(x - 3, y - 3, 6, 6);
          s.ctx.strokeStyle = 'rgba(157,255,87,0.6)';
          s.ctx.beginPath(); s.ctx.arc(x, y, 5.5, 0, NS.TAU); s.ctx.stroke();
        }
      }
    },
    boomerang: {
      name: 'BOOMERANG', color: '#baffd9', desc: 'Flies out, shreds both ways, returns to you.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.boomerang;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(0.9, 2.0 - lvl * 0.12);
          const n = 1 + Math.floor(lvl / 3); /* 1,1,2,2,2,3,3,3 */
          for (let i = 0; i < n; i++) {
            const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 320);
            const a = t ? NS.angleTo(s.player.x, s.player.y, t.x, t.y) + (i - (n - 1) / 2) * 0.5 : NS.rand.range(0, NS.TAU);
            NS.Game.spawnBullet(s.player.x, s.player.y, a, 260, 10 + lvl * 4, 'boomerang', '#baffd9', 3.5, 3.2,
              { pierce: 99, perHitCd: 0.3, boom: true, turnT: 0.55, src: s.wid });
          }
          NS.Audio.tone(900, 0.08, 'triangle', 0.05, 0, 500);
        }
      }
    },
    saw: {
      name: 'SAW BLADE', color: '#d9d9e8', desc: 'Blade ricochets between enemies.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.saw;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(1.0, 2.2 - lvl * 0.13);
          const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 300);
          if (t) {
            const a = NS.angleTo(s.player.x, s.player.y, t.x, t.y);
            NS.Game.spawnBullet(s.player.x, s.player.y, a, 240, 8 + lvl * 3, 'saw', '#d9d9e8', 4, 2.4,
              { pierce: 2 + lvl, reaim: true, src: s.wid });
            NS.Audio.tone(1400, 0.06, 'square', 0.04, 0, 700);
          }
        }
      }
    },
    aegis: {
      name: 'AEGIS WAVE', color: '#ffb14f', desc: 'A wave rolls outward, damaging all it passes.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.aegis;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(1.6, 3.4 - lvl * 0.2);
          st.waves = st.waves || [];
          st.waves.push({ r: 12, maxR: 90 + lvl * 16, dmg: 14 + lvl * 6, hit: {} });
          NS.Audio.tone(320, 0.2, 'sine', 0.09, 0, 640);
        }
        /* advance waves */
        st.waves = st.waves || [];
        for (let i = st.waves.length - 1; i >= 0; i--) {
          const w = st.waves[i];
          w.r += 150 * s.dt;
          const near = NS.Grid.query(s.player.x, s.player.y, w.r + 16, NS.Game._q);
          for (let k = 0; k < near.length; k++) {
            const e = near[k];
            if (e.dead || w.hit[e.id]) continue;
            const d = NS.dist(s.player.x, s.player.y, e.x, e.y);
            if (Math.abs(d - w.r) < 14 + e.r) {
              w.hit[e.id] = 1;
              NS.Game.damageEnemy(e, w.dmg, 'aegis');
            }
          }
          if (w.r >= w.maxR) st.waves.splice(i, 1);
        }
      },
      drawExtra(s) {
        const st = s.weapons.aegis;
        if (!st.waves) return;
        for (const w of st.waves) {
          s.ctx.strokeStyle = 'rgba(255,177,79,0.5)';
          s.ctx.lineWidth = 3;
          s.ctx.beginPath();
          s.ctx.arc(s.player.x - s.cam.x, s.player.y - s.cam.y, w.r, 0, NS.TAU);
          s.ctx.stroke();
          s.ctx.lineWidth = 1;
        }
      }
    },
    flux: {
      name: 'FLUX ORB', color: '#c77dff', desc: 'Slow orb that drifts through everything.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.flux;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(1.4, 3.0 - lvl * 0.16);
          const n = 1 + (lvl >= 4 ? 1 : 0) + (lvl >= 7 ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 300);
            const a = t ? NS.angleTo(s.player.x, s.player.y, t.x, t.y) + i * 0.9 : NS.rand.range(0, NS.TAU);
            NS.Game.spawnBullet(s.player.x, s.player.y, a, 70, 6 + lvl * 2.5, 'flux', '#c77dff', 7, 4,
              { pierce: 999, perHitCd: 0.35, src: s.wid });
          }
        }
      },
      drawExtra() {} /* orbs render via bullets loop */
    },
    prism: {
      name: 'PRISM ARRAY', color: '#5ef2ff', desc: 'Lasers rotate around you, cutting all they touch.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.prism;
        st.ang = (st.ang || 0) + s.dt * (0.9 + lvl * 0.12);
        st.beams = 2 + Math.floor(lvl / 3); /* 2,2,3,3,3,4,4,4 */
        st.len = Math.min(170, 80 + lvl * 12);
        st.width = 2.5 + lvl * 0.4;
        st.tick = (st.tick || 0) - s.dt;
        const p = s.player;
        if (st.tick <= 0) {
          st.tick = 0.15;
          const dmg = 2.2 + lvl * 1.1;
          NS.Grid.query(p.x, p.y, st.len + 8, NS.Game._q);
          for (let i = 0; i < NS.Game._q.length; i++) {
            const e = NS.Game._q[i];
            if (e.dead) continue;
            const dx = e.x - p.x, dy = e.y - p.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > st.len * st.len) continue;
            for (let b = 0; b < st.beams; b++) {
              const a = st.ang + b * NS.TAU / st.beams;
              const ca = Math.cos(a), sa = Math.sin(a);
              const along = dx * ca + dy * sa;
              if (along < 0) continue;
              const perp = Math.abs(-dx * sa + dy * ca);
              if (perp < st.width / 2 + e.r) {
                NS.Game.damageEnemy(e, dmg, 'prism');
                break;
              }
            }
          }
        }
      },
      drawExtra(s) {
        const st = s.weapons.prism;
        if (!st.beams) return;
        const c = s.ctx;
        const px = s.player.x - s.cam.x, py = s.player.y - s.cam.y;
        for (let b = 0; b < st.beams; b++) {
          const a = st.ang + b * NS.TAU / st.beams;
          c.save();
          c.translate(px, py);
          c.rotate(a);
          const grad = c.createLinearGradient(0, 0, st.len, 0);
          grad.addColorStop(0, 'rgba(94,242,255,0.7)');
          grad.addColorStop(1, 'rgba(94,242,255,0.05)');
          c.fillStyle = grad;
          c.fillRect(0, -st.width / 2, st.len, st.width);
          c.fillStyle = 'rgba(255,255,255,0.5)';
          c.fillRect(0, -0.5, st.len, 1);
          NS.Glow.draw(c, '#5ef2ff', st.len, 0, 4, 0.7);
          c.restore();
        }
      }
    },
    missiles: {
      name: 'SWARM ROCKETS', color: '#ffb14f', desc: 'Homing rockets that explode on impact.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.missiles;
        st.cd -= s.dt;
        if (st.cd <= 0) {
          st.cd = Math.max(1.1, 2.3 - lvl * 0.12);
          const count = 1 + Math.floor(lvl / 3); /* 1,1,2,2,2,3,3,3 */
          for (let i = 0; i < count; i++) {
            const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 420);
            if (!t) break;
            NS.Game.spawnHoming(s.player.x, s.player.y, t, 200, 18 + lvl * 7, 'missile', '#ffb14f', 3.5, 3.5, 22 + lvl * 3, s.wid);
          }
          if (count) NS.Audio.tone(500, 0.12, 'sawtooth', 0.06, 0, 900);
        }
      }
    },
    /* ---------- NEW wave 10: side slashes (Castlevania whip) ---------- */
    whip: {
      name: 'NEON SCOURGE', color: '#ff4fa3', desc: 'Cracks a wide energy slash beside you. Alternates sides.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.whip;
        st.cd -= s.dt;
        if (st.slash) {
          st.slash.t -= s.dt;
          if (st.slash.t <= 0) st.slash = null;
        }
        if (st.cd > 0) return;
        st.cd = Math.max(0.5, 1.15 - lvl * 0.08);
        const p = s.player;
        const both = lvl >= 7;
        const sides = both ? [1, -1] : [(st.side = -(st.side || 1))];
        const range = 92 + lvl * 10, halfW = 100 + lvl * 6, halfH = 34 + lvl * 2;
        for (const side of sides) {
          const cx = p.x + side * range * 0.7;
          st.slash = { x: cx, y: p.y, t: 0.18, side, range, halfW, halfH };
          NS.Grid.query(cx, p.y, range, NS.Game._q);
          for (let k = 0; k < NS.Game._q.length; k++) {
            const e = NS.Game._q[k];
            if (e.dead) continue;
            if (Math.abs(e.x - cx) < halfW && Math.abs(e.y - p.y) < halfH) {
              NS.Game.damageEnemy(e, 10 + lvl * 5, 'whip');
            }
          }
        }
        NS.Audio.tone(500, 0.08, 'triangle', 0.06, 0, 240);
      },
      drawExtra(s) {
        const st = s.weapons.whip;
        if (!st.slash) return;
        const sl = st.slash;
        const x = sl.x - s.cam.x, y = sl.y - s.cam.y;
        const a = sl.t / 0.18;
        s.ctx.strokeStyle = 'rgba(255,79,163,' + (a * 0.85).toFixed(2) + ')';
        s.ctx.lineWidth = 3;
        s.ctx.beginPath();
        s.ctx.arc(x, y, sl.range * 0.6, sl.side > 0 ? -0.9 : Math.PI - 0.9, sl.side > 0 ? 0.9 : Math.PI + 0.9);
        s.ctx.stroke();
        s.ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.5).toFixed(2) + ')';
        s.ctx.lineWidth = 1.2;
        s.ctx.beginPath();
        s.ctx.arc(x, y, sl.range * 0.45, sl.side > 0 ? -0.7 : Math.PI - 0.7, sl.side > 0 ? 0.7 : Math.PI + 0.7);
        s.ctx.stroke();
        s.ctx.lineWidth = 1;
      }
    },
    /* ---------- NEW wave 10: personal space enforcer ---------- */
    repel: {
      name: 'REPEL FIELD', color: '#8a93c9', desc: 'Anything that touches your bubble gets shoved away. Hard.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.repel;
        st.cd -= s.dt;
        const R = 66 + lvl * 8;
        st.r = R;
        st.pulse = st.pulse > 0 ? st.pulse - s.dt : 0;
        if (st.cd > 0) return;
        st.cd = Math.max(0.7, 1.8 - lvl * 0.12);
        const p = s.player;
        NS.Grid.query(p.x, p.y, R, NS.Game._q);
        let hitAny = false;
        for (let k = 0; k < NS.Game._q.length; k++) {
          const e = NS.Game._q[k];
          if (e.dead) continue;
          if (NS.dist2(p.x, p.y, e.x, e.y) > R * R) continue;
          hitAny = true;
          NS.Game.damageEnemy(e, 6 + lvl * 3, 'repel');
          if (!e.isBoss) {
            const a = NS.angleTo(p.x, p.y, e.x, e.y);
            const push = 34 + lvl * 4;
            e.x += Math.cos(a) * push; e.y += Math.sin(a) * push;
          }
        }
        if (hitAny) {
          st.pulse = 0.25;
          NS.Audio.tone(240, 0.12, 'sine', 0.07, 0, 120);
        }
      },
      drawExtra(s) {
        const st = s.weapons.repel;
        if (!st.r) return;
        const x = s.player.x - s.cam.x, y = s.player.y - s.cam.y;
        const a = 0.14 + (st.pulse > 0 ? st.pulse * 2.2 : 0);
        s.ctx.strokeStyle = 'rgba(138,147,201,' + Math.min(0.7, a).toFixed(2) + ')';
        s.ctx.lineWidth = st.pulse > 0 ? 2.5 : 1.2;
        s.ctx.beginPath();
        s.ctx.arc(x, y, st.r, 0, NS.TAU);
        s.ctx.stroke();
        s.ctx.lineWidth = 1;
      }
    },
    /* ---------- NEW wave 10: sky barrage on random enemies ---------- */
    rain: {
      name: 'STARFALL', color: '#ffe45e', desc: 'Comets fall from orbit, flash-telegraph, then burst into star flares.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.rain;
        st.strikes = st.strikes || [];
        /* resolve pending strikes: flash -> damage + star flare */
        for (let i = st.strikes.length - 1; i >= 0; i--) {
          const k = st.strikes[i];
          k.t -= s.dt;
          if (k.t <= 0) {
            st.strikes.splice(i, 1);
            NS.Grid.query(k.x, k.y, k.r, NS.Game._q);
            for (let j = 0; j < NS.Game._q.length; j++) {
              const e = NS.Game._q[j];
              if (e.dead) continue;
              if (NS.dist2(k.x, k.y, e.x, e.y) < k.r * k.r) NS.Game.damageEnemy(e, k.dmg, 'starfall');
            }
            /* IMPACT: 4-point star flare + sparks + shock ring */
            NS.Game.starFlare(k.x, k.y, k.r);
            NS.Shake.add(1.5, 0.12);
            NS.Audio.tone(1400, 0.1, 'triangle', 0.07, 0, 300);
            NS.Audio.noise(0.16, 0.07, 900);
          }
        }
        st.cd -= s.dt;
        if (st.cd > 0) return;
        st.cd = Math.max(0.35, 1.0 - lvl * 0.07);
        const L = NS.Enemies.list;
        if (!L.length) return;
        const n = 1 + Math.floor((lvl + 1) / 2); /* 1,2,2,3,3,4,4,5 */
        for (let i = 0; i < n; i++) {
          const t = L[Math.floor(NS.rand.next() * L.length)];
          if (!t || t.dead) continue;
          st.strikes.push({
            x: t.x + NS.rand.range(-6, 6), y: t.y + NS.rand.range(-6, 6),
            t: 0.55, r: 26 + lvl * 2, dmg: 12 + lvl * 5
          });
        }
      },
      drawExtra(s) {
        const st = s.weapons.rain;
        if (!st.strikes) return;
        const c = s.ctx;
        for (const k of st.strikes) {
          const x = k.x - s.cam.x, y = k.y - s.cam.y;
          const total = 0.55, prog = 1 - k.t / total;   /* 0..1 fall progress */
          /* ground target: pulsing crosshair reticle (not a plain circle) */
          const pulse = 0.6 + Math.sin(s.time * 14) * 0.4;
          c.strokeStyle = 'rgba(255,228,94,' + (0.35 + pulse * 0.3).toFixed(2) + ')';
          c.lineWidth = 1.4;
          const rr = k.r * (0.55 + prog * 0.45);
          c.beginPath();
          for (let q = 0; q < 4; q++) {                  /* 4 corner ticks */
            const a = q * Math.PI / 2 + Math.PI / 4;
            c.moveTo(x + Math.cos(a) * rr * 0.55, y + Math.sin(a) * rr * 0.55);
            c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          }
          c.stroke();
          c.beginPath(); c.arc(x, y, rr * 0.35, 0, NS.TAU); c.stroke();
          /* the comet itself: falls from the sky toward the target */
          const drop = 64 * (1 - prog);                  /* distance still to fall */
          const cy2 = y - drop;
          const size = 2.5 + prog * 2.5;
          NS.Glow.draw(c, '#fff6d8', x, cy2, 9 * prog + 3, 0.95);
          c.fillStyle = '#fff6d8';
          c.beginPath(); c.arc(x, cy2, size, 0, NS.TAU); c.fill();
          c.fillStyle = '#ffe45e';
          c.beginPath(); c.arc(x - size * 0.3, cy2 + size * 0.3, size * 0.55, 0, NS.TAU); c.fill();
          /* burning trail behind the comet */
          c.strokeStyle = 'rgba(255,157,63,' + (0.25 + prog * 0.5).toFixed(2) + ')';
          c.lineWidth = 2 + prog * 1.5;
          c.beginPath();
          c.moveTo(x, cy2 - 6);
          c.quadraticCurveTo(x - 2, cy2 - 20, x + 1, cy2 - 34 - prog * 8);
          c.stroke();
          c.lineWidth = 1;
        }
      }
    },
    /* ---------- NEW wave 10: line bombardment ---------- */
    airstrike: {
      name: 'ORBITAL LANCE', color: '#bfe8ff', desc: 'Sky beams charge a painted line, then pillars of light hammer it.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.airstrike;
        st.pillars = st.pillars || [];
        for (let i = st.pillars.length - 1; i >= 0; i--) {
          const q = st.pillars[i];
          q.t -= s.dt;
          if (q.t <= 0) {
            st.pillars.splice(i, 1);
            NS.Grid.query(q.x, q.y, q.r, NS.Game._q);
            for (let j = 0; j < NS.Game._q.length; j++) {
              const e = NS.Game._q[j];
              if (e.dead) continue;
              if (NS.dist2(q.x, q.y, e.x, e.y) < q.r * q.r) NS.Game.damageEnemy(e, q.dmg, 'lance');
            }
            /* IMPACT: beam flash + debris + energy ring */
            NS.Game.lanceImpact(q.x, q.y, q.r);
            NS.Shake.add(2.5, 0.18);
            NS.Audio.tone(160, 0.22, 'sawtooth', 0.11, 0, 60);
            NS.Audio.noise(0.2, 0.09, 500);
          }
        }
        st.cd -= s.dt;
        if (st.cd > 0) return;
        st.cd = Math.max(2.2, 5.2 - lvl * 0.35);
        const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 420);
        if (!t) return;
        const n = 3 + Math.floor(lvl / 2); /* 3..7 pillars */
        const lineA = NS.rand.range(0, NS.TAU);
        const ca = Math.cos(lineA), sa = Math.sin(lineA);
        const mid = (n - 1) / 2;
        for (let i = 0; i < n; i++) {
          const off = (i - mid) * 42;
          st.pillars.push({
            x: t.x + ca * off, y: t.y + sa * off,
            t: 0.7, r: 30, dmg: 30 + lvl * 10, ang: lineA
          });
        }
        NS.Audio.tone(180, 0.3, 'sawtooth', 0.08, 0, 700);
      },
      drawExtra(s) {
        const st = s.weapons.airstrike;
        if (!st.pillars) return;
        const c = s.ctx;
        for (const q of st.pillars) {
          const x = q.x - s.cam.x, y = q.y - s.cam.y;
          const total = 0.7, prog = 1 - q.t / total;   /* 0..1 charge progress */
          /* painted ground line connecting the whole strike row */
          const px2 = x + Math.cos(q.ang) * 30, py2 = y + Math.sin(q.ang) * 30;
          const nx2 = x - Math.cos(q.ang) * 30, ny2 = y - Math.sin(q.ang) * 30;
          c.strokeStyle = 'rgba(191,232,255,' + (0.1 + prog * 0.35).toFixed(2) + ')';
          c.lineWidth = 3 + prog * 5;
          c.beginPath(); c.moveTo(nx2, ny2); c.lineTo(px2, py2); c.stroke();
          c.lineWidth = 1;
          /* charging SKY BEAM: widens + brightens as it descends */
          const bw = 2 + prog * 6;
          const grad = c.createLinearGradient(x, y - 120, x, y);
          grad.addColorStop(0, 'rgba(191,232,255,0)');
          grad.addColorStop(0.7, 'rgba(191,232,255,' + (0.18 + prog * 0.5).toFixed(2) + ')');
          grad.addColorStop(1, 'rgba(255,255,255,' + (0.3 + prog * 0.55).toFixed(2) + ')');
          c.fillStyle = grad;
          c.beginPath();
          c.moveTo(x - bw, y - 120);
          c.lineTo(x + bw, y - 120);
          c.lineTo(x + bw * 2.4 + 2, y);
          c.lineTo(x - bw * 2.4 - 2, y);
          c.closePath();
          c.fill();
          /* charge glow at the impact point */
          NS.Glow.draw(c, '#ffffff', x, y, 6 + prog * 14, 0.5 + prog * 0.4);
          /* corner brackets — 'targeted' read */
          c.strokeStyle = 'rgba(191,232,255,' + (0.5 + Math.sin(s.time * 16) * 0.25).toFixed(2) + ')';
          c.lineWidth = 1.2;
          const br = q.r * (0.9 - prog * 0.25);
          c.beginPath();
          for (let qd = 0; qd < 4; qd++) {
            const a = qd * Math.PI / 2 + Math.PI / 4;
            c.moveTo(x + Math.cos(a) * br * 0.6, y + Math.sin(a) * br * 0.6);
            c.lineTo(x + Math.cos(a) * br, y + Math.sin(a) * br);
          }
          c.stroke();
          c.lineWidth = 1;
        }
      }
    },
    /* ---------- NEW wave 10: forking bolt ---------- */
    split: {
      name: 'SPLIT SHOT', color: '#7dff9a', desc: 'Bolt that forks in two when it lands.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.split;
        st.cd -= s.dt;
        if (st.cd > 0) return;
        st.cd = Math.max(0.55, 1.3 - lvl * 0.09);
        const shots = 1 + Math.floor(lvl / 3); /* 1,1,1,2,2,2,3,3 */
        const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 320);
        const base = t ? NS.angleTo(s.player.x, s.player.y, t.x, t.y) : NS.rand.range(0, NS.TAU);
        for (let i = 0; i < shots; i++) {
          const a = base + (i - (shots - 1) / 2) * 0.3;
          NS.Game.spawnBullet(s.player.x, s.player.y, a, 300, 10 + lvl * 4, 'split', '#7dff9a', 2.6, 1.5,
            { src: s.wid, split: { n: 2 }, splitAt: 0.35 });
        }
        NS.Audio.shoot();
      }
    },
    /* ---------- NEW wave 10: lobbed bomblets ---------- */
    cluster: {
      name: 'CLUSTER BOMB', color: '#ff9d3f', desc: 'Lobbed bomb that bursts into a ring of bomblets.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.cluster;
        st.cd -= s.dt;
        if (st.cd > 0) return;
        st.cd = Math.max(1.3, 2.6 - lvl * 0.15);
        const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 340);
        const a = t ? NS.angleTo(s.player.x, s.player.y, t.x, t.y) : NS.rand.range(0, NS.TAU);
        NS.Game.spawnBullet(s.player.x, s.player.y, a, 150, 12 + lvl * 5, 'cluster', '#ff9d3f', 3.5, 1.1,
          { src: s.wid, shrap: { n: 5 + Math.floor(lvl / 2), dmg: 10 + lvl * 4, spd: 230, life: 0.6, pierce: 1, type: 'shard' } });
        NS.Audio.tone(300, 0.14, 'square', 0.06, 0, 90);
      }
    },
    /* ---------- NEW wave 10: bursting shells ---------- */
    flak: {
      name: 'FLAK CANNON', color: '#d9d9e8', desc: 'Rapid shells that burst into shards on first contact.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.flak;
        st.cd -= s.dt;
        if (st.cd > 0) return;
        st.cd = Math.max(0.4, 0.95 - lvl * 0.06);
        const shells = lvl >= 5 ? 2 : 1;
        const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 300);
        const base = t ? NS.angleTo(s.player.x, s.player.y, t.x, t.y) : NS.rand.range(0, NS.TAU);
        for (let i = 0; i < shells; i++) {
          const a = base + (i - (shells - 1) / 2) * 0.16;
          NS.Game.spawnBullet(s.player.x, s.player.y, a, 360, 9 + lvl * 3, 'flak', '#d9d9e8', 2.4, 0.9,
            { src: s.wid, shards: { n: 4 + Math.floor(lvl / 2), dmg: 6 + lvl * 2, spd: 190, life: 0.4, pierce: 1 } });
        }
        NS.Audio.shoot();
      }
    },
    /* ---------- NEW wave 10: echoes of you ---------- */
    /* ---------- NEW wave 13: pinwheel petals ---------- */
    lotus: {
      name: 'RAZOR LOTUS', color: '#ff9df2', desc: 'Razor petals pinwheel outward, then spin back on a new ring.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.lotus;
        st.cd -= s.dt;
        if (st.cd > 0) return;
        st.cd = Math.max(1.0, 2.4 - lvl * 0.16);
        st.rings = st.rings || [];
        const n = 4 + Math.floor(lvl / 2); /* 4..8 petals */
        for (let i = 0; i < n; i++) {
          const a = i / n * NS.TAU + (st.seed = (st.seed || 0) + 0.35);
          st.rings.push({ x: s.player.x, y: s.player.y, a, r: 10, out: true, t: 0 });
        }
        NS.Audio.tone(1100, 0.1, 'triangle', 0.05, 0, 600);
      },
      /* petals fly out to maxR, flip, and return through a fresh radius */
      advance(s, lvl) {
        const st = s.weapons.lotus;
        st.rings = st.rings || [];
        const maxR = 90 + lvl * 10;
        for (let i = st.rings.length - 1; i >= 0; i--) {
          const p = st.rings[i];
          p.t += s.dt;
          p.r += (p.out ? 190 : -190) * s.dt;
          if (p.out && p.r >= maxR) p.out = false;
          if (!p.out && p.r <= 4) { st.rings.splice(i, 1); continue; }
          const px = p.x + Math.cos(p.a) * p.r, py = p.y + Math.sin(p.a) * p.r;
          const near = NS.Grid.query(px, py, 14, NS.Game._q);
          for (let k = 0; k < near.length; k++) {
            const e = near[k];
            if (e.dead) continue;
            if (NS.dist2(px, py, e.x, e.y) < (e.r + 8) * (e.r + 8)) {
              if (s.time - (p.hitCd && p.hitCd[e.id] || 0) > 0.3) {
                if (!p.hitCd) p.hitCd = {};
                p.hitCd[e.id] = s.time;
                NS.Game.damageEnemy(e, 7 + lvl * 3, 'lotus');
              }
            }
          }
        }
      },
      drawExtra(s) {
        const st = s.weapons.lotus;
        if (!st.rings) return;
        const c = s.ctx;
        for (const p of st.rings) {
          const x = p.x + Math.cos(p.a) * p.r - s.cam.x;
          const y = p.y + Math.sin(p.a) * p.r - s.cam.y;
          NS.Glow.draw(c, '#ff9df2', x, y, 9, 0.75);
          c.save();
          c.translate(x, y);
          c.rotate(p.t * 12 + p.a);
          c.fillStyle = '#ffd6f7';
          c.beginPath();
          c.moveTo(0, -6); c.quadraticCurveTo(3, -2, 0, 6); c.quadraticCurveTo(-3, -2, 0, -6);
          c.fill();
          c.restore();
        }
      }
    },
    coil: {
      name: 'TESLA COIL', color: '#c8ff8a', desc: 'Drops electric pods that arc lightning to everything close.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.coil;
        st.cd -= s.dt;
        if (st.cd > 0) return;
        st.cd = Math.max(2.2, 5.5 - lvl * 0.35);
        st.pods = st.pods || [];
        if (st.pods.length >= 3) st.pods.shift(); /* oldest dies */
        st.pods.push({ x: s.player.x, y: s.player.y, life: 7, t: 0, arcs: [] });
        NS.Audio.tone(300, 0.2, 'square', 0.06, 0, 900);
      },
      /* pods tick arcs every 0.35s */
      advance(s, lvl) {
        const st = s.weapons.coil;
        st.pods = st.pods || [];
        const R = 80 + lvl * 8;
        st.r = R;
        for (let i = st.pods.length - 1; i >= 0; i--) {
          const pod = st.pods[i];
          pod.life -= s.dt; pod.t += s.dt;
          if (pod.life <= 0) { st.pods.splice(i, 1); continue; }
          if (pod.t >= 0.35) {
            pod.t = 0;
            pod.arcs = [];
            NS.Grid.query(pod.x, pod.y, R, NS.Game._q);
            let hits = 0;
            for (let k = 0; k < NS.Game._q.length && hits < 3 + Math.floor(lvl / 2); k++) {
              const e = NS.Game._q[k];
              if (e.dead) continue;
              if (NS.dist2(pod.x, pod.y, e.x, e.y) > R * R) continue;
              pod.arcs.push({ x: e.x, y: e.y, t: 0.12 });
              NS.Game.damageEnemy(e, 5 + lvl * 2.5, 'coil');
              hits++;
            }
            if (hits) NS.Audio.tone(1500 + hits * 120, 0.05, 'sawtooth', 0.03, 0, 400);
          }
          for (const a of pod.arcs) a.t -= s.dt;
          pod.arcs = pod.arcs.filter(a => a.t > 0);
        }
      },
      drawExtra(s) {
        const st = s.weapons.coil;
        if (!st.pods) return;
        const c = s.ctx;
        for (const pod of st.pods) {
          const x = pod.x - s.cam.x, y = pod.y - s.cam.y;
          const blink = pod.life < 1.2 && Math.floor(pod.life * 6) % 2 === 0;
          if (blink) continue;
          NS.Glow.draw(c, '#c8ff8a', x, y, 10, 0.8);
          c.fillStyle = '#eaffd0';
          c.fillRect(x - 2.5, y - 2.5, 5, 5);
          c.strokeStyle = 'rgba(200,255,138,0.3)';
          c.beginPath(); c.arc(x, y, st.r || 80, 0, NS.TAU); c.stroke();
          /* jagged arcs */
          c.strokeStyle = 'rgba(200,255,138,0.8)';
          c.lineWidth = 1.5;
          for (const a of pod.arcs) {
            const ax = a.x - s.cam.x, ay = a.y - s.cam.y;
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo((x + ax) / 2 + NS.rand.range(-6, 6), (y + ay) / 2 + NS.rand.range(-6, 6));
            c.lineTo(ax, ay);
            c.stroke();
          }
          c.lineWidth = 1;
        }
      }
    },
    mirage: {
      name: 'MIRAGE DECK', color: '#c77dff', desc: 'Afterimages of your ship re-fire where you were moments ago.',
      maxLvl: 8,
      fire(s, lvl) {
        const st = s.weapons.mirage;
        st.hist = st.hist || [];
        st.hist.push({ t: s.time, x: s.player.x, y: s.player.y });
        while (st.hist.length && st.hist[0].t < s.time - 2.2) st.hist.shift();
        const n = 1 + Math.floor(lvl / 3); /* 1,1,1,2,2,2,3,3 */
        st.ghosts = [];
        for (let i = 0; i < n; i++) {
          const T = s.time - 0.6 * (i + 1);
          let g = null;
          for (let j = st.hist.length - 1; j >= 0; j--) {
            if (st.hist[j].t <= T) { g = st.hist[j]; break; }
          }
          if (g) st.ghosts.push(g);
        }
        st.cd -= s.dt;
        if (st.cd > 0) return;
        st.cd = Math.max(0.5, 1.1 - lvl * 0.06);
        for (const g of st.ghosts) {
          const t = NS.Game.nearestEnemy(g.x, g.y, 300);
          if (t) {
            NS.Game.spawnBullet(g.x, g.y, NS.angleTo(g.x, g.y, t.x, t.y), 280, 7 + lvl * 2.5, 'mirage', '#c77dff', 2.2, 1.5, { src: s.wid });
          }
        }
      },
      drawExtra(s) {
        const st = s.weapons.mirage;
        if (!st.ghosts) return;
        for (const g of st.ghosts) {
          const x = g.x - s.cam.x, y = g.y - s.cam.y;
          NS.Glow.draw(s.ctx, '#c77dff', x, y, 10, 0.28);
          s.ctx.strokeStyle = 'rgba(199,125,255,0.45)';
          s.ctx.lineWidth = 1;
          s.ctx.beginPath();
          s.ctx.moveTo(x, y - 7); s.ctx.lineTo(x + 5, y + 3);
          s.ctx.lineTo(x, y + 7); s.ctx.lineTo(x - 5, y + 3);
          s.ctx.closePath();
          s.ctx.stroke();
          s.ctx.lineWidth = 1;
        }
      }
    }
  },

  /* ================= PASSIVES ================= */
  PASSIVES: {
    speed:  { name: 'OVERDRIVE',    color: '#5ef2ff', desc: '+12% move speed',             maxLvl: 6, apply: (p) => { p.speed *= 1.12; } },
    maxhp:  { name: 'HULL PLATING', color: '#ff5e6c', desc: '+25 max HP & heal 25',        maxLvl: 8, apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
    regen:  { name: 'NANO REPAIR',  color: '#7dff9a', desc: '+0.8 HP/s regen',             maxLvl: 8, apply: (p) => { p.regen += 0.8; } },
    armor:  { name: 'ABLATIVE',     color: '#ffd23f', desc: '+2 armor',                    maxLvl: 8, apply: (p) => { p.armor += 2; } },
    magnet: { name: 'MAGNET CORE',  color: '#c77dff', desc: '+40% pickup radius',          maxLvl: 4, apply: (p) => { p.magnet *= 1.4; } },
    dmg:    { name: 'FOCUS LENS',   color: '#ff9d3f', desc: '+15% damage, ALL weapons',    maxLvl: 8, apply: () => { NS.Weapons.recomputeMods(); } },
    cd:     { name: 'COOLANT',      color: '#9dff57', desc: '-10% cooldown, ALL weapons',  maxLvl: 7, apply: () => { NS.Weapons.recomputeMods(); } },
    xp:     { name: 'DATA CHIP',    color: '#5ef2ff', desc: '+15% XP gain',                maxLvl: 4, apply: () => { NS.Game.state.xpMult += 0.15; } },
    crit:   { name: 'DEADEYE',      color: '#ff4fa3', desc: '+10% crit chance, ALL weapons', maxLvl: 5, apply: () => { NS.Weapons.recomputeMods(); } },
    thorns: { name: 'STATIC SKIN',  color: '#ffb14f', desc: 'Reflect damage to attackers', maxLvl: 5, apply: () => { NS.Game.state.thorns += 6; } },
    second: { name: 'SECOND WIND',  color: '#7dff9a', desc: 'Survive one death per run (50% HP)', maxLvl: 1, apply: () => { NS.Game.state.secondWind = true; } },
    glass:  { name: 'GLASS CANNON', color: '#ff5e6c', desc: '+25% damage, -10 max HP',     maxLvl: 3, apply: (p) => { p.maxHp = Math.max(20, p.maxHp - 10); p.hp = Math.min(p.hp, p.maxHp); NS.Weapons.recomputeMods(); } },
    bait:   { name: 'SWARM BAIT',   color: '#ff9df2', desc: '+15% enemies AND +15% XP',    maxLvl: 3, apply: () => { NS.Game.state.spawnMult += 0.15; NS.Weapons.recomputeMods(); } },
    fang:   { name: 'VAMPIRE FANG', color: '#ff4757', desc: 'Heal 1 HP every few kills',   maxLvl: 3, apply: () => { NS.Game.state.fang += 1; } },
    kinetic:{ name: 'KINETIC AMP',  color: '#ff9d3f', desc: 'Up to +30% dmg based on missing HP', maxLvl: 3, apply: () => { NS.Game.state.kinetic += 1; } },
    tsnap:  { name: 'TIME SNAP',    color: '#bfe8ff', desc: 'Enemy projectiles 12% slower', maxLvl: 3, apply: () => { NS.Game.state.bulletSlow += 0.12; } },
    salv:   { name: 'SALVAGER',     color: '#7dff9a', desc: 'All heals +50% stronger',      maxLvl: 3, apply: () => { NS.Game.state.salvager += 1; } },
    oclock: { name: 'OVERCLOCK',    color: '#ff4fa3', desc: 'FRENZY: +6 cap and it never decays', maxLvl: 1, apply: () => { NS.Game.state.overclock = true; } },
    frenzy: { name: 'FRENZY',       color: '#ff9d3f', desc: 'Kills grant attack speed (stacks, decays)', maxLvl: 4, apply: () => { NS.Game.state.frenzyCap += 3; } },
    bulwark:{ name: 'BULWARK',      color: '#8a93c9', desc: '-6% damage taken',            maxLvl: 5, apply: () => { NS.Game.state.bulwark += 1; } },
    adren:  { name: 'ADRENALINE',   color: '#7dff9a', desc: 'Heal 2 HP on every level up', maxLvl: 4, apply: () => { NS.Game.state.adrenaline += 1; } },
    plate:  { name: 'PLATING FOAM', color: '#b56cff', desc: '+12 max HP, +0.2 HP/s regen', maxLvl: 5, apply: (p) => { p.maxHp += 12; p.hp = Math.min(p.maxHp, p.hp + 12); p.regen += 0.2; } },
    execu:  { name: 'EXECUTIONER',  color: '#ff5e6c', desc: '25% chance to instantly kill weakened enemies', maxLvl: 3, apply: () => { NS.Game.state.executioner += 1; } },
    /* ---------- GLOBAL WEAPON PASSIVES ----------
       These move EVERY weapon at once. They write into PASSIVE_MODS and are
       aggregated by recomputeMods(), which is what the spawn/damage/cooldown
       choke points actually read. Taking one affects all 6 weapons at once. */
    haste:  { name: 'OVERCLOCK CORE', color: '#9dff57', desc: '-12% cooldown on ALL weapons',  maxLvl: 5, apply: () => { NS.Weapons.recomputeMods(); } },
    area:   { name: 'BLAST SHAPE',    color: '#ff9d3f', desc: '+15% size & range, ALL weapons', maxLvl: 4, apply: () => { NS.Weapons.recomputeMods(); } },
    vel:    { name: 'RAIL ROUNDS',    color: '#5ef2ff', desc: '+25% projectile speed, ALL weapons', maxLvl: 4, apply: () => { NS.Weapons.recomputeMods(); } },
    dura:   { name: 'PERSISTENCE',    color: '#bfe8ff', desc: '+25% duration, ALL weapons',   maxLvl: 4, apply: () => { NS.Weapons.recomputeMods(); } },
    pierce: { name: 'LANCE PROTOCOL', color: '#ff8ad0', desc: 'ALL projectiles pierce +1',      maxLvl: 3, apply: () => { NS.Weapons.recomputeMods(); } },
    luck:   { name: 'FORTUNE',        color: '#ffd23f', desc: '+35% chest & drop rate',        maxLvl: 3, apply: () => { NS.Weapons.recomputeMods(); } },
    greed:  { name: 'BLOOD MONEY',    color: '#ff4757', desc: '+35% XP but +20% enemies',      maxLvl: 3, apply: () => { NS.Game.state.spawnMult += 0.20; NS.Weapons.recomputeMods(); } },
    /* ---------- NEW wave 10 passives ---------- */
    snow:   { name: 'CRYO SHELL',     color: '#bfe8ff', desc: 'Every 5s: freezing nova slows and hurts nearby enemies', maxLvl: 4, apply: () => { NS.Game.state.cryo = (NS.Game.state.cryo || 0) + 1; } },
    knock:  { name: 'SEISMIC ROUNDS', color: '#ffb14f', desc: 'Every hit shoves enemies back',  maxLvl: 3, apply: () => { NS.Game.state.knock = (NS.Game.state.knock || 0) + 1; } },
    lethal: { name: 'BLOODLUST',      color: '#ff5e6c', desc: 'Crits hit +25% harder, ALL weapons', maxLvl: 3, apply: () => { NS.Game.state.critMult = (NS.Game.state.critMult || 2) + 0.25; } },
    shield: { name: 'AEGIS CORE',     color: '#bfe8ff', desc: 'Block one hit every 9s',         maxLvl: 3, apply: () => { NS.Game.state.shieldLvl = (NS.Game.state.shieldLvl || 0) + 1; } },
    dodge:  { name: 'PHASE DRIVE',    color: '#c77dff', desc: '5% chance to take zero damage',  maxLvl: 3, apply: () => { NS.Game.state.dodge = (NS.Game.state.dodge || 0) + 0.05; } },    rico:  { name: 'RICOCHET ROUNDS',color: '#ffd23f', desc: 'Killing shots bounce to the next enemy', maxLvl: 2, apply: () => { NS.Game.state.rico = (NS.Game.state.rico || 0) + 1; } },
    /* ---------- wave 12 passives ---------- */
    hex:    { name: 'HEX SIGN',      color: '#c77dff', desc: 'All damage taken by enemies +8%, ALL sources', maxLvl: 3, apply: () => { NS.Game.state.hex = (NS.Game.state.hex || 0) + 1; } },
    rush:   { name: 'BLOODRUSH',     color: '#9dff57', desc: '-8% cooldown, ALL weapons',       maxLvl: 4, apply: () => { NS.Weapons.recomputeMods(); } },
    siphon: { name: 'SIPHON',        color: '#ff4757', desc: 'Every kill heals 0.3 HP',         maxLvl: 3, apply: () => { NS.Game.state.siphon = (NS.Game.state.siphon || 0) + 1; } },
    retribution: { name: 'RETRIBUTION', color: '#ff5e6c', desc: 'Taking a hit detonates a nova around you', maxLvl: 2, apply: () => { NS.Game.state.retribution = (NS.Game.state.retribution || 0) + 1; } },
    colossus: { name: 'COLOSSUS',     color: '#ff5e6c', desc: '+20 max HP & heal 20, +1 armor', maxLvl: 4, apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); p.armor += 1; } },
    magnitude: { name: 'MAGNITUDE',   color: '#ff9d3f', desc: '+10% size & area, ALL weapons',  maxLvl: 4, apply: () => { NS.Weapons.recomputeMods(); } },
    /* ---------- LEGENDARIES (roll after 7:00 only) ---------- */
    omega:  { name: 'OMEGA CORE',   color: '#ffd23f', desc: 'All weapon cooldowns -15%',   maxLvl: 1, legendary: true, apply: () => { NS.Weapons.recomputeMods(); } },
    titan:  { name: 'TITAN HULL',   color: '#ffd23f', desc: '+80 max HP, fully healed',    maxLvl: 1, legendary: true, apply: (p) => { p.maxHp += 80; p.hp = p.maxHp; } },
    singul: { name: 'SINGULARITY',  color: '#ffd23f', desc: '+25% damage, ALL weapons',    maxLvl: 1, legendary: true, apply: () => { NS.Weapons.recomputeMods(); } },
    engine: { name: 'STAR ENGINE',  color: '#ffd23f', desc: '+20% speed, +1.5 HP/s regen', maxLvl: 1, legendary: true, apply: (p) => { p.speed *= 1.2; p.regen += 1.5; } }
  },

  LEGENDARY_AT: 420, /* seconds — legendaries join the draft pool */

  /* ================= GLOBAL WEAPON MODS =================
     One row per global passive. Levels multiply, so stacking OVERCLOCK CORE
     really does keep speeding up every weapon. These are read at the spawn /
     damage / cooldown choke points, so they affect all weapons at once
     without touching any individual weapon body. */
  PASSIVE_MODS: {
    haste:  { cd: 0.88 },
    cd:     { cd: 0.90 },
    omega:  { cd: 0.85 },
    rush:   { cd: 0.92 },
    dmg:    { dmg: 1.15 },
    glass:  { dmg: 1.25 },
    singul: { dmg: 1.25 },
    area:   { size: 1.15 },
    magnitude: { size: 1.10 },
    vel:    { spd: 1.25 },
    dura:   { life: 1.25 },
    pierce: { pierce: 1 },
    luck:   { luck: 1.35 },
    greed:  { xp: 1.35 },
    bait:   { xp: 1.15 },
    crit:   { crit: 0.10 }
  },

  BASE_CRIT: 0.05,

  /* Aggregate every owned global passive into state.mods, then mirror the
     three the old code reads directly (dmgMult / cdMult / critChance) so all
     existing damage and cooldown paths keep working unchanged. */
  recomputeMods() {
    const s = NS.Game.state;
    const m = { cd: 1, dmg: 1, size: 1, spd: 1, life: 1, pierce: 0, luck: 1, xp: 1, crit: 0 };
    for (const pid in s.passives) {
      const row = this.PASSIVE_MODS[pid];
      if (!row) continue;
      const n = s.passives[pid];
      if (row.cd) m.cd *= Math.pow(row.cd, n);
      if (row.dmg) m.dmg *= Math.pow(row.dmg, n);
      if (row.size) m.size *= Math.pow(row.size, n);
      if (row.spd) m.spd *= Math.pow(row.spd, n);
      if (row.life) m.life *= Math.pow(row.life, n);
      if (row.pierce) m.pierce += row.pierce * n;
      if (row.luck) m.luck *= Math.pow(row.luck, n);
      if (row.xp) m.xp *= Math.pow(row.xp, n);
      if (row.crit) m.crit += row.crit * n;
    }
    s.mods = m;
    /* mirrored for the existing pipeline, on top of character/quirk bonuses */
    const f = s.flat;
    s.dmgMult = m.dmg * f.dmg;
    s.cdMult = m.cd * f.cd;
    s.critChance = this.BASE_CRIT + m.crit + f.crit;
    s.xpMult = m.xp * f.xp;
    return m;
  },

  mods() {
    return (NS.Game.state && NS.Game.state.mods) ||
      { cd: 1, dmg: 1, size: 1, spd: 1, life: 1, pierce: 0, luck: 1, xp: 1, crit: 0 };
  },

  /* ================= RUN STATE ================= */
  newRunState() {
    return {
      weapons: { pulse: { lvl: 1, cd: 0 } },
      passives: {},
      dmgMult: 1, cdMult: 1, xpMult: 1,
      critChance: 0.05, thorns: 0, secondWind: false,
      spawnMult: 1, fang: 0, fangKills: 0,
      frenzyCap: 0, frenzy: 0, frenzyT: 0,
      bulwark: 0, adrenaline: 0, executioner: 0,
      kinetic: 0, bulletSlow: 0, salvager: 0, overclock: false,
      /* wave 10 passives */
      cryo: 0, cryoT: undefined, knock: 0, critMult: 2,
      shieldLvl: 0, dodge: 0, rico: 0,
      /* wave 12 passives */
      hex: 0, rush: 0, siphon: 0, retribution: 0, colossus: 0, magnitude: 0,
      retriT: 0, enemySlowT: 0, timeSlow: 0,
      evoChest: false, finals: 0,
      /* flat = bonuses from characters/quirks; mods = aggregated passives.
         Kept apart so recomputeMods() can never erase a character bonus. */
      flat: { dmg: 1, cd: 1, crit: 0, xp: 1 },
      mods: { cd: 1, dmg: 1, size: 1, spd: 1, life: 1, pierce: 0, luck: 1, xp: 1, crit: 0 }
    };
  },

  /* slot caps (VS-style) */
  MAX_WEAPONS: 6,
  MAX_PASSIVES: 6,

  /* ================= DRAFT GENERATION =================
     Evo rule (VS-faithful): weapon LV8 + its paired passive owned = the
     evolution is offered. At most ONE evo per screen. After evolving, that
     weapon offers only MASTERY stat picks. Chests force an evo when ready. */
  rollDraft() {
    const s = NS.Game.state;
    const wIds = Object.keys(this.DEFS);
    const pIds = Object.keys(this.PASSIVES);

    const weaponOpts = [];
    for (const id of wIds) {
      const owned = s.weapons[id];
      if (!owned) {
        if (Object.keys(s.weapons).length < this.MAX_WEAPONS) {
          weaponOpts.push({ type: 'wnew', id, lvl: 1 });
        }
        continue;
      }
      if (owned.evo) {
        /* evolved: mastery ladder only */
        if ((owned.mastery || 0) < this.MAX_MASTERY) {
          weaponOpts.push({ type: 'mastery', id, lvl: (owned.mastery || 0) + 1 });
        }
        continue;
      }
      if (owned.lvl < this.DEFS[id].maxLvl) {
        weaponOpts.push({ type: 'wlevel', id, lvl: owned.lvl + 1 });
      }
    }

    const passiveOpts = [];
    const passiveCount = Object.keys(s.passives).length;
    for (const id of pIds) {
      const def = this.PASSIVES[id];
      const cur = s.passives[id] || 0;
      if (cur >= def.maxLvl) continue;
      if (def.legendary && s.time < this.LEGENDARY_AT) continue;
      if (!cur && passiveCount >= this.MAX_PASSIVES) continue;
      passiveOpts.push({ type: 'passive', id, lvl: cur + 1 });
    }

    /* EVOLUTIONS: maxed + un-evolved + paired passive owned */
    const evoOpts = [];
    for (const id of wIds) {
      const owned = s.weapons[id];
      if (owned && !owned.evo && owned.lvl >= this.DEFS[id].maxLvl &&
          this.EVOS[id] && (s.passives[this.EVO_PAIR[id]] || 0) > 0) {
        evoOpts.push({ type: 'evo', id });
      }
    }

    /* CHEST GUARANTEE: chest roll forces an evolution when one is ready */
    if (s.evoChest && evoOpts.length) {
      s.evoChest = false;
      const e = evoOpts[Math.floor(NS.rand.next() * evoOpts.length)];
      const others = [];
      const allPool = weaponOpts.concat(passiveOpts);
      while (others.length < 2 && allPool.length) {
        const pick = allPool.splice(Math.floor(NS.rand.next() * allPool.length), 1)[0];
        if (!others.some(o => o.id === pick.id && o.type === pick.type)) others.push(pick);
      }
      return [e].concat(others);
    }

    const bag = weaponOpts.concat(passiveOpts);
    const picked = [];
    /* RULE: exactly one evolution per draft when one is available */
    if (evoOpts.length) picked.push(evoOpts[Math.floor(NS.rand.next() * evoOpts.length)]);
    const pool = bag.slice();
    while (picked.length < 3 && pool.length) {
      const i = Math.floor(NS.rand.next() * pool.length);
      const choice = pool[i];
      if (!picked.some(p2 => p2.id === choice.id && p2.type === choice.type)) picked.push(choice);
      for (let j = pool.length - 1; j >= 0; j--) {
        if (pool[j].id === choice.id && pool[j].type === choice.type) pool.splice(j, 1);
      }
    }
    if (!picked.length && evoOpts.length) picked.push(evoOpts[0]);
    return picked.length ? picked : null;
  },

  applyChoice(choice) {
    const s = NS.Game.state;
    if (choice.type === 'wnew') {
      s.weapons[choice.id] = { lvl: 1, cd: 0 };
    } else if (choice.type === 'wlevel') {
      s.weapons[choice.id].lvl = choice.lvl;
    } else if (choice.type === 'passive') {
      s.passives[choice.id] = choice.lvl;
      this.PASSIVES[choice.id].apply(NS.Game.player);
      this.recomputeMods(); /* global weapon passives move every weapon */
    } else if (choice.type === 'mastery') {
      /* post-evolution progression: stats only, never new behaviour */
      s.weapons[choice.id].mastery = choice.lvl;
    } else if (choice.type === 'evo') {
      const w = s.weapons[choice.id];
      w.evo = true;
      w.mastery = 0;
      w.cd = 0;
      s.finals = (s.finals || 0) + 1;
      const e = this.EVOS[choice.id];
      const p = NS.Game.player;
      NS.Audio.victory();
      NS.Shake.add(7, 0.5);
      NS.Particles.burst(p.x, p.y, 40, { color: e.color, glow: true, life: 1.1 });
      NS.Game.spawnRing(p.x, p.y, e.color, 10, 60, 0.9);
      NS.Game.spawnRing(p.x, p.y, '#ffffff', 4, 110, 0.6);
      NS.UI.toast('★ EVOLUTION — ' + e.name + '!', true);
    }
    NS.Audio.choose();
  },

  /* ================= EVOLUTIONS =================
     One evolution per weapon. Rule (VS-faithful, owner-requested):
       weapon at LV8 + its PAIRED passive = evolution offered.
     The evo is a NEW FIRE PATTERN (each has its own fire() + drawExtra),
     then that weapon offers MASTERY stat picks (cap 8). One final per
     draft screen; chests guarantee one when ready. */
  MAX_MASTERY: 8,

  EVO_PAIR: {
    pulse: 'dmg',      blades: 'speed',   nova: 'area',      lightning: 'cd',
    mines: 'luck',     drone: 'haste',    frost: 'maxhp',    railgun: 'crit',
    beam: 'vel',       spike: 'glass',    tornado: 'magnet', ghost: 'xp',
    seeker: 'tsnap',   gpulse: 'plate',   omines: 'fang',    turret: 'adren',
    boomerang: 'pierce', saw: 'kinetic',  aegis: 'armor',    flux: 'dura',
    prism: 'oclock',   missiles: 'salv',  whip: 'frenzy',    repel: 'bulwark',
    rain: 'crit',      airstrike: 'dmg',  split: 'vel',      cluster: 'luck',
    flak: 'haste',     mirage: 'execu',   lotus: 'magnet',   coil: 'thorns'
  },

  EVOS: {
    pulse: { name: 'SINGULARITY CANNON', color: '#fff6d8',
      desc: 'Twin counter-rotating lances drill through everything',
      fire(s) {
        const st = s.weapons.pulse;
        st.sp = (st.sp || 0) + s.dt;
        const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 460);
        if (!t) return;
        st.pre = (st.pre || 0) + 0.1;
        if (st.sp < 0.05) return;
        st.sp = 0;
        const base = NS.angleTo(s.player.x, s.player.y, t.x, t.y);
        for (let k = 0; k < 2; k++) {
          const a = base + (k ? Math.PI : 0) + Math.sin(st.pre) * 0.55;
          NS.Game.spawnBullet(s.player.x, s.player.y, a, 440, 15, 'lance', '#fff6d8', 2.6, 2, { src: s.wid, pierce: 4 });
        }
        NS.Audio.shoot();
      }
    },
    blades: { name: 'GILDED HALO', color: '#ffd23f',
      desc: 'Twin orbiting halos with a 2x damage field',
      mods: { dmg: 2 },
      fire(s) {
        const st = s.weapons.blades;
        st.ang = (st.ang || 0) + s.dt * 4.2;
        st.pos = st.pos || [];
        for (let ring = 0; ring < 2; ring++) {
          const n = 4, R = ring ? 128 : 86;
          for (let i = 0; i < n; i++) {
            const a = st.ang * (ring ? -1 : 1) + i * NS.TAU / n + ring * 0.4;
            const bx = s.player.x + Math.cos(a) * R, by = s.player.y + Math.sin(a) * R;
            st.pos[ring * n + i] = st.pos[ring * n + i] || { x: 0, y: 0, hitCd: {} };
            const b = st.pos[ring * n + i];
            b.x = bx; b.y = by;
            const near = NS.Grid.query(bx, by, 22, NS.Game._q);
            for (let k = 0; k < near.length; k++) {
              const e = near[k];
              if (e.dead) continue;
              if (NS.dist2(bx, by, e.x, e.y) < (e.r + 11) * (e.r + 11) &&
                  s.time - (b.hitCd[e.id] || 0) > 0.18) {
                b.hitCd[e.id] = s.time;
                NS.Game.damageEnemy(e, 40, 'blades');
              }
            }
          }
        }
      },
      drawExtra(s) {
        const st = s.weapons.blades;
        if (!st.pos) return;
        for (const b of st.pos) {
          if (!b) continue;
          const x = b.x - s.cam.x, y = b.y - s.cam.y;
          NS.Glow.draw(s.ctx, '#ffd23f', x, y, 20, 0.8);
          s.ctx.save(); s.ctx.translate(x, y); s.ctx.rotate(s.time * 14);
          s.ctx.fillStyle = '#fffbe8';
          s.ctx.fillRect(-7, -2, 14, 4); s.ctx.fillRect(-2, -7, 4, 14);
          s.ctx.restore();
        }
      }
    },
    nova: { name: 'SUPERNOVA', color: '#e0a8ff',
      desc: 'The ring implodes, then detonates twice — leaving a burning scar',
      fire(s) {
        const st = s.weapons.nova;
        st.t = (st.t || 0) - s.dt;
        st.queue = st.queue || [];
        for (let i = st.queue.length - 1; i >= 0; i--) {
          const q = st.queue[i];
          q.t -= s.dt;
          if (q.t > 0) continue;
          st.queue.splice(i, 1);
          NS.Game.spawnRing(q.x, q.y, '#e0a8ff', 8, 30, 0.6);
          NS.Grid.query(q.x, q.y, q.R, NS.Game._q);
          for (const e of NS.Game._q) {
            if (e.dead) continue;
            if (NS.dist2(q.x, q.y, e.x, e.y) < q.R * q.R) NS.Game.damageEnemy(e, 70, 'nova');
          }
          NS.Shake.add(5, 0.35);
          NS.Audio.tone(70, 0.5, 'sawtooth', 0.14, 0, 30);
          NS.Particles.burst(q.x, q.y, 24, { color: '#e0a8ff', glow: true, life: 0.6 });
        }
        if (st.t > 0) return;
        st.t = 2.4;
        const p = s.player;
        NS.Game.spawnRing(p.x, p.y, '#c77dff', 10, 40, 0.5);
        st.queue.push({ x: p.x, y: p.y, R: 160, t: 0.35 });
        st.queue.push({ x: p.x, y: p.y, R: 245, t: 0.85 });
      }
    },
    lightning: { name: 'TEMPEST', color: '#c8ff8a',
      desc: 'A permanent storm — strikes anywhere on screen, chains 20 times',
      fire(s) {
        const st = s.weapons.lightning;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 0.42;
        const list = NS.Enemies.list;
        const t = NS.rand.next() < 0.55
          ? NS.Game.nearestEnemy(s.player.x, s.player.y, 900)
          : (list.length ? list[Math.floor(NS.rand.next() * list.length)] : null);
        if (!t || t.dead) return;
        const hitList = [t];
        let dmg = 55;
        NS.Game.damageEnemy(t, dmg, 'lightning');
        for (let c = 1; c < 20; c++) {
          const next = NS.Game.nearestEnemyTo(t.x, t.y, 190, hitList);
          if (!next) break;
          NS.Game.damageEnemy(next, dmg, 'lightning');
          hitList.push(next);
          t.x = next.x; t.y = next.y;
          dmg *= 0.9;
        }
        st.bolt = { pts: [{ x: s.player.x, y: s.player.y }], t: 0.14 };
        for (const e of hitList) st.bolt.pts.push({ x: e.x, y: e.y });
        NS.Audio.tone(1600, 0.06, 'sine', 0.05, 0, 500);
      },
      drawExtra(s) {
        const st = s.weapons.lightning;
        if (!st.bolt) return;
        const a = st.bolt.t / 0.14;
        s.ctx.strokeStyle = 'rgba(200,255,138,' + a + ')';
        s.ctx.lineWidth = 2.5;
        s.ctx.beginPath();
        for (let i = 0; i < st.bolt.pts.length; i++) {
          const p = st.bolt.pts[i];
          const x = p.x - s.cam.x + NS.rand.range(-4, 4), y = p.y - s.cam.y + NS.rand.range(-4, 4);
          if (i === 0) s.ctx.moveTo(x, y); else s.ctx.lineTo(x, y);
        }
        s.ctx.stroke();
        s.ctx.lineWidth = 1;
      }
    },
    mines: { name: 'MINEFIELD PROTOCOL', color: '#ff8a94',
      desc: 'Lays a rotating lattice of mines ahead of where you walk',
      fire(s) {
        const st = s.weapons.mines;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 0.3;
        const p = s.player;
        st.ang = (st.ang || NS.rand.range(0, NS.TAU)) + 0.7;
        for (let ring = 1; ring <= 3; ring++) {
          for (let i = 0; i < 4; i++) {
            const a = st.ang + i * NS.TAU / 4 + ring * 0.4;
            NS.Game.spawnMine(p.x + Math.cos(a) * ring * 46, p.y + Math.sin(a) * ring * 46, 52, 95);
          }
        }
        st.ang += 0.5;
      }
    },
    drone: { name: 'WINGMAN ESCORT', color: '#ffc08a',
      desc: 'Five interceptor drones body-block and fire with you',
      fire(s) {
        const st = s.weapons.drone;
        st.ang = (st.ang || 0) + s.dt * 1.7;
        st.pos = st.pos || [];
        const n = 5, p = s.player;
        for (let i = 0; i < n; i++) {
          const a = st.ang + i * NS.TAU / n;
          st.pos[i] = st.pos[i] || { x: p.x, y: p.y };
          const b = st.pos[i];
          b.x = p.x + Math.cos(a) * 74;
          b.y = p.y + Math.sin(a) * 74;
          const t = NS.Game.nearestEnemy(b.x, b.y, 230);
          if (t && s.time - (b.cd || 0) > 0.42) {
            b.cd = s.time;
            NS.Game.spawnBullet(b.x, b.y, NS.angleTo(b.x, b.y, t.x, t.y), 340, 18, 'drone', '#ff9d3f', 2.2, 1.6, { src: s.wid });
            NS.Audio.tone(700, 0.04, 'square', 0.02, 0, 350);
          }
        }
      },
      drawExtra(s) {
        const st = s.weapons.drone;
        if (!st.pos) return;
        for (const b of st.pos) {
          const x = b.x - s.cam.x, y = b.y - s.cam.y;
          NS.Glow.draw(s.ctx, '#ff9d3f', x, y, 11, 0.7);
          s.ctx.fillStyle = '#ffe0c0';
          s.ctx.fillRect(x - 3, y - 3, 6, 6);
        }
      }
    },
    frost: { name: 'ABSOLUTE ZERO', color: '#c8f4ff',
      desc: 'The field grows while you hold still — frozen enemies SHATTER',
      fire(s) {
        const st = s.weapons.frost;
        st.tick = (st.tick || 0) - s.dt;
        st.still = (NS.Input.joy.active && Math.abs(NS.Input.joy.x) + Math.abs(NS.Input.joy.y) < 0.15) ? (st.still || 0) + s.dt : 0;
        st.r = 150 + Math.min(130, st.still * 34);
        if (st.tick > 0) return;
        st.tick = 0.22;
        const p = s.player;
        NS.Grid.query(p.x, p.y, st.r, NS.Game._q);
        for (const e of NS.Game._q) {
          if (e.dead || NS.dist2(p.x, p.y, e.x, e.y) > st.r * st.r) continue;
          if (e.slowT > 0 && e.slowAmt > 0.9 && !e.shattered) {
            e.shattered = true;
            NS.Game.damageEnemy(e, 120, 'frost');
            NS.Particles.burst(e.x, e.y, 10, { color: '#c8f4ff', glow: true, life: 0.4 });
            continue;
          }
          if (NS.rand.next() < 0.14) { e.slowT = 1.1; e.slowAmt = 0.95; }
          else { e.slowT = Math.max(e.slowT || 0, 0.5); e.slowAmt = 0.8; }
        }
      },
      drawExtra(s) {
        const st = s.weapons.frost;
        if (!st.r) return;
        s.ctx.strokeStyle = 'rgba(200,244,255,0.35)';
        s.ctx.lineWidth = 2;
        s.ctx.beginPath();
        s.ctx.arc(s.player.x - s.cam.x, s.player.y - s.cam.y, st.r, 0, NS.TAU);
        s.ctx.stroke();
        s.ctx.lineWidth = 1;
      }
    },
    railgun: { name: 'LAZARUS', color: '#ff8ad0',
      desc: 'Charges, then fires a burning slug line where you last moved',
      fire(s) {
        const st = s.weapons.railgun;
        st.chg = (st.chg || 0) + s.dt;
        st.aim = NS.Weapons.aimAngle(s, st.aim, 640);
        if (st.chg < 0.7) return;
        st.chg = 0;
        const p = s.player, a = st.aim || 0;
        for (let d = 8; d < 620; d += 18) {
          NS.Game.spawnBullet(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, a, 700, 46, 'rail', '#ff8ad0', 2.6, 0.7, { src: s.wid, pierce: 99 });
        }
        st.scorch = { a, t: 1.4 };
        NS.Shake.add(6, 0.3);
        NS.Audio.tone(180, 0.35, 'sawtooth', 0.14, 0, 60);
        NS.Particles.burst(p.x, p.y, 16, { color: '#ff8ad0', glow: true, life: 0.5 });
      },
      drawExtra(s) {
        const st = s.weapons.railgun;
        if (!st.scorch) return;
        st.scorch.t -= 0.016;
        if (st.scorch.t <= 0) { st.scorch = null; return; }
        const a = st.scorch.t / 1.4;
        s.ctx.strokeStyle = 'rgba(255,138,208,' + (a * 0.5) + ')';
        s.ctx.lineWidth = 8;
        s.ctx.beginPath();
        s.ctx.moveTo(s.player.x - s.cam.x, s.player.y - s.cam.y);
        s.ctx.lineTo(s.player.x - s.cam.x + Math.cos(st.scorch.a) * 600,
                     s.player.y - s.cam.y + Math.sin(st.scorch.a) * 600);
        s.ctx.stroke();
        s.ctx.lineWidth = 1;
      }
    },
    beam: { name: 'HELIOS', color: '#ffd08a',
      desc: 'Two counter-sweeping suns leave a burning wake on the ground',
      fire(s) {
        const st = s.weapons.beam;
        st.ang = (st.ang || 0) + s.dt * 1.5;
        st.wake = st.wake || [];
        const p = s.player;
        for (let k = 0; k < 2; k++) {
          const a = st.ang * (k ? -1 : 1) + k * 1.6;
          const ex = p.x + Math.cos(a) * 300, ey = p.y + Math.sin(a) * 300;
          NS.Grid.query(p.x, p.y, 300, NS.Game._q);
          for (const e of NS.Game._q) {
            if (e.dead) continue;
            const t = Math.max(0, Math.min(1, ((e.x - p.x) * Math.cos(a) + (e.y - p.y) * Math.sin(a)) / 300));
            const px = p.x + Math.cos(a) * 300 * t, py = p.y + Math.sin(a) * 300 * t;
            if (NS.dist2(px, py, e.x, e.y) < 18 * 18) NS.Game.damageEnemy(e, 26, 'beam');
          }
          st.wake.push({ x: ex, y: ey, t: 1.6 });
        }
        while (st.wake.length > 40) st.wake.shift();
      },
      drawExtra(s) {
        const st = s.weapons.beam;
        if (!st.wake) return;
        const p = s.player;
        for (let k = 0; k < 2; k++) {
          const a = (st.ang || 0) * (k ? -1 : 1) + k * 1.6;
          s.ctx.strokeStyle = 'rgba(255,208,138,0.5)';
          s.ctx.lineWidth = 12;
          s.ctx.beginPath();
          s.ctx.moveTo(p.x - s.cam.x, p.y - s.cam.y);
          s.ctx.lineTo(p.x - s.cam.x + Math.cos(a) * 300, p.y - s.cam.y + Math.sin(a) * 300);
          s.ctx.stroke();
        }
        s.ctx.lineWidth = 1;
        for (const w of st.wake) {
          w.t -= 0.016;
          if (w.t <= 0) continue;
          NS.Glow.draw(s.ctx, '#ff9d3f', w.x - s.cam.x, w.y - s.cam.y, 26 * (w.t / 1.6), 0.4);
        }
        st.wake = st.wake.filter(w => w.t > 0);
      }
    },
    spike: { name: 'THORNQUEEN', color: '#ff8ad0',
      desc: 'Shotgun along your heading + a defensive spike ring',
      fire(s) {
        const st = s.weapons.spike;
        st.cd = (st.cd || 0) - s.dt;
        st.ring = (st.ring || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 0.5;
        const a = NS.Weapons.aimAngle(s, st.ang || 0, 520);
        st.ang = a;
        for (let i = -3; i <= 3; i++) {
          NS.Game.spawnBullet(s.player.x, s.player.y, a + i * 0.16, 300, 26, 'spike', '#ff8ad0', 2.4, 1.2, { src: s.wid, pierce: 2 });
        }
        NS.Audio.shoot();
        if (st.ring <= 0) {
          st.ring = 2.4;
          NS.Grid.query(s.player.x, s.player.y, 96, NS.Game._q);
          for (const e of NS.Game._q) {
            if (e.dead) continue;
            if (NS.dist2(s.player.x, s.player.y, e.x, e.y) < 96 * 96) {
              const ea = NS.angleTo(s.player.x, s.player.y, e.x, e.y);
              NS.Game.spawnBullet(s.player.x, s.player.y, ea, 260, 30, 'spike', '#ffd0f0', 2.2, 1, { src: s.wid });
            }
          }
          NS.Game.spawnRing(s.player.x, s.player.y, '#ff8ad0', 6, 96, 0.35);
        }
      }
    },
    tornado: { name: 'MEPHISTO', color: '#c8ff8a',
      desc: 'A wider maelstrom that hurls everything it swallowed outward',
      fire(s) {
        const st = s.weapons.tornado;
        st.t = (st.t || 0) - s.dt;
        st.a = (st.a || 0) + s.dt * 2.6;
        st.r = 130;
        const p = s.player;
        NS.Grid.query(p.x, p.y, st.r, NS.Game._q);
        for (const e of NS.Game._q) {
          if (e.dead) continue;
          const d2 = NS.dist2(p.x, p.y, e.x, e.y);
          if (d2 > st.r * st.r) continue;
          const ea = NS.angleTo(e.x, e.y, p.x, p.y);
          const pull = 210 * s.dt;
          e.x += Math.cos(ea) * pull; e.y += Math.sin(ea) * pull;
          NS.Game.damageEnemy(e, 34, 'tornado');
        }
        if (st.t > 0) return;
        st.t = 3.2;
        NS.Grid.query(p.x, p.y, st.r, NS.Game._q);
        for (const e of NS.Game._q) {
          if (e.dead) continue;
          if (NS.dist2(p.x, p.y, e.x, e.y) > st.r * st.r) continue;
          const ea = NS.angleTo(p.x, p.y, e.x, e.y);
          e.x += Math.cos(ea) * 130; e.y += Math.sin(ea) * 130;
          NS.Game.damageEnemy(e, 60, 'tornado');
        }
        NS.Game.spawnRing(p.x, p.y, '#9dff57', 8, 40, 0.5);
        NS.Audio.tone(120, 0.3, 'sawtooth', 0.1, 0, 40);
      },
      drawExtra(s) {
        const st = s.weapons.tornado;
        if (!st.r) return;
        const p = s.player;
        for (let i = 0; i < 5; i++) {
          const a = (st.a || 0) + i * NS.TAU / 5;
          const rr = st.r * (0.35 + (i % 3) * 0.22);
          NS.Glow.draw(s.ctx, '#9dff57', p.x - s.cam.x + Math.cos(a) * rr, p.y - s.cam.y + Math.sin(a) * rr, 22, 0.28);
        }
      }
    },
    ghost: { name: 'SOUL REAVER', color: '#e0e6ff',
      desc: 'EXECUTES anything under 20% HP — each reaped soul splits in two',
      fire(s) {
        const st = s.weapons.ghost;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 0.7;
        for (let i = 0; i < 6; i++) {
          const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 520);
          if (!t) break;
          if (t.hp < t.maxHp * 0.2) NS.Game.damageEnemy(t, t.hp + 1, 'reaver');
          else NS.Game.spawnHoming(s.player.x, s.player.y, t, 300, 95, 'reaver', '#e0e6ff', 3.5, 2.6, 0, s.wid);
        }
        NS.Audio.tone(500, 0.1, 'sawtooth', 0.06, 0, 900);
        NS.Shake.add(1.5, 0.12);
      }
    },
    seeker: { name: 'JERICHO RAIN', color: '#dff4ff',
      desc: 'Saturation volley — darts fork on impact and keep hunting',
      fire(s) {
        const st = s.weapons.seeker;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 0.5;
        for (let i = 0; i < 8; i++) {
          const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 420);
          if (!t) break;
          NS.Game.spawnHoming(s.player.x, s.player.y, t, 300, 22, 'seeker', '#dff4ff', 2.6, 2.2, 12, s.wid);
        }
        NS.Audio.tone(1200, 0.06, 'square', 0.04, 0, 1800);
      }
    },
    gpulse: { name: 'EVENT HORIZON', color: '#aab6e8',
      desc: 'A roaming shockwave that drags enemies into its core',
      fire(s) {
        const st = s.weapons.gpulse;
        st.cd = (st.cd || 0) - s.dt;
        st.waves = st.waves || [];
        if (st.cd <= 0) {
          st.cd = 1.9;
          st.waves.push({ r: 14, maxR: 190, dmg: 55, hit: {} });
        }
        for (let i = st.waves.length - 1; i >= 0; i--) {
          const w = st.waves[i];
          w.r += 170 * s.dt;
          const near = NS.Grid.query(s.player.x, s.player.y, w.r + 20, NS.Game._q);
          for (const e of near) {
            if (e.dead) continue;
            const d = NS.dist(s.player.x, s.player.y, e.x, e.y);
            if (d > w.r - 20 && d < w.r + 20 && !w.hit[e.id]) {
              w.hit[e.id] = 1;
              NS.Game.damageEnemy(e, w.dmg, 'gpulse');
              if (!e.isBoss) {
                const a = NS.angleTo(e.x, e.y, s.player.x, s.player.y);
                e.x += Math.cos(a) * 46; e.y += Math.sin(a) * 46;
              }
            }
          }
          if (w.r >= w.maxR) st.waves.splice(i, 1);
        }
      },
      drawExtra(s) {
        const st = s.weapons.gpulse;
        if (!st.waves) return;
        for (const w of st.waves) {
          s.ctx.strokeStyle = 'rgba(170,182,232,0.55)';
          s.ctx.lineWidth = 5;
          s.ctx.beginPath();
          s.ctx.arc(s.player.x - s.cam.x, s.player.y - s.cam.y, w.r, 0, NS.TAU);
          s.ctx.stroke();
          s.ctx.lineWidth = 1;
        }
      }
    },
    omines: { name: 'NOVA CROWN', color: '#ff6b7d',
      desc: 'A rotating crown of armed mines orbits you',
      fire(s) {
        const st = s.weapons.omines;
        st.ang = (st.ang || 0) + s.dt * 2.2;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 2.2;
        const p = s.player;
        for (let i = 0; i < 8; i++) {
          const a = st.ang + i * NS.TAU / 8;
          NS.Game.spawnMine(p.x + Math.cos(a) * 84, p.y + Math.sin(a) * 84, 40, 90);
        }
      },
      drawExtra(s) {
        const st = s.weapons.omines;
        if (!st.ang) return;
        const x = s.player.x - s.cam.x, y = s.player.y - s.cam.y;
        s.ctx.strokeStyle = 'rgba(255,107,125,0.4)';
        s.ctx.setLineDash([5, 7]);
        s.ctx.beginPath(); s.ctx.arc(x, y, 84, st.ang, st.ang + NS.TAU); s.ctx.stroke();
        s.ctx.setLineDash([]);
      }
    },
    turret: { name: 'FORTRESS GRID', color: '#baff8a',
      desc: 'Six permanent-gun turrets lock the area down',
      fire(s) {
        const st = s.weapons.turret;
        st.cd = (st.cd || 0) - s.dt;
        st.list = st.list || [];
        if (st.cd <= 0 && st.list.length < 6) {
          st.cd = 1.2;
          const a = NS.rand.range(0, NS.TAU);
          st.list.push({ x: s.player.x + Math.cos(a) * 70, y: s.player.y + Math.sin(a) * 70, life: 999, cd: 0 });
        }
        for (const t of st.list) {
          t.cd -= s.dt;
          if (t.cd <= 0) {
            t.cd = 0.34;
            const target = NS.Game.nearestEnemy(t.x, t.y, 260);
            if (target) NS.Game.spawnBullet(t.x, t.y, NS.angleTo(t.x, t.y, target.x, target.y), 340, 13, 'turret', '#baff8a', 2.4, 1.4);
          }
        }
      },
      drawExtra(s) {
        const st = s.weapons.turret;
        if (!st.list) return;
        for (const t of st.list) {
          const x = t.x - s.cam.x, y = t.y - s.cam.y;
          NS.Glow.draw(s.ctx, '#baff8a', x, y, 12, 0.75);
          s.ctx.fillStyle = '#eaffd8';
          s.ctx.fillRect(x - 3, y - 3, 6, 6);
          s.ctx.strokeStyle = 'rgba(186,255,138,0.7)';
          s.ctx.beginPath(); s.ctx.arc(x, y, 6.5, 0, NS.TAU); s.ctx.stroke();
        }
      }
    },
    boomerang: { name: 'GUNGNIR', color: '#e8fff4',
      desc: 'Three great blades that hunt, return, and pierce all',
      fire(s) {
        const st = s.weapons.boomerang;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 1.1;
        for (let i = 0; i < 3; i++) {
          const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 380);
          const a = t ? NS.angleTo(s.player.x, s.player.y, t.x, t.y) + (i - 1) * 0.45 : NS.rand.range(0, NS.TAU);
          NS.Game.spawnBullet(s.player.x, s.player.y, a, 300, 34, 'boomerang', '#e8fff4', 4.5, 3.6,
            { pierce: 99, perHitCd: 0.25, boom: true, turnT: 0.6, src: s.wid });
        }
        NS.Audio.tone(700, 0.12, 'triangle', 0.07, 0, 400);
      }
    },
    saw: { name: 'PAIN TRAIN', color: '#f0f0ff',
      desc: 'A massive blade that ricochets up to 14 times',
      fire(s) {
        const st = s.weapons.saw;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 0.9;
        const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 320);
        if (!t) return;
        const a = NS.angleTo(s.player.x, s.player.y, t.x, t.y);
        NS.Game.spawnBullet(s.player.x, s.player.y, a, 270, 30, 'saw', '#f0f0ff', 6, 3,
          { pierce: 14, reaim: true, src: s.wid });
        NS.Audio.tone(1500, 0.08, 'square', 0.05, 0, 600);
      }
    },
    aegis: { name: 'TSUNAMI PROTOCOL', color: '#ffd08a',
      desc: 'Twin stacked waves roll out and crush everything they pass',
      fire(s) {
        const st = s.weapons.aegis;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd <= 0) {
          st.cd = 1.7;
          st.waves = st.waves || [];
          st.waves.push({ r: 12, maxR: 170, dmg: 42, hit: {} });
          st.waves.push({ r: 12, maxR: 170, dmg: 42, hit: {} });
          NS.Audio.tone(280, 0.25, 'sine', 0.1, 0, 600);
        }
        st.waves = st.waves || [];
        for (let i = st.waves.length - 1; i >= 0; i--) {
          const w = st.waves[i];
          w.r += 175 * s.dt;
          const near = NS.Grid.query(s.player.x, s.player.y, w.r + 16, NS.Game._q);
          for (const e of near) {
            if (e.dead || w.hit[e.id]) continue;
            const d = NS.dist(s.player.x, s.player.y, e.x, e.y);
            if (Math.abs(d - w.r) < 15 + e.r) {
              w.hit[e.id] = 1;
              NS.Game.damageEnemy(e, w.dmg, 'aegis');
            }
          }
          if (w.r >= w.maxR) st.waves.splice(i, 1);
        }
      },
      drawExtra(s) {
        const st = s.weapons.aegis;
        if (!st.waves) return;
        for (const w of st.waves) {
          s.ctx.strokeStyle = 'rgba(255,208,138,0.6)';
          s.ctx.lineWidth = 4;
          s.ctx.beginPath();
          s.ctx.arc(s.player.x - s.cam.x, s.player.y - s.cam.y, w.r, 0, NS.TAU);
          s.ctx.stroke();
          s.ctx.lineWidth = 1;
        }
      }
    },
    flux: { name: 'ANNIHILATION ORB', color: '#d9a8ff',
      desc: 'Three colossal slow orbs that unmake everything they drift through',
      fire(s) {
        const st = s.weapons.flux;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 2.0;
        for (let i = 0; i < 3; i++) {
          const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 320);
          const a = t ? NS.angleTo(s.player.x, s.player.y, t.x, t.y) + i * (NS.TAU / 3) : NS.rand.range(0, NS.TAU);
          NS.Game.spawnBullet(s.player.x, s.player.y, a, 75, 20, 'flux', '#d9a8ff', 10, 4.5,
            { pierce: 999, perHitCd: 0.3, src: s.wid });
        }
      }
    },
    prism: { name: 'SPECTRAL ARRAY', color: '#baf3ff',
      desc: 'Six rotating lasers slice the whole arena',
      mods: {},
      fire(s) {
        const st = s.weapons.prism;
        st.ang = (st.ang || 0) + s.dt * 1.6;
        st.beams = 6;
        st.len = 210;
        st.width = 4;
        st.tick = (st.tick || 0) - s.dt;
        const p = s.player;
        if (st.tick <= 0) {
          st.tick = 0.12;
          const dmg = 8;
          NS.Grid.query(p.x, p.y, st.len + 8, NS.Game._q);
          for (let i = 0; i < NS.Game._q.length; i++) {
            const e = NS.Game._q[i];
            if (e.dead) continue;
            const dx = e.x - p.x, dy = e.y - p.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > st.len * st.len) continue;
            for (let b = 0; b < st.beams; b++) {
              const a = st.ang + b * NS.TAU / st.beams;
              const ca = Math.cos(a), sa = Math.sin(a);
              const along = dx * ca + dy * sa;
              if (along < 0) continue;
              const perp = Math.abs(-dx * sa + dy * ca);
              if (perp < st.width / 2 + e.r) {
                NS.Game.damageEnemy(e, dmg, 'prism');
                break;
              }
            }
          }
        }
      },
      drawExtra(s) {
        const st = s.weapons.prism;
        if (!st.beams) return;
        const c = s.ctx;
        const px = s.player.x - s.cam.x, py = s.player.y - s.cam.y;
        for (let b = 0; b < st.beams; b++) {
          const a = st.ang + b * NS.TAU / st.beams;
          c.save();
          c.translate(px, py);
          c.rotate(a);
          const grad = c.createLinearGradient(0, 0, st.len, 0);
          grad.addColorStop(0, 'rgba(186,243,255,0.85)');
          grad.addColorStop(1, 'rgba(186,243,255,0.08)');
          c.fillStyle = grad;
          c.fillRect(0, -st.width / 2, st.len, st.width);
          c.fillStyle = 'rgba(255,255,255,0.6)';
          c.fillRect(0, -0.6, st.len, 1.2);
          c.restore();
        }
      }
    },
    missiles: { name: 'ARMAGEDDON', color: '#ffcf8a',
      desc: 'Six heavy rockets blanket the battlefield in explosions',
      fire(s) {
        const st = s.weapons.missiles;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 1.4;
        for (let i = 0; i < 6; i++) {
          const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 460);
          if (!t) break;
          NS.Game.spawnHoming(s.player.x, s.player.y, t, 220, 60, 'missile', '#ffcf8a', 4, 3.5, 44, s.wid);
        }
        if (true) NS.Audio.tone(440, 0.14, 'sawtooth', 0.08, 0, 800);
      }
    },
    whip: { name: 'VAMPIRE SCOURGE', color: '#ff5e8a',
      desc: 'Twin eternal slashes both sides — every crack drains life',
      mods: {},
      fire(s) {
        const st = s.weapons.whip;
        st.cd = (st.cd || 0) - s.dt;
        if (st.slash) {
          st.slash.t -= s.dt;
          if (st.slash.t <= 0) st.slash = null;
        }
        if (st.cd > 0) return;
        st.cd = 0.55;
        const p = s.player;
        const range = 170, halfW = 160, halfH = 46;
        st.slash = { x: p.x, y: p.y, t: 0.2, side: 0, range, halfW, halfH, both: true };
        NS.Grid.query(p.x, p.y, range, NS.Game._q);
        for (let k = 0; k < NS.Game._q.length; k++) {
          const e = NS.Game._q[k];
          if (e.dead) continue;
          if (Math.abs(e.x - p.x) < halfW && Math.abs(e.y - p.y) < halfH) {
            NS.Game.damageEnemy(e, 55, 'whip');
            NS.Game.healPlayer(1); /* SCOURGE lifesteal */
          }
        }
        NS.Audio.tone(520, 0.1, 'triangle', 0.07, 0, 220);
      },
      drawExtra(s) {
        const st = s.weapons.whip;
        if (!st.slash) return;
        const sl = st.slash;
        const x = s.player.x - s.cam.x, y = s.player.y - s.cam.y;
        const a = sl.t / 0.2;
        for (const side of [-1, 1]) {
          s.ctx.strokeStyle = 'rgba(255,94,138,' + (a * 0.85).toFixed(2) + ')';
          s.ctx.lineWidth = 3.5;
          s.ctx.beginPath();
          s.ctx.arc(x, y, sl.range * 0.62, side > 0 ? -0.85 : Math.PI - 0.85, side > 0 ? 0.85 : Math.PI + 0.85);
          s.ctx.stroke();
          s.ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.45).toFixed(2) + ')';
          s.ctx.lineWidth = 1.4;
          s.ctx.beginPath();
          s.ctx.arc(x, y, sl.range * 0.45, side > 0 ? -0.65 : Math.PI - 0.65, side > 0 ? 0.65 : Math.PI + 0.65);
          s.ctx.stroke();
        }
        s.ctx.lineWidth = 1;
      }
    },
    repel: { name: 'LEVIATHAN WARD', color: '#cdd8ff',
      desc: 'A wider, faster ward that hurls attackers and hurts bosses',
      fire(s) {
        const st = s.weapons.repel;
        st.cd = (st.cd || 0) - s.dt;
        const R = 110;
        st.r = R;
        st.pulse = st.pulse > 0 ? st.pulse - s.dt : 0;
        if (st.cd > 0) return;
        st.cd = 0.85;
        const p = s.player;
        NS.Grid.query(p.x, p.y, R, NS.Game._q);
        let hitAny = false;
        for (let k = 0; k < NS.Game._q.length; k++) {
          const e = NS.Game._q[k];
          if (e.dead) continue;
          if (NS.dist2(p.x, p.y, e.x, e.y) > R * R) continue;
          hitAny = true;
          NS.Game.damageEnemy(e, 44, 'repel');
          if (!e.isBoss) {
            const a = NS.angleTo(p.x, p.y, e.x, e.y);
            const push = 62;
            e.x += Math.cos(a) * push; e.y += Math.sin(a) * push;
          }
        }
        if (hitAny) {
          st.pulse = 0.3;
          NS.Audio.tone(200, 0.15, 'sine', 0.09, 0, 100);
        }
      },
      drawExtra(s) {
        const st = s.weapons.repel;
        if (!st.r) return;
        const x = s.player.x - s.cam.x, y = s.player.y - s.cam.y;
        const a = 0.16 + (st.pulse > 0 ? st.pulse * 2 : 0);
        s.ctx.strokeStyle = 'rgba(205,216,255,' + Math.min(0.75, a).toFixed(2) + ')';
        s.ctx.lineWidth = st.pulse > 0 ? 3 : 1.5;
        s.ctx.beginPath(); s.ctx.arc(x, y, st.r, 0, NS.TAU); s.ctx.stroke();
        s.ctx.strokeStyle = 'rgba(205,216,255,0.18)';
        s.ctx.beginPath(); s.ctx.arc(x, y, st.r * 0.8, 0, NS.TAU); s.ctx.stroke();
        s.ctx.lineWidth = 1;
      }
    },
    rain: { name: 'ASTERION STORM', color: '#fff3b8',
      desc: 'Twin comets, bigger flares, faster orbit — the sky itself fights',
      fire(s) {
        const st = s.weapons.rain;
        st.strikes = st.strikes || [];
        for (let i = st.strikes.length - 1; i >= 0; i--) {
          const k = st.strikes[i];
          k.t -= s.dt;
          if (k.t <= 0) {
            st.strikes.splice(i, 1);
            NS.Grid.query(k.x, k.y, k.r, NS.Game._q);
            for (let j = 0; j < NS.Game._q.length; j++) {
              const e = NS.Game._q[j];
              if (e.dead) continue;
              if (NS.dist2(k.x, k.y, e.x, e.y) < k.r * k.r) NS.Game.damageEnemy(e, k.dmg, 'starfall');
            }
            NS.Game.starFlare(k.x, k.y, k.r);
            NS.Shake.add(2, 0.14);
            NS.Audio.tone(1400, 0.1, 'triangle', 0.08, 0, 300);
            NS.Audio.noise(0.16, 0.08, 900);
          }
        }
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 0.42;
        const L = NS.Enemies.list;
        if (!L.length) return;
        for (let i = 0; i < 3; i++) {
          const t = L[Math.floor(NS.rand.next() * L.length)];
          if (!t || t.dead) continue;
          st.strikes.push({ x: t.x + NS.rand.range(-8, 8), y: t.y + NS.rand.range(-8, 8), t: 0.5, r: 36, dmg: 46 });
        }
      }
    },
    airstrike: { name: 'JUDGEMENT GRID', color: '#e4f6ff',
      desc: 'A full row of twin-beam pillars walks the battlefield',
      fire(s) {
        const st = s.weapons.airstrike;
        st.pillars = st.pillars || [];
        for (let i = st.pillars.length - 1; i >= 0; i--) {
          const q = st.pillars[i];
          q.t -= s.dt;
          if (q.t <= 0) {
            st.pillars.splice(i, 1);
            NS.Grid.query(q.x, q.y, q.r, NS.Game._q);
            for (let j = 0; j < NS.Game._q.length; j++) {
              const e = NS.Game._q[j];
              if (e.dead) continue;
              if (NS.dist2(q.x, q.y, e.x, e.y) < q.r * q.r) NS.Game.damageEnemy(e, q.dmg, 'lance');
            }
            NS.Game.lanceImpact(q.x, q.y, q.r);
            NS.Shake.add(3, 0.2);
            NS.Audio.tone(140, 0.24, 'sawtooth', 0.12, 0, 50);
            NS.Audio.noise(0.22, 0.1, 500);
          }
        }
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 3.0;
        const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 440);
        if (!t) return;
        const n = 8;
        const lineA = NS.rand.range(0, NS.TAU);
        const ca = Math.cos(lineA), sa = Math.sin(lineA);
        const mid = (n - 1) / 2;
        for (let i = 0; i < n; i++) {
          const off = (i - mid) * 46;
          st.pillars.push({ x: t.x + ca * off, y: t.y + sa * off, t: 0.65, r: 38, dmg: 85, ang: lineA });
        }
        NS.Audio.tone(160, 0.3, 'sawtooth', 0.09, 0, 700);
      }
    },
    split: { name: 'HYDRA LANCE', color: '#a8ffbe',
      desc: 'Bolts that fork twice — a swarm of seeking light',
      fire(s) {
        const st = s.weapons.split;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 0.6;
        const shots = 3;
        const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 340);
        const base = t ? NS.angleTo(s.player.x, s.player.y, t.x, t.y) : NS.rand.range(0, NS.TAU);
        for (let i = 0; i < shots; i++) {
          const a = base + (i - 1) * 0.28;
          NS.Game.spawnBullet(s.player.x, s.player.y, a, 320, 18, 'split', '#a8ffbe', 2.8, 1.6,
            { src: s.wid, split: { n: 2 }, splitAt: 0.3 });
        }
        NS.Audio.shoot();
      }
    },
    cluster: { name: 'DOOMSEED', color: '#ffb36b',
      desc: 'Mega bombs that burst into 14 incendiary bomblets',
      fire(s) {
        const st = s.weapons.cluster;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 1.5;
        const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 360);
        const a = t ? NS.angleTo(s.player.x, s.player.y, t.x, t.y) : NS.rand.range(0, NS.TAU);
        NS.Game.spawnBullet(s.player.x, s.player.y, a, 160, 30, 'cluster', '#ffb36b', 4.5, 1.2,
          { src: s.wid, shrap: { n: 14, dmg: 22, spd: 260, life: 0.7, pierce: 2, type: 'shard' } });
        NS.Audio.tone(280, 0.16, 'square', 0.07, 0, 80);
      }
    },
    flak: { name: 'METEOR FLAK', color: '#ffffff',
      desc: 'Twin shells, 10 shards each, bursting nonstop',
      fire(s) {
        const st = s.weapons.flak;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 0.5;
        const t = NS.Game.nearestEnemy(s.player.x, s.player.y, 320);
        const base = t ? NS.angleTo(s.player.x, s.player.y, t.x, t.y) : NS.rand.range(0, NS.TAU);
        for (let i = 0; i < 2; i++) {
          const a = base + (i - 0.5) * 0.2;
          NS.Game.spawnBullet(s.player.x, s.player.y, a, 380, 16, 'flak', '#ffffff', 2.6, 1,
            { src: s.wid, shards: { n: 10, dmg: 12, spd: 210, life: 0.45, pierce: 2 } });
        }
        NS.Audio.shoot();
      }
    },
    lotus: { name: 'BLACK LOTUS', color: '#e68cff',
      desc: 'A perpetual bloom — three petal storms circle the field',
      fire(s) {
        const st = s.weapons.lotus;
        st.storms = st.storms || [];
        if (st.storms.length < 3) {
          st.storms.push({ a: NS.rand.range(0, NS.TAU), r: 0, out: true, hitCd: {} });
        }
        /* advance handled in advance() below via rings reuse */
      },
      advance(s) {
        const st = s.weapons.lotus;
        st.storms = st.storms || [];
        for (const p of st.storms) {
          p.a += s.dt * 3.2;
          p.r += (p.out ? 200 : -200) * s.dt;
          if (p.r > 150) p.out = false;
          if (p.r < 8) { p.out = true; p.hitCd = {}; }
          const px = s.player.x + Math.cos(p.a) * p.r, py = s.player.y + Math.sin(p.a) * p.r;
          p.wx = px; p.wy = py;
          const near = NS.Grid.query(px, py, 16, NS.Game._q);
          for (let k = 0; k < near.length; k++) {
            const e = near[k];
            if (e.dead) continue;
            if (NS.dist2(px, py, e.x, e.y) < (e.r + 9) * (e.r + 9) &&
                s.time - (p.hitCd[e.id] || 0) > 0.22) {
              p.hitCd[e.id] = s.time;
              NS.Game.damageEnemy(e, 34, 'lotus');
            }
          }
        }
      },
      drawExtra(s) {
        const st = s.weapons.lotus;
        if (!st.storms) return;
        const c = s.ctx;
        for (const p of st.storms) {
          if (p.wx === undefined) continue;
          const x = p.wx - s.cam.x, y = p.wy - s.cam.y;
          NS.Glow.draw(c, '#e68cff', x, y, 14, 0.85);
          c.save();
          c.translate(x, y);
          c.rotate(s.time * 15 + p.a);
          c.fillStyle = '#f4d9ff';
          for (let pt = 0; pt < 3; pt++) {
            c.rotate(NS.TAU / 3);
            c.beginPath();
            c.moveTo(0, -8); c.quadraticCurveTo(4, -2, 0, 8); c.quadraticCurveTo(-4, -2, 0, -8);
            c.fill();
          }
          c.restore();
        }
      }
    },
    coil: { name: "THOR'S FIST", color: '#eaffb0',
      desc: 'Storm pods chain heaven-splitting arcs through the whole pack',
      fire(s) {
        const st = s.weapons.coil;
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 2.4;
        st.pods = st.pods || [];
        if (st.pods.length >= 4) st.pods.shift();
        st.pods.push({ x: s.player.x, y: s.player.y, life: 9, t: 0, arcs: [] });
        NS.Audio.tone(260, 0.25, 'square', 0.07, 0, 1000);
      },
      advance(s) {
        const st = s.weapons.coil;
        st.pods = st.pods || [];
        const R = 120;
        st.r = R;
        for (let i = st.pods.length - 1; i >= 0; i--) {
          const pod = st.pods[i];
          pod.life -= s.dt; pod.t += s.dt;
          if (pod.life <= 0) { st.pods.splice(i, 1); continue; }
          if (pod.t >= 0.22) {
            pod.t = 0;
            pod.arcs = [];
            const hitList = [];
            let cur = { x: pod.x, y: pod.y };
            for (let chain = 0; chain < 6; chain++) {
              const next = NS.Game.nearestEnemyTo(cur.x, cur.y, R, hitList);
              if (!next) break;
              hitList.push(next);
              pod.arcs.push({ x: next.x, y: next.y, t: 0.14 });
              NS.Game.damageEnemy(next, 26, 'coil');
              cur = next;
            }
            if (hitList.length) NS.Audio.tone(1700, 0.05, 'sawtooth', 0.04, 0, 500);
          }
          for (const a of pod.arcs) a.t -= s.dt;
          pod.arcs = pod.arcs.filter(a => a.t > 0);
        }
      },
      drawExtra(s) {
        const st = s.weapons.coil;
        if (!st.pods) return;
        const c = s.ctx;
        for (const pod of st.pods) {
          const x = pod.x - s.cam.x, y = pod.y - s.cam.y;
          const blink = pod.life < 1.2 && Math.floor(pod.life * 6) % 2 === 0;
          if (blink) continue;
          NS.Glow.draw(c, '#eaffb0', x, y, 12, 0.85);
          c.fillStyle = '#ffffff';
          c.fillRect(x - 3, y - 3, 6, 6);
          c.strokeStyle = 'rgba(234,255,176,0.35)';
          c.beginPath(); c.arc(x, y, st.r || 120, 0, NS.TAU); c.stroke();
          c.strokeStyle = 'rgba(234,255,176,0.9)';
          c.lineWidth = 2;
          for (const a of pod.arcs) {
            const ax = a.x - s.cam.x, ay = a.y - s.cam.y;
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo((x + ax) / 2 + NS.rand.range(-8, 8), (y + ay) / 2 + NS.rand.range(-8, 8));
            c.lineTo(ax, ay);
            c.stroke();
          }
          c.lineWidth = 1;
        }
      }
    },
    mirage: { name: 'LEGION MIRAGE', color: '#e2baff',
      desc: 'Five afterimages fire as one — you were everywhere',
      fire(s) {
        const st = s.weapons.mirage;
        st.hist = st.hist || [];
        st.hist.push({ t: s.time, x: s.player.x, y: s.player.y });
        while (st.hist.length && st.hist[0].t < s.time - 3.2) st.hist.shift();
        st.ghosts = [];
        for (let i = 0; i < 5; i++) {
          const T = s.time - 0.55 * (i + 1);
          for (let j = st.hist.length - 1; j >= 0; j--) {
            if (st.hist[j].t <= T) { st.ghosts.push(st.hist[j]); break; }
          }
        }
        st.cd = (st.cd || 0) - s.dt;
        if (st.cd > 0) return;
        st.cd = 0.55;
        for (const g of st.ghosts) {
          const t = NS.Game.nearestEnemy(g.x, g.y, 320);
          if (t) NS.Game.spawnBullet(g.x, g.y, NS.angleTo(g.x, g.y, t.x, t.y), 300, 16, 'mirage', '#e2baff', 2.4, 1.5, { src: s.wid });
        }
      },
      drawExtra(s) {
        const st = s.weapons.mirage;
        if (!st.ghosts) return;
        for (const g of st.ghosts) {
          const x = g.x - s.cam.x, y = g.y - s.cam.y;
          NS.Glow.draw(s.ctx, '#e2baff', x, y, 11, 0.35);
          s.ctx.strokeStyle = 'rgba(226,186,255,0.55)';
          s.ctx.lineWidth = 1;
          s.ctx.beginPath();
          s.ctx.moveTo(x, y - 7); s.ctx.lineTo(x + 5, y + 3);
          s.ctx.lineTo(x, y + 7); s.ctx.lineTo(x - 5, y + 3);
          s.ctx.closePath(); s.ctx.stroke();
          s.ctx.lineWidth = 1;
        }
      }
    }
  },

  /* evolution stat scaling (post-evo mastery) */
  masteryMult(st) { return 1 + (st.mastery || 0) * 0.12; },
  masteryCdMult(st) { return Math.max(0.4, 1 - (st.mastery || 0) * 0.05); },

  /* AIM for a weapon with no turret of its own.
     Movement direction while running, else nearest enemy, else last angle.
     The player object has NO aimA field — vx/vy is the real facing source. */
  aimAngle(s, fallback, range) {
    const p = s.player;
    if (p.vx || p.vy) return Math.atan2(p.vy, p.vx);
    const t = NS.Game.nearestEnemy(p.x, p.y, range || 520);
    if (t) return NS.angleTo(p.x, p.y, t.x, t.y);
    return fallback || 0;
  },

  /* effective weapon def: evolution replaces the base weapon wholesale */
  effectiveDef(id, st) {
    if (st && st.evo && this.EVOS[id]) {
      const e = this.EVOS[id];
      return { name: e.name, color: e.color, fire: e.fire, drawExtra: e.drawExtra, isEvo: true };
    }
    return this.DEFS[id];
  },

  evoName(id, st) {
    return (st && st.evo && this.EVOS[id]) ? this.EVOS[id].name : this.DEFS[id].name;
  },

  isLegendary(choice) {
    return choice.type === 'passive' && !!this.PASSIVES[choice.id].legendary;
  },

  isEvo(choice) { return choice.type === 'evo'; },
  isMastery(choice) { return choice.type === 'mastery'; },

  displayName(choice) {
    if (choice.type === 'evo') return this.EVOS[choice.id].name;
    if (choice.type === 'mastery') return this.EVOS[choice.id].name + ' M' + choice.lvl;
    if (choice.type === 'wnew') return this.DEFS[choice.id].name;
    if (choice.type === 'wlevel') return this.DEFS[choice.id].name + ' LV' + choice.lvl;
    return this.PASSIVES[choice.id].name + (this.PASSIVES[choice.id].maxLvl > 1 ? ' LV' + choice.lvl : '');
  },

  displayDesc(choice) {
    if (choice.type === 'evo') return '★ EVOLUTION — ' + this.EVOS[choice.id].desc;
    if (choice.type === 'mastery') return 'MASTERY ' + choice.lvl + '/' + this.MAX_MASTERY + ' — +' +
      Math.round(choice.lvl * 12) + '% damage, -' + Math.round(choice.lvl * 5) + '% cooldown (stats only)';
    if (choice.type === 'wnew') return 'NEW WEAPON — ' + this.DEFS[choice.id].desc;
    if (choice.type === 'wlevel') return 'UPGRADE — ' + this.levelDesc(choice.id, choice.lvl);
    return this.PASSIVES[choice.id].desc;
  },

  levelDesc(id, newLvl) {
    const map = {
      pulse:     ['1 shot', '2 shots', '3 shots', '4 shots', '5 shots', '6 shots', '7 shots', '8-shot fan'],
      blades:    ['1 blade', '2 blades', '3 blades', '4 blades', '5 blades', '6 blades', '6 blades, wide', '6 blades, faster'],
      nova:      ['small ring', 'bigger', 'faster cycle', 'big ring', 'huge ring', 'faster+', 'colossal', 'SUPERNOVA'],
      lightning: ['2 chains', '3 chains', '4 chains', '5 chains', '6 chains', '7 chains', '8 chains', '9 chains'],
      mines:     ['small boom', 'bigger boom', 'faster drop', 'big boom', 'massive boom', 'bigger+', 'faster+', 'MINEFIELD'],
      drone:     ['1 drone', '1 drone, faster', '2 drones', '2 drones, faster', '3 drones', '3 drones, faster', '4 drones', '4 drones, rapid'],
      frost:     ['33% slow', '37% slow', '43% slow', '49% slow', '55% slow', '61% slow', '67% slow', '68% slow, wide'],
      railgun:   ['huge line', 'huge line+', 'faster charge', 'huge line++', 'faster+', 'huge line+++', 'faster++', 'ANNIHILATE'],
      beam:      ['thin sweep', 'longer', 'wider', 'longer+', 'wider+', 'longer++', 'wider++', 'SOLAR FLARE'],
      spike:     ['8 spikes', '10 spikes', '12 spikes', '14 spikes', '16 spikes', '18 spikes', '20 spikes', '22 spikes, fast'],
      tornado:   ['weak pull', 'stronger pull', 'wider', 'stronger+', 'wider+', 'stronger++', 'wider++', 'BLACK HOLE'],
      ghost:     ['1 seeker', '2 seekers', '2 seekers+', '3 seekers', '3 seekers+', '4 seekers', '4 seekers+', '5 seekers'],
      prism:     ['2 lasers', '2 lasers+', '3 lasers', '3 lasers+', '3 lasers++', '4 lasers', '4 lasers+', '4 lasers, faster'],
      missiles:  ['1 rocket', '1 rocket+', '2 rockets', '2 rockets+', '2 rockets++', '3 rockets', '3 rockets+', '3 rockets, rapid'],
      boomerang: ['1 blade', '1 blade+', '2 blades', '2 blades+', '2 blades++', '3 blades', '3 blades+', '3 blades, rapid'],
      saw:       ['3 bounces', '4 bounces', '5 bounces', '6 bounces', '7 bounces', '8 bounces', '9 bounces', '10 bounces'],
      aegis:     ['short wave', 'longer wave', 'faster cycle', 'longer+', 'faster+', 'longer++', 'faster++', 'TSUNAMI'],
      flux:      ['1 orb', '1 orb+', '1 orb++', '2 orbs', '2 orbs+', '2 orbs++', '3 orbs', '3 orbs, rapid'],
      seeker:    ['3 darts', '4 darts', '5 darts', '6 darts', '7 darts', '8 darts', '9 darts', '10 darts, rapid'],
      gpulse:    ['small blast', 'bigger blast', 'faster pulse', 'bigger+', 'faster+', 'bigger++', 'faster++', 'SINGULARITY PULSE'],
      omines:    ['3 mines', '4 mines', '5 mines', '6 mines', '7 mines', '8 mines', '9 mines', 'MINE RING'],
      turret:    ['1 turret', 'stronger shots', 'faster deploy', '2 turrets', 'stronger+', 'faster+', '3 turrets', 'TURRET WALL'],
      whip:      ['1 slash', 'wider slash', 'faster', 'wider+', 'faster+', 'wider++', 'BOTH SIDES', 'TWIN STORM'],
      repel:     ['small push', 'bigger push', 'faster pulse', 'bigger+', 'faster+', 'bigger++', 'faster++', 'REPEL STORM'],
      rain:      ['1 star', '2 stars', 'faster rain', '3 stars', 'bigger', '4 stars', 'faster+', 'STARSTORM'],
      airstrike: ['3 pillars', '4 pillars', 'faster call', '5 pillars', 'harder hit', '6 pillars', 'faster++', 'ORBITAL STORM'],
      split:     ['1 bolt', 'bigger split', 'faster', '2 bolts', 'wider split', 'faster+', '3 bolts', 'SPLIT STORM'],
      cluster:   ['5 bomblets', 'bigger boom', 'faster lob', '6 bomblets', 'bigger+', '7 bomblets', 'faster+', 'MEGA CLUSTER'],
      flak:      ['4 shards', '5 shards', 'faster burst', '6 shards', '2 shells', '7 shards', 'faster+', 'FLAK STORM'],
      mirage:    ['1 echo', 'stronger echo', 'faster echo', '2 echoes', 'stronger+', 'faster+', '3 echoes', 'ECHO STORM'],
      lotus:     ['5 petals', '6 petals', 'faster bloom', '6 petals+', '7 petals', 'wider bloom', '8 petals', 'LOTUS STORM'],
      coil:      ['1 pod', '2 arcs', 'longer life', '3 arcs', 'wider field', '4 arcs', '2 pods', 'STORM GRID']
    };
    return (map[id] && map[id][newLvl - 1]) || 'stronger';
  },

  colorOf(choice) {
    if (choice.type === 'evo') return this.EVOS[choice.id].color;
    if (choice.type === 'mastery') return '#c8f4ff';
    if (choice.type === 'passive') return this.PASSIVES[choice.id].color;
    return this.DEFS[choice.id].color;
  }
};
