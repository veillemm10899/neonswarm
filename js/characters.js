'use strict';
/* ============================================================
   NEONSWARM — characters.js
   Pilot select: 4 ships, each with a starting weapon + innate
   quirk. Data-driven; game.newRun applies the mods.
   ============================================================ */

NS.Characters = {
  LIST: [
    {
      id: 'vanguard', name: 'VANGUARD', weapon: 'pulse', color: '#5ef2ff',
      desc: 'Balanced strike craft. +10% damage.',
      apply(st) { st.flat.dmg += 0.10; }
    },
    {
      id: 'rampart', name: 'RAMPART', weapon: 'blades', color: '#ffd23f',
      desc: 'Heavy hull. +30 max HP, +1 armor, 20% slower.',
      apply(st, p) { p.maxHp += 30; p.hp += 30; p.armor += 1; p.speed *= 0.8; }
    },
    {
      id: 'wraith', name: 'WRAITH', weapon: 'ghost', color: '#c77dff',
      desc: 'Fast interceptor. +18% speed, +10% crit, -15 max HP.',
      apply(st, p) { p.speed *= 1.18; st.flat.crit += 0.10; p.maxHp -= 15; p.hp = Math.min(p.hp, p.maxHp); }
    },
    {
      id: 'scavenger', name: 'SCAVENGER', weapon: 'missiles', color: '#ffb14f',
      desc: 'Salvage specialist. +25% XP, goblins appear more often.',
      apply(st) { st.flat.xp += 1.25; NS.Pickups.goblinRate = 0.6; }
    }
  ],

  selected: 0, /* index into LIST, persisted via NS.stats.lastChar */

  select(i) {
    this.selected = (i + this.LIST.length) % this.LIST.length;
    NS.stats.lastChar = this.selected;
    NS.Save.write();
    NS.Audio.click();
  },

  current() { return this.LIST[this.selected]; }
};
