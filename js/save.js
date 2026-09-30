'use strict';
/* ============================================================
   NEONSWARM — save.js
   localStorage: best stats, totals, settings. Corruption-safe.
   ============================================================ */

NS.Save = {
  KEY: 'neonswarm_stats_v1',
  SET: 'neonswarm_settings_v1',

  loadSettings() {
    const def = { volume: 0.5, music: true, sfx: true, screenShake: true, reducedMotion: false, showFps: false };
    try {
      const s = JSON.parse(localStorage.getItem(this.SET));
      return Object.assign(def, (s && typeof s === 'object') ? s : {});
    } catch (e) { return def; }
  },

  saveSettings() {
    try { localStorage.setItem(this.SET, JSON.stringify(NS.settings)); } catch (e) { }
  },

  load() {
    const def = {
      runs: 0, totalKills: 0, totalSeconds: 0, totalLevel: 0,
      best: { time: 0, kills: 0, level: 1, bossKills: 0, abyssDepth: 0 },
      wins: 0,
      weaponsUsed: {},
      meteorsSurvived: 0, goblinsCaught: 0
    };
    try {
      const d = JSON.parse(localStorage.getItem(this.KEY));
      if (!d || typeof d !== 'object') return def;
      d.best = Object.assign(def.best, (d.best && typeof d.best === 'object') ? d.best : {});
      d.weaponsUsed = (d.weaponsUsed && typeof d.weaponsUsed === 'object') ? d.weaponsUsed : {};
      ['runs', 'totalKills', 'totalSeconds', 'totalLevel', 'wins'].forEach(k => {
        if (typeof d[k] !== 'number' || !isFinite(d[k])) d[k] = def[k];
      });
      return Object.assign(def, d);
    } catch (e) {
      try { localStorage.removeItem(this.KEY); } catch (e2) { }
      return def;
    }
  },

  write() {
    try { localStorage.setItem(this.KEY, JSON.stringify(NS.stats)); } catch (e) { }
  },

  /* ---------- META PROGRESSION: cores = lifetime power ----------
     Earned from runs, spent implicitly as permanent start bonuses. */
  cores() {
    const s = NS.stats;
    return Math.floor(s.totalKills / 500) + s.wins * 10 + Math.floor(s.best.abyssDepth / 2) + s.best.bossKills;
  },

  /* auto-equipped start bonuses from lifetime cores (cap 3/3/2) */
  metaBonuses() {
    const c = this.cores();
    return {
      hp: Math.min(3, Math.floor(c / 6)),      /* +15 max HP each */
      speed: Math.min(3, Math.floor(c / 10)),  /* +4% speed each */
      startLvl: Math.min(2, Math.floor(c / 25)) /* start at LV2/LV3 */
    };
  },

  /* Rank grade from lifetime records — D up to S+ */
  rank() {
    const b = NS.stats.best;
    let score = 0;
    if (b.time >= 300) score++; if (b.time >= 600) score++; if (b.time >= 900) score++;
    if (b.level >= 15) score++; if (b.level >= 30) score++;
    if (b.kills >= 400) score++; if (b.kills >= 900) score++;
    if (b.bossKills >= 5) score++;
    if (NS.stats.wins >= 1) score++;
    if (b.abyssDepth >= 3) score++;
    const ranks = ['D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S', 'S+'];
    return ranks[Math.min(ranks.length - 1, score)];
  },

  reset() {
    try { localStorage.removeItem(this.KEY); } catch (e) { }
    NS.stats = this.load();
  }
};
