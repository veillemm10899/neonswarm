'use strict';
/* ============================================================
   NEONSWARM — main.js
   Bootstrap, responsive canvas (auto-orient: portrait fills the
   screen on phones like Vampire Survivors), menu wiring, loop.
   ============================================================ */

(function () {
  NS.settings = NS.Save.loadSettings();
  NS.stats = NS.Save.load();
  NS.Mobile = { isTouch: false }; /* set properly by Input.init */

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  NS.ctx = ctx;

  /* ---------- Auto-orient virtual resolution ---------- */
  /* Landscape: 448x252. Portrait (phones): 252x448 — zoomed OUT
     from the old 320x180 so the playfield breathes. */
  NS.VIEW_W = 448; NS.VIEW_H = 252;
  NS.portrait = false;

  /* Visual viewport = what the user actually sees. On modern Android Chrome
     innerWidth/Height lies (stable layout viewport) while URL-bar show/hide
     resizes the visual viewport — listen to visualViewport or the canvas
     letterboxes / the joystick lands under the address bar. */
  function viewSize() {
    if (window.visualViewport) {
      return { w: window.visualViewport.width, h: window.visualViewport.height };
    }
    return { w: window.innerWidth, h: window.innerHeight };
  }
  NS.viewSize = viewSize;

  function setOrientation() {
    const v = viewSize();
    const vw = v.w, vh = v.h;
    const wantPortrait = NS.Mobile.isTouch && vh > vw * 1.05;
    if (wantPortrait !== NS.portrait) {
      NS.portrait = wantPortrait;
      if (wantPortrait) { NS.VIEW_W = 252; NS.VIEW_H = 448; }
      else { NS.VIEW_W = 448; NS.VIEW_H = 252; }
      /* mid-run flip: snap the camera so the player never appears off-center */
      if (NS.Game && NS.Game.snapCamera) NS.Game.snapCamera();
    }
    /* The backing store must ALWAYS track the virtual resolution. Skipping this
       when the orientation is unchanged leaves the canvas at the stale
       index.html default (320x180) while the game renders a 448x252 view — the
       world gets cropped and the player draws off-center. Never skip it. */
    if (canvas.width !== NS.VIEW_W) canvas.width = NS.VIEW_W;
    if (canvas.height !== NS.VIEW_H) canvas.height = NS.VIEW_H;
  }

  NS.Input.init(canvas);
  NS.Mobile.isTouch = NS.Input.isTouch;
  setOrientation();
  NS.UI.init();
  NS.Audio.init();
  NS.Game.makeStars(); /* menu bg alive from frame one */
  /* mobile devices start one quality notch down (battery + thermals) */
  if (NS.Mobile.isTouch) { NS.Quality.level = 1; NS.Particles.MAX = NS.Quality.particleMax(); }

  /* ---------- Responsive scaling (crisp pixels) ----------
     Centering is owned by the CSS fixed #app shell (flex). JS only sizes
     the wrap. The old transform-translate recentering fought the URL bar
     and left the canvas off-center whenever fullscreen was NOT active. */
  function resize() {
    setOrientation();
    const wrap = document.getElementById('game-wrap');
    const v = viewSize();
    const vw = v.w, vh = v.h;
    const scale = Math.min(vw / NS.VIEW_W, vh / NS.VIEW_H);
    /* small sub-pixel steps instead of coarse 0.5 quantization — removes
       the letterbox jitter when Android resizes between 0.5 steps */
    const s = scale >= 2 ? Math.round(scale * 8) / 8 : scale;
    wrap.style.width = Math.floor(NS.VIEW_W * s) + 'px';
    wrap.style.height = Math.floor(NS.VIEW_H * s) + 'px';
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resize);
    window.visualViewport.addEventListener('scroll', resize);
  }
  resize();

  /* ---------- Menu wiring ---------- */
  function wire(id, fn) {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', () => { NS.Audio.unlock(); NS.Audio.click(); fn(); });
  }
  wire('btn-play', () => NS.UI.showCharSelect());
  wire('btn-endless', () => NS.UI.showCharSelect(true));
  wire('btn-char-back', () => NS.UI.showMenu());
  wire('btn-char-go', () => {
    NS.UI.hideAll();
    goFullscreen(); /* immersive: hides URL bar + nav gestures on Android */
    lockLandscape();
    setOrientation(); resize(); /* late-layout Android safety */
    NS.Game.newRun(!!NS.UI.charEndless);
  });
  /* re-sync view size when the browser enters/exits fullscreen — the
     resize event alone misses the window dimension swap on some devices */
  document.addEventListener('fullscreenchange', () => setTimeout(resize, 60));
  wire('btn-stats', () => NS.UI.showStats());
  wire('btn-settings', () => NS.UI.showSettings('menu'));
  /* portfolio buttons are real <a> tags in HTML (file:// safe) —
     just add a click sound on top */
  wire('btn-portfolio', () => { NS.Audio.unlock(); NS.Audio.click(); });
  wire('btn-stats-back', () => NS.UI.showMenu());
  wire('btn-set-back', () => NS.UI.back());
  wire('btn-resume', () => { NS.Game.mode = 'play'; NS.UI.hidePause(); });
  wire('btn-pause-settings', () => NS.UI.showSettings('pause'));
  wire('btn-quit', () => {
    NS.Game.finishRun(false);
  });
  wire('btn-again', () => { NS.UI.hideAll(); NS.Game.newRun(NS.Game.state && NS.Game.state.endless); });
  wire('btn-abyss-again', () => { NS.UI.hideAll(); NS.Game.newRun(true); });
  /* wake lock: keep the phone screen on while playing (mobile-ready) */
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (e) { /* unsupported — fine */ }
  }
  const _newRun = NS.Game.newRun.bind(NS.Game);
  NS.Game.newRun = function (endless) { keepAwake(true); return _newRun(endless); };
  const _finish = NS.Game.finishRun.bind(NS.Game);
  NS.Game.finishRun = function (won) { keepAwake(false); return _finish(won); };
  wire('btn-over-menu', () => NS.UI.showMenu());
  wire('btn-over-portfolio', () => { NS.Audio.unlock(); NS.Audio.click(); });

  /* pause touch buttons (HUD chip + dedicated controller button) */
  ['btn-touch-pause', 'btn-m-pause'].forEach(id => {
    const pauseBtn = document.getElementById(id);
    if (!pauseBtn) return;
    pauseBtn.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (NS.Game.mode === 'play') { NS.Game.mode = 'paused'; NS.UI.showPause(); }
    }, { passive: false });
    pauseBtn.addEventListener('click', () => {
      if (NS.Game.mode === 'play') { NS.Game.mode = 'paused'; NS.UI.showPause(); }
    });
  });

  /* ---------- Keyboard ---------- */
  window.addEventListener('keydown', (e) => {
    if (NS.Upgrades.key(e.code)) return;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (NS.Game.mode === 'play') { NS.Game.mode = 'paused'; NS.UI.showPause(); }
      else if (NS.Game.mode === 'paused') { NS.Game.mode = 'play'; NS.UI.hidePause(); }
    }
  });

  /* pause when tab hidden; re-orient on return (address-bar shifts) */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && NS.Game.mode === 'play') {
      NS.Game.mode = 'paused';
      NS.UI.showPause();
      NS.Save.write();
    } else if (!document.hidden) {
      setOrientation(); resize();
      if (NS.Game.mode === 'paused' || NS.Game.mode === 'play') NS.Game.snapCamera();
    }
  });

  /* ---------- Android fullscreen + orientation lock ----------
     Requesting fullscreen inside the PLAY tap is the user gesture the
     browser wants; on modern Chrome it hides the URL bar and (when the
     device supports it) locks landscape so portrait never squeezes the
     playfield mid-run. Failures are silent — the game is fully playable
     without either. */
  async function goFullscreen() {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' });
      }
    } catch (e) { /* denied/unsupported — fine */ }
  }
  async function lockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (e) { /* unsupported/denied — portrait path still works */ }
  }

  /* ---------- Main loop ----------
     Hardened: any thrown error is logged once and the loop keeps
     running — a render glitch must never blank the game. */
  let last = performance.now();
  let errStreak = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      NS.Game.update(dt);
      NS.Game.render();
      if (NS.Game.state && NS.Game.mode !== 'menu') NS.UI.updateHUD();
      if (NS.settings.showFps) {
        NS.ctx.fillStyle = '#7dff9a';
        NS.ctx.font = '8px monospace';
        NS.ctx.fillText(NS.FPS.val + ' FPS', NS.VIEW_W - 44, 10);
      }
      if (errStreak > 0) errStreak = 0;
    } catch (err) {
      errStreak++;
      if (errStreak <= 3) console.error('[NEONSWARM] frame error:', err);
    }
    NS.Input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  NS.UI.showMenu();
})();
