'use strict';
/* ============================================================
   NEONSWARM — audio.js
   Web Audio synth SFX. No files, no CDNs. Fails silently.
   ============================================================ */

NS.Audio = {
  ctx: null, master: null, sfx: null, music: null,
  musicTimer: null, step: 0, unlocked: false,
  intense: false, /* boss-active layer: faster tempo + danger notes */

  setIntense(on) {
    if (this.intense === !!on) return;
    this.intense = !!on;
    /* restart the loop at the new tempo */
    if (this.unlocked && NS.settings.music) {
      this.stopMusic();
      this.startMusic();
    }
  },

  init() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = NS.settings.volume;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = 0.5;
      this.music.connect(this.master);
      this.applySettings();
      return true;
    } catch (e) { this.ctx = null; return false; }
  },

  unlock() {
    if (!this.init()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.unlocked = true;
    if (NS.settings.music && !this.musicTimer) this.startMusic();
  },

  applySettings() {
    if (!this.ctx) return;
    this.master.gain.value = NS.settings.volume;
    this.sfx.gain.value = NS.settings.sfx ? 1 : 0;
    this.music.gain.value = NS.settings.music ? 0.5 : 0;
    if (!NS.settings.music) this.stopMusic();
    else if (this.unlocked && !this.musicTimer) this.startMusic();
  },

  tone(freq, dur, type, vol, when, slideTo) {
    if (!this.ctx || !NS.settings.sfx) return;
    try {
      const t = this.ctx.currentTime + (when || 0);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.sfx);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { }
  },

  noise(dur, vol, freq) {
    if (!this.ctx || !NS.settings.sfx) return;
    try {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * Math.max(0.03, dur), this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.08;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq || 900;
      src.connect(f); f.connect(g); g.connect(this.sfx);
      src.start();
    } catch (e) { }
  },

  /* ---- SFX library ---- */
  shoot()   { this.tone(880, 0.05, 'square', 0.025, 0, 440); },
  hit()     { this.noise(0.06, 0.05, 1400); },
  kill()    { this.tone(300, 0.12, 'sawtooth', 0.07, 0, 60); this.noise(0.1, 0.06, 700); },
  hurt()    { this.tone(220, 0.18, 'sawtooth', 0.14, 0, 70); this.noise(0.15, 0.1, 500); this.vibe(60); },
  pickup()  { this.tone(1046, 0.07, 'triangle', 0.09); this.tone(1568, 0.1, 'triangle', 0.08, 0.05); },
  levelup() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.13, 'triangle', 0.12, i * 0.08)); },
  choose()  { this.tone(700, 0.06, 'square', 0.09); this.tone(1050, 0.09, 'square', 0.09, 0.06); },
  click()   { this.tone(600, 0.04, 'square', 0.06); },
  boss()    { this.tone(80, 0.5, 'sawtooth', 0.18); this.tone(110, 0.5, 'square', 0.12, 0.2); },
  chest()   { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.1, i * 0.07)); },
  heal()    { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.09, 'sine', 0.09, i * 0.06)); },
  bombSfx() { this.noise(0.5, 0.22, 300); this.tone(60, 0.6, 'sawtooth', 0.2, 0, 30); this.tone(120, 0.3, 'square', 0.12, 0.05, 40); },
  powerup() { [880, 1175, 1568, 2093].forEach((f, i) => this.tone(f, 0.08, 'square', 0.08, i * 0.05)); },
  die()     { this.sweep(400, 40); this.vibe([80, 40, 120]); },
  vibe(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { } },
  sweep(f1, f2) { this.tone(f1, 0.7, 'sawtooth', 0.14, 0, f2); },
  victory() { [523, 659, 784, 1046, 1319].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.12, i * 0.11)); },

  /* ---- Dark synthwave loop: bass pulse + arp (+ danger layer on boss) ---- */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.step = 0;
    const bass = [0, 0, 3, 0, 5, 0, 3, 0];
    const arp = [12, 15, 19, 15, 12, 15, 19, 22];
    const root = 110;
    const bpmMs = this.intense ? 190 : 300; /* boss = urgency */
    const stepFn = () => {
      if (!NS.settings.music) { this.stopMusic(); return; }
      try {
        const t = this.ctx.currentTime;
        const s = this.step % 8;
        /* bass pulse every step */
        const bo = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        bo.type = 'sawtooth';
        bo.frequency.value = root * Math.pow(2, (bass[s] + (this.intense ? -12 : 0)) / 12);
        bg.gain.setValueAtTime(this.intense ? 0.09 : 0.06, t);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        bo.connect(bg); bg.connect(this.music);
        bo.start(t); bo.stop(t + 0.25);
        /* arp on every other step */
        if (s % 2 === 0) {
          const ao = this.ctx.createOscillator();
          const ag = this.ctx.createGain();
          ao.type = this.intense ? 'square' : 'triangle';
          ao.frequency.value = root * Math.pow(2, arp[(this.step / 2 | 0) % 8] / 12);
          ag.gain.setValueAtTime(0.0001, t);
          ag.gain.linearRampToValueAtTime(this.intense ? 0.06 : 0.05, t + 0.02);
          ag.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          ao.connect(ag); ag.connect(this.music);
          ao.start(t); ao.stop(t + 0.35);
        }
        /* danger tick: offbeat alarm while a boss is live */
        if (this.intense && s % 4 === 2) {
          const do_ = this.ctx.createOscillator();
          const dg = this.ctx.createGain();
          do_.type = 'square';
          do_.frequency.value = 660;
          dg.gain.setValueAtTime(0.0001, t);
          dg.gain.linearRampToValueAtTime(0.03, t + 0.01);
          dg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          do_.connect(dg); dg.connect(this.music);
          do_.start(t); do_.stop(t + 0.14);
        }
      } catch (e) { }
      this.step++;
    };
    stepFn();
    this.musicTimer = setInterval(stepFn, bpmMs);
  },

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
};
