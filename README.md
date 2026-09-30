# NEONSWARM

A neon bullet-heaven roguelite. **You move. Everything else is your build.**

Survive 30 minutes of escalating swarms, draft upgrades every level, kill seven
kinds of MK-scaled bosses — then face **OMEGA PROTOCOL**. Kill it to win…
or step into the **ENDLESS ABYSS** and see how deep you go.

Built with pure HTML5 Canvas + vanilla JS. No build step, no dependencies, no server.

## Play

- **Local:** double-click `index.html`. Works offline.
- **Netlify:** drag this folder onto https://app.netlify.com/drop — done.

## Controls

| Platform | Input |
|---|---|
| PC | WASD / Arrow keys · 1/2/3 to pick upgrades · ESC pause |
| Android | Floating joystick (touch anywhere) · portrait view (hero middle-low) · tap upgrade cards |

Weapons fire automatically. Your only job: **positioning**.

## The Arsenal

**30 weapons (LV 1–8 each, max 6 per run):**
Pulse Cannon · Orbit Blades · Nova Ring · Chain Lightning · Plasma Mines ·
Attack Drone · Cryo Field · Railgun · Solar Beam · Thorn Burst · Vortex ·
Phantom Strike · Prism Array · Swarm Rockets · Seeker Barrage · Gravity Pulse ·
Orbit Mines · Arc Turret · Boomerang · Saw Blade · Aegis Wave · Flux Orb ·
Neon Scourge · Repel Field · Starfall · Orbital Lance · Split Shot ·
Cluster Bomb · Flak Cannon · Mirage Deck

No evolutions — every weapon is complete at LV8 and the draft stays wide all run.

**★ EVOLUTIONS — one per weapon, VS-style:** max a weapon to LV8 + own its
paired passive and the evolution joins the draft (chests guarantee it). Each
one changes how the weapon *plays*: SINGULARITY CANNON · GILDED HALO ·
SUPERNOVA · TEMPEST · MINEFIELD PROTOCOL · WINGMAN ESCORT · ABSOLUTE ZERO ·
LAZARUS · HELIOS · THORNQUEEN · MEPHISTO · SOUL REAVER · JERICHO RAIN ·
EVENT HORIZON · NOVA CROWN · FORTRESS GRID · GUNGNIR · PAIN TRAIN ·
TSUNAMI PROTOCOL · ANNIHILATION ORB · SPECTRAL ARRAY · ARMAGEDDON ·
VAMPIRE SCOURGE · LEVIATHAN WARD · ASTERION STORM · JUDGEMENT GRID ·
HYDRA LANCE · DOOMSEED · METEOR FLAK · LEGION MIRAGE. After evolving,
the weapon offers MASTERY stat picks (cap 8).

**46 passives**, including 4 time-gated LEGENDARIES after 7:00 and
risk/reward picks like GLASS CANNON and SWARM BAIT.

## The Threat

**7 enemy types** on a timeline (drones → reapers), elites with crown pips,
ranged shooters with charge telegraphs, lunging reapers with flash warnings.

**8 bosses every 75s, MK-scaled every 2 kills:**
DEVOURER (charges) → HIVE QUEEN (spawns + bursts) → VOID SENTINEL (spirals) →
STORMBRINGER (telegraphed lightning) → MOTHER CRYSTAL (shield phases) →
THE ARCHITECT (rotating laser) → MOLOCH (bullet walls + shade summoner) →
CHRONOS (TIME-LOCK freezes your weapons).
At **30:00**: OMEGA PROTOCOL — kill it to win.

**8 enemy types** including phase-shifting SHADES that blink toward you.

**Arena hazards:** meteor storms after 4:00. **Treasure goblin** roams mid-run —
catch the fleeing chest for a jackpot. Combo x100 ignites a burning aura.
Powerups: MAGNET, BOMB and ⏱ BULLET TIME (the world crawls — you don't).

## Keep Coming Back

- **CORES**: lifetime kills/wins/depth → permanent start bonuses (auto-equipped)
- **RANK D→S+** on every game-over screen — chase the S+
- **ENDLESS ABYSS**: no floor. Layers deepen. How far can you get?
- Lifetime stats, bests, and settings persist in localStorage

## Brand assets

The tab icon, PWA icons and link-preview card are all generated from code —
the hero ship drawn with the same geometry as the in-game sprite:

```bash
node scripts/make-icons.js
```

Regenerates `favicon.ico`, `favicon-{16,32,48}.png`, `apple-touch-icon.png`,
`icon-{192,512}.png` and `og-image.png`. Zero dependencies (pure Node PNG/ICO encoder).

## Tech notes

- 448×252 landscape / 252×448 portrait auto-orient, pixelated scaling
- Android: `visualViewport` handling (URL-bar safe), fullscreen + orientation
  lock on PLAY, wake lock during runs, safe-area insets, gesture blocking
- Portrait camera: hero horizontal-center, vertically middle-low (62%) so
  incoming swarms read early and thumbs own the bottom
- Spatial hash grid for hundreds of simultaneous enemies
- Pre-rendered glow sprites (radial gradients drawn once, blitted per frame)
- Object pools for bullets/particles/pickups — zero GC pressure in hot loops
- Synthesized SFX + dynamic boss music via Web Audio (no audio files)
- Haptic feedback where supported (guarded)

## Deploy to Netlify

1. Go to https://app.netlify.com/drop
2. Drag the whole `NEONSWARM` folder onto the page
3. Get an instant URL → share it on LinkedIn

`netlify.toml` is included (MIME types + cache headers) but the folder deploys
fine without it. `manifest.json` + icons make it installable as a fullscreen
Android app from the Chrome menu.

## Tests

```bash
bash test/all.sh
```

Five suites: syntax, orientation regression (incl. the middle-low portrait
camera), content (30 weapons / 40 passives), long-run bot sim, and a real
headless-Chromium boot check. All green before every release.

---
*Part of the VEILLEMM arcade. More at the [portfolio](https://veillemm.netlify.app/).*
