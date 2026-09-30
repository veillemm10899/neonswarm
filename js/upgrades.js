'use strict';
/* ============================================================
   NEONSWARM — upgrades.js
   Level-up draft screen: 3 choices, keyboard (1/2/3) and
   touch/mouse. Legendary choices render gold. Fully maxed builds
   roll a rare OVERCHARGE stat instead of dead-ending.
   Pauses the game while open.
   ============================================================ */

NS.Upgrades = {
  open: false,
  choices: [],

  show() {
    const rolled = NS.Weapons.rollDraft();
    if (!rolled) {
      /* everything maxed: OVERCHARGE — permanent run stat, keeps scaling */
      const st = NS.Game.state;
      st.overcharge = (st.overcharge || 0) + 1;
      const roll = NS.rand.next();
      if (roll < 0.4) { st.dmgMult += 0.08; this.lastOver = '+8% DAMAGE'; }
      else if (roll < 0.7) { st.cdMult *= 0.94; this.lastOver = '-6% COOLDOWNS'; }
      else { NS.Game.player.maxHp += 15; NS.Game.player.hp = Math.min(NS.Game.player.maxHp, NS.Game.player.hp + 15); this.lastOver = '+15 MAX HP'; }
      NS.Player.heal(NS.Game.player, 10);
      NS.UI.toast('MAX POWER — OVERCHARGE: ' + this.lastOver, true);
      NS.Game.pendingLevelUps--;
      return;
    }
    this.choices = rolled;
    this.open = true;
    NS.Game.mode = 'draft';
    /* evo/legendary available = celebrate in the title */
    const hasLeg = rolled.some(c => NS.Weapons.isLegendary(c));
    const hasEvo = rolled.some(c => NS.Weapons.isEvo(c));
    const title = document.getElementById('draft-title');
    if (title) {
      title.textContent = hasEvo ? '★ EVOLUTION AVAILABLE — CHOOSE'
        : (hasLeg ? '★ LEGENDARY AVAILABLE — CHOOSE' : '⬆ LEVEL UP — CHOOSE ONE');
      title.style.color = hasEvo ? '#fff6d8' : (hasLeg ? '#ffd23f' : '');
    }
    this.render();
    document.getElementById('draft').style.display = 'flex';
  },

  render() {
    const wrap = document.getElementById('draft-choices');
    wrap.innerHTML = '';
    this.choices.forEach((c, i) => {
      const color = NS.Weapons.colorOf(c);
      const leg = NS.Weapons.isLegendary(c);
      const evo = NS.Weapons.isEvo(c);
      const mast = NS.Weapons.isMastery(c);
      const b = document.createElement('button');
      b.className = 'draft-card' + (evo ? ' evolution' : (leg ? ' legendary' : ''));
      b.style.setProperty('--c', color);
      let badge = '';
      if (evo) badge = '<span class="dc-evo">★ EVOLUTION</span>';
      else if (mast) badge = '<span class="dc-legend">◈ MASTERY</span>';
      else if (leg) badge = '<span class="dc-legend">★ LEGENDARY</span>';
      b.innerHTML = `
        <div class="dc-head"><span class="dc-num">${i + 1}</span><span class="dc-name">${NS.Weapons.displayName(c)}</span>${badge}</div>
        <div class="dc-desc">${NS.Weapons.displayDesc(c)}</div>
        <div class="dc-type">${evo ? 'EVOLUTION — ONE PER WEAPON' : (mast ? 'MASTERY — STATS ONLY' : (c.type === 'passive' ? (leg ? 'LEGENDARY PASSIVE' : 'PASSIVE') : (c.type === 'wnew' ? 'NEW WEAPON' : 'WEAPON UPGRADE')))}</div>`;
      /* icon node inserted into the head */
      const icon = NS.Icons.node(c.type === 'passive' ? 'p' : 'w', c.id, 30);
      if (icon && b.children[0]) {
        const holder = document.createElement('span');
        holder.className = 'dc-icon';
        holder.appendChild(icon);
        b.children[0].insertBefore(holder, b.children[0].children[1]);
      }
      b.onclick = () => this.pick(i);
      wrap.appendChild(b);
    });
  },

  pick(i) {
    if (!this.open) return;
    const c = this.choices[i];
    if (!c) return;
    NS.Weapons.applyChoice(c);
    this.close();
  },

  close() {
    this.open = false;
    document.getElementById('draft').style.display = 'none';
    NS.Game.mode = 'play';
    NS.Game.pendingLevelUps--;
    /* chain level ups */
    if (NS.Game.pendingLevelUps > 0) {
      setTimeout(() => this.show(), 120);
    }
  },

  /* keyboard shortcuts */
  key(code) {
    if (!this.open) return false;
    if (code === 'Digit1') { this.pick(0); return true; }
    if (code === 'Digit2') { this.pick(1); return true; }
    if (code === 'Digit3') { this.pick(2); return true; }
    return false;
  }
};
