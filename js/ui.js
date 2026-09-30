'use strict';
/* ============================================================
   NEONSWARM — ui.js
   HUD (time/kills/level/HP), menus, pause, game-over/victory
   with stats + PORTFOLIO button, settings.
   ============================================================ */

NS.UI = {
  el: {},

  init() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $('hud'), time: $('hud-time'), kills: $('hud-kills'),
      level: $('hud-level'), hpFill: $('hp-fill'), hpText: $('hp-text'),
      bossFill: null,
      menu: $('menu'), pause: $('pause'), over: $('gameover'),
      overTitle: $('over-title'), overStats: $('over-stats'),
      stats: $('stats-screen'), settings: $('settings-screen'),
      toasts: $('toasts'), draft: $('draft'), charscreen: $('charscreen'),
      charGrid: $('char-grid'),
      loadout: $('loadout'), loadoutWeapons: $('loadout-weapons'), loadoutPassives: $('loadout-passives')
    };
    this.loadoutSig = '';
    this.applySettings();
  },

  /* ---------- VS-style loadout bar (icons, redrawn on change) ---------- */
  updateLoadout() {
    const s = NS.Game.state;
    if (!s || !this.el.loadoutWeapons) return;
    const W = NS.Weapons;
    const wIds = Object.keys(s.weapons);
    const pIds = Object.keys(s.passives);
    /* evo-ready: any maxed un-evolved weapon whose paired passive is owned */
    const evoReady = wIds.some(id => {
      const w = s.weapons[id];
      return w && !w.evo && w.lvl >= W.DEFS[id].maxLvl &&
             (s.passives[W.EVO_PAIR[id]] || 0) > 0;
    });
    const sig = (evoReady ? 'EVO!' : '') +
      wIds.map(id => id + s.weapons[id].lvl + (s.weapons[id].evo ? 'E' + (s.weapons[id].mastery || 0) : '')).join(',') +
      '|' + pIds.map(id => id + s.passives[id]).join(',');
    if (sig === this.loadoutSig) {
      /* still update the evo-ready glow class every frame (cheap toggle) */
      if (this.el.loadout) this.el.loadout.classList.toggle('evo-ready', evoReady);
      return; /* redraw only on change */
    }
    this.loadoutSig = sig;
    if (this.el.loadout) this.el.loadout.classList.toggle('evo-ready', evoReady);

    const mk = (kind, id, lvl, maxLvl, evo) => {
      const cell = document.createElement('div');
      cell.className = 'lo-cell' + (evo ? ' evo' : '');
      cell.style.setProperty('--c', kind === 'w' ? (W.DEFS[id] ? W.DEFS[id].color : '#fff') : (W.PASSIVES[id] ? W.PASSIVES[id].color : '#fff'));
      const icon = NS.Icons.node(kind, id, 24);
      if (icon) cell.appendChild(icon);
      /* level pips (max 8) */
      if (maxLvl > 1) {
        const pips = document.createElement('div');
        pips.className = 'lo-pips';
        const shown = Math.min(8, maxLvl);
        for (let i = 0; i < shown; i++) {
          const d = document.createElement('i');
          if (i < Math.min(lvl, 8)) d.className = 'on';
          pips.appendChild(d);
        }
        cell.appendChild(pips);
      }
      if (evo) {
        const star = document.createElement('div');
        star.className = 'lo-star';
        star.textContent = '★';
        cell.appendChild(star);
      }
      return cell;
    };

    const wWrap = this.el.loadoutWeapons;
    wWrap.innerHTML = '';
    for (const id of wIds) {
      const st = s.weapons[id];
      wWrap.appendChild(mk('w', id, st.evo ? (st.mastery || 0) : st.lvl, st.evo ? W.MAX_MASTERY : W.DEFS[id].maxLvl, !!st.evo));
    }
    /* empty weapon slots as dashes */
    for (let i = wIds.length; i < W.MAX_WEAPONS; i++) {
      const e = document.createElement('div');
      e.className = 'lo-empty';
      wWrap.appendChild(e);
    }
    /* FULL marker when weapon slots maxed */
    if (wIds.length >= W.MAX_WEAPONS) {
      const f = document.createElement('div');
      f.className = 'lo-full';
      f.textContent = 'MAX';
      wWrap.appendChild(f);
    }

    const pWrap = this.el.loadoutPassives;
    pWrap.innerHTML = '';
    for (const id of pIds) {
      pWrap.appendChild(mk('p', id, s.passives[id], W.PASSIVES[id].maxLvl, false));
    }
    if (pIds.length >= W.MAX_PASSIVES) {
      const f = document.createElement('div');
      f.className = 'lo-full';
      f.textContent = 'MAX';
      pWrap.appendChild(f);
    }
  },

  /* ---------- HUD ---------- */
  updateHUD() {
    const p = NS.Game.player, s = NS.Game.state;
    if (!p || !s) return;
    const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
    this.el.time.textContent = m + ':' + String(sec).padStart(2, '0');
    this.el.kills.textContent = '☠ ' + s.kills;
    this.el.level.textContent = 'LV ' + p.level;
    const pct = NS.clamp(p.hp / p.maxHp, 0, 1) * 100;
    this.el.hpFill.style.width = pct + '%';
    this.el.hpFill.style.background = pct < 30 ? '#ff5e6c' : (pct < 60 ? '#ffd23f' : '#7dff9a');
    this.el.hpText.textContent = Math.ceil(p.hp) + '/' + p.maxHp;
    /* combo streak readout */
    const combo = NS.Game.combo;
    const elC = document.getElementById('hud-combo');
    if (elC) {
      if (combo >= 5) {
        elC.style.display = 'block';
        elC.textContent = 'x' + combo + ' COMBO';
        elC.style.color = combo >= 100 ? '#ffd23f' : (combo >= 50 ? '#ff4fa3' : '#5ef2ff');
        elC.style.transform = 'scale(' + (1 + Math.min(0.35, combo / 300)) + ')';
      } else elC.style.display = 'none';
    }
    this.updateLoadout();
  },

  toast(msg, long) {
    if (!this.el.toasts) return;
    const t = document.createElement('div');
    t.className = 'toast' + (long ? ' toast-long' : '');
    t.textContent = msg;
    this.el.toasts.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 350);
    }, long ? 3500 : 2200);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
  },

  /* ---------- Screens ---------- */
  showMenu() {
    this.hideAll();
    this.el.menu.style.display = 'flex';
    document.getElementById('best-line').textContent = this.bestLine();
  },

  /* ---------- Character select ---------- */
  showCharSelect(endless) {
    this.charEndless = !!endless;
    this.hideAll();
    this.el.charscreen.style.display = 'flex';
    const grid = this.el.charGrid;
    grid.innerHTML = '';
    NS.Characters.LIST.forEach((ch, i) => {
      const card = document.createElement('button');
      card.className = 'char-card' + (i === NS.Characters.selected ? ' sel' : '');
      card.style.setProperty('--c', ch.color);
      card.innerHTML = `
        <div class="char-name">${ch.name}</div>
        <div class="char-desc">${ch.desc}</div>
        <div class="char-weapon">START: ${NS.Weapons.DEFS[ch.weapon].name}</div>`;
      /* hero ship preview icon (tinted diamond) */
      const cv = document.createElement('canvas');
      cv.width = 40; cv.height = 40;
      const g = cv.getContext('2d');
      g.translate(20, 20);
      g.fillStyle = ch.color;
      g.beginPath();
      g.moveTo(0, -13); g.lineTo(9, 6); g.lineTo(0, 12); g.lineTo(-9, 6);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.moveTo(0, -9); g.lineTo(4, 3); g.lineTo(0, 8); g.lineTo(-4, 3);
      g.closePath(); g.fill();
      g.fillStyle = ch.color;
      g.fillRect(-2, -3, 4, 6);
      card.insertBefore(cv, card.children[1]);
      card.onclick = () => {
        NS.Characters.select(i);
        grid.querySelectorAll('.char-card').forEach((c2, j) => c2.classList.toggle('sel', j === i));
      };
      grid.appendChild(card);
    });
  },

  showGameOver(won) {
    this.hideAll();
    this.el.over.style.display = 'flex';
    this.el.overTitle.textContent = won ? '★ OMEGA PROTOCOL DESTROYED ★' : 'YOU DIED';
    this.el.overTitle.style.color = won ? '#ffd23f' : '#ff5e6c';
    const s = NS.Game.state;
    const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
    const ws = Object.keys(s.weapons).map(id => {
      const w = s.weapons[id];
      return (w.evo ? NS.Weapons.evoName(id, w) + (w.mastery ? ' M' + w.mastery : '')
                    : NS.Weapons.DEFS[id].name + ' LV' + w.lvl);
    });
    const ps = Object.keys(s.passives).map(id => NS.Weapons.PASSIVES[id].name + ' LV' + s.passives[id]);
    const rank = NS.Game.lastRank || NS.Save.rank();
    this.el.overStats.innerHTML = `
      <div class="ov-rank rank-${rank.replace('+', 'p')}">RANK <b>${rank}</b></div>
      <div class="ov-row big"><span>SURVIVED</span><b>${m}:${String(sec).padStart(2, '0')}</b></div>
      <div class="ov-row"><span>Kills</span><b>${s.kills}</b></div>
      <div class="ov-row"><span>Level</span><b>${NS.Game.player.level}</b></div>
      <div class="ov-row"><span>Bosses slain</span><b>${s.bossKills}</b></div>
      ${s.finals ? `<div class="ov-row"><span>Evolutions</span><b>${s.finals}</b></div>` : ''}
      ${s.abyssDepth ? `<div class="ov-row"><span>Abyss layer</span><b>${s.abyssDepth}</b></div>` : ''}
      <div class="ov-row"><span>CORES (lifetime)</span><b>${NS.Game.lastCores || NS.Save.cores()}</b></div>
      <div class="ov-row"><span>Time best</span><b>${this.fmtTime(NS.stats.best.time)}</b></div>
      ${ws.length ? `<div class="ov-loadout">${ws.join(' · ')}</div>` : ''}
      ${ps.length ? `<div class="ov-loadout dim">${ps.join(' · ')}</div>` : ''}`;
    if (won) NS.Save.write();
  },

  fmtTime(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  },

  bestLine() {
    const b = NS.stats.best;
    return `BEST — ${this.fmtTime(b.time)} · ${b.kills} kills · LV ${b.level}`;
  },

  showStats() {
    this.hideAll();
    this.el.stats.style.display = 'flex';
    const mb = NS.Save.metaBonuses();
    document.getElementById('stats-body').innerHTML = `
      <div class="ov-rank rank-${NS.Save.rank().replace('+', 'p')}">RANK <b>${NS.Save.rank()}</b></div>
      <div class="ov-row"><span>CORES</span><b>${NS.Save.cores()}</b></div>
      <div class="ov-row"><span>Start bonuses</span><b>+${mb.hp * 15} HP · +${mb.speed * 4}% SPD · LV${1 + mb.startLvl} start</b></div>
      <div class="ov-row"><span>Runs</span><b>${NS.stats.runs}</b></div>
      <div class="ov-row"><span>Total kills</span><b>${NS.stats.totalKills}</b></div>
      <div class="ov-row"><span>Total time</span><b>${this.fmtTime(NS.stats.totalSeconds)}</b></div>
      <div class="ov-row"><span>OMEGA wins</span><b>${NS.stats.wins}</b></div>
      <div class="ov-row"><span>Best time</span><b>${this.fmtTime(NS.stats.best.time)}</b></div>
      <div class="ov-row"><span>Best kills</span><b>${NS.stats.best.kills}</b></div>
      <div class="ov-row"><span>Best level</span><b>${NS.stats.best.level}</b></div>
      <div class="ov-row"><span>Best abyss layer</span><b>${NS.stats.best.abyssDepth || 0}</b></div>`;
  },

  showSettings(from) {
    this.settingsFrom = from;
    this.hideAll();
    this.el.settings.style.display = 'flex';
    this.renderSettings();
  },

  renderSettings() {
    const s = NS.settings;
    const row = (label, val, action) =>
      `<div class="set-row"><span>${label}</span><button data-a="${action}" class="set-btn">${val}</button></div>`;
    document.getElementById('settings-body').innerHTML = `
      ${row('MUSIC', s.music ? 'ON' : 'OFF', 'music')}
      ${row('SOUND FX', s.sfx ? 'ON' : 'OFF', 'sfx')}
      ${row('SCREEN SHAKE', s.screenShake ? 'ON' : 'OFF', 'shake')}
      ${row('SHOW FPS', s.showFps ? 'ON' : 'OFF', 'fps')}
      <button id="set-reset" class="set-btn danger">RESET ALL STATS</button>`;
    document.querySelectorAll('#settings-body [data-a]').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.a;
        if (a === 'music') s.music = !s.music;
        if (a === 'sfx') s.sfx = !s.sfx;
        if (a === 'shake') s.screenShake = !s.screenShake;
        if (a === 'fps') s.showFps = !s.showFps;
        NS.Audio.applySettings();
        NS.Save.saveSettings();
        NS.Audio.click();
        this.renderSettings();
      };
    });
    const r = document.getElementById('set-reset');
    r.onclick = () => {
      if (r.dataset.confirm) {
        NS.Save.reset();
        this.toast('Stats wiped.');
        this.back();
      } else {
        r.dataset.confirm = '1';
        r.textContent = 'TAP AGAIN TO CONFIRM';
        setTimeout(() => { r.dataset.confirm = ''; r.textContent = 'RESET ALL STATS'; }, 2500);
      }
    };
  },

  showPause() { this.el.pause.style.display = 'flex'; },
  hidePause() { this.el.pause.style.display = 'none'; },

  hideAll() {
    ['menu', 'pause', 'over', 'stats-screen', 'settings-screen', 'draft', 'charscreen'].forEach(k => {
      const e = this.el[k] || document.getElementById(k);
      if (e) e.style.display = 'none';
    });
  },

  back() {
    if (this.settingsFrom === 'pause') {
      this.el.settings.style.display = 'none';
      this.showPause();
    } else {
      this.showMenu();
    }
  },

  applySettings() {
    document.body.classList.toggle('reduced-motion', NS.settings.reducedMotion);
  }
};
