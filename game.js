'use strict';
/* ============================================================================
   CATQUEST — Dex the Cat and the Star Portal
   ----------------------------------------------------------------------------
   Sections in this file:
     1. Config & TUNING            8. Game state, player, particles
     2. Power-up definitions       9. Update (physics, enemies, powers)
     3. DOM handles               10. Rendering (parallax, sprites, fx)
     4. Save data (localStorage)  11. Zap / maths / respawn flow
     5. Audio (Web Audio synth)   12. Treehouse hub
     6. Input (keyboard + touch)  13. Victory & progression
     7. Maths quiz engine         14. UI wiring, debug panel, main loop
        + Level data
   ============================================================================ */

/* ---------------------------------------------------------------- 1. CONFIG */
// Turn on the developer panel either by setting this to true, or by opening
// the game with  index.html?debug=1
const DEBUG_MODE = /[?&]debug=1/.test(location.search) || false;

// Every difficulty knob lives here — adjust after real child play-testing.
const TUNING = {
  player: {
    runSpeed: 260,          // px/s
    accel: 2600, decel: 3000, airAccel: 1700,
    jumpVel: 760,           // initial jump velocity (px/s)
    jumpCutVel: 280,        // upward speed clamp when jump is released early
    gravity: 2200, maxFall: 900,
    coyoteMs: 130, jumpBufferMs: 150,
    spawnProtectionMs: 2000,
    width: 30, height: 42,
    // Dex survives one hit: he shrinks instead of being zapped, and the next
    // hit zaps him. Respawning or reaching a checkpoint makes him big again.
    smallScale: 0.7,
    shrinkInvulnMs: 1600,   // grace right after shrinking, so one hit ≠ two
    // Vine swinging. Jump grabs, jump lets go. The boost on grab is what makes
    // the swing carry regardless of how fast Dex arrived — without it a slow
    // approach gives a feeble arc and the gap becomes luck.
    vineGravity: 1500,      // pendulum gravity (not the player's own)
    vineGrabBoost: 1.6,     // rad/s added on grab, in the direction of travel
    vineMaxAngle: 1.25,     // radians either side of straight down
    vineReleaseBoost: 200,  // extra upward kick when you let go, px/s
    // Crystal geodes are CATAPULTS, not trampolines. Touch one and Dex is
    // thrown up and OUT on a long arc — about three seconds aloft and some
    // 1,900px down the canyon.
    //
    // Flight needs its own gravity, and this is why: three seconds of hang
    // time under the normal 2200 would demand a 2,475px apex — over four
    // screens above the canyon floor, with Dex invisible for most of it. At
    // 300 the same three seconds peak around 337px, which sits comfortably on
    // screen. The low gravity IS the flying feeling, not a fudge.
    catapultVx: 620,        // forward speed of the arc, px/s (2.4x his run)
    catapultVy: 450,        // upward kick, px/s → 1.5s up, 1.5s down
    catapultGravity: 300,   // flight gravity: ~3.0s aloft, ~337px apex
    // Steering. Three seconds with nothing to do is a cutscene, not a
    // mechanic, so she can lean the arc — but never enough to turn round, and
    // never further than a landing zone built for the full range.
    catapultSteer: 260,     // px/s² of lean
    catapultVxMin: 480, catapultVxMax: 760,
    padNoCutS: 0.5,         // how long the launch is immune to the jump cut
    vineGrabRadius: 54,     // how near the vine's end you must be to catch it
    vineMinHoldS: 0.14,     // can't let go on the same press that grabbed
    vineCooldownS: 0.30,    // and can't re-grab immediately after letting go
    // The slide. Dex goes down the storm drain on his backside: one button,
    // and it means two different things — jump OVER the lumps, and DON'T jump
    // under the low pipes. Speed comes from the gradient, so the chute's dips
    // and rises are the pacing.
    slideStartSpeed: 210,   // px/s the moment he sets off
    slideGravity: 1450,     // how hard the gradient pulls him along
    slideDrag: 2.2,         // air resistance; sets the top speed on a drop
    slideMin: 170, slideMax: 460,
    slideJumpVel: 660,      // a shorter hop than his normal jump — he's sitting
  },
  // King Ratthew. Three crown hits, and each phase asks for a different one of
  // the four things the game has taught: bouncing, swinging, timing, climbing.
  boss: {
    w: 250, h: 190,
    crownW: 130, crownH: 34,
    ratEveryS: 2.4,         // phase 1: how often he flings a rat at you
    maxRats: 2,             // …but never more than this on the floor at once
    ratsToStun: 3,          // cure this many and he doubles over laughing
    stunS: 3.8,             // …for this long, which is your window
    poundEveryS: 3.0,       // phase 3: floor pounds, head down after each
    poundHeadDownS: 2.6,
    waveSpeed: 240,         // the shockwave a pound sends along the floor
    // Knocked off his own crown. Standing on his head was three free hits —
    // he never shook her off, so there was no reason to ever get down. This
    // pulse throws Dex clear and CANNOT hurt him: the fight should be won by
    // reading the rock and the beams, not by camping on his hat.
    crownPulseVx: 520,      // thrown this far sideways…
    crownPulseVy: 620,      // …and this high, which clears his 250px width
    crownPulseInvulnS: 1.1, // and nothing may touch Dex on the way down
    // The Gamma Crown lets him fire green beams out of his eyes. Sometimes he
    // aims at Dex, sometimes at the ceiling — which brings the roof down.
    laserEveryS: 1.84,      // how often he tries it (was 2.3: +25% rate, and
                            // roofChance splits it, so ceiling shots and aimed
                            // shots each got 25% more frequent)
    laserWarnS: 1.1,        // eyes charge up first — never fire without warning
    laserFireS: 0.45,       // and the beam itself is brief
    laserH: 20,             // beam thickness
    roofChance: 0.45,       // …of any given shot going up instead of at Dex.
                            // This is the fight now: blast the roof, rain rock,
                            // Dex dodges, then gets a run at the crown.
    rocks: 7,               // how much ceiling comes down when it does
    rockVolleys: 2,         // …in this many waves, so it's a barrage not a blip
    rockVolleyGapS: 0.7,
    rockWarnS: 0.9,         // a shadow on the floor before each one lands…
    rockFallAccel: 900,     // …and it stays there all the way down. Slow enough
    rockSpeed: 380,         // to read: about 1.3s from ceiling to floor, where
                            // it used to be 0.8s with no marker for most of it.
    // He hunts. The shadow lands first, then he does.
    leapEveryS: 5.4,        // …and faster as he loses jewels (see bossPace)
    breatherS: 1.15,        // enforced quiet between one attack and the next
    leapWarnS: 0.85,        // shadow on the floor before he goes
    leapS: 0.95,            // how long he's in the air
    leapHeight: 210,
    windedS: 3.0,           // flat on his face afterwards — hit him now.
                            // Dodging his leap throws you 300-400px clear, so
                            // this has to cover running all the way back AND
                            // the jump, or the reward for dodging is nothing.
    hurtS: 1.4,             // how long he reels after a crown hit
    shrinkPerHit: 0.10,     // and how much smaller he gets each time
  },
  enemies: {
    ratSpeed: 75, slugSpeed: 32, mozzieOmega: 1.5,
    warnMs: 450,            // Glitch Rat "!" telegraph before turning around
    emberCycleS: 3.6,       // Ember Rat: full patrol→puff→flame cycle length
    emberWarmupS: 0.7,      // puff-up telegraph before breathing
    emberBreathS: 0.9,      // how long the glitch-fire lasts
    emberRangePx: 78,       // flame length in front of the rat
    spikeSpeedMult: 0.85,   // Spike Rats trundle a little slower
    monkeyCycleS: 1.15,     // full swing→wind-up→throw cycle (3x the old rate)
    monkeyWarmupS: 0.42,    // wind-up telegraph before a banana is thrown
    monkeySwingOmega: 1.05, // how fast the vine swings (radians/sec)
    monkeySwingArc: 0.55,   // how far the swing reaches either side (radians)
    bananaSpeedPx: 250,     // horizontal throw speed
    bananaLobPx: 210,       // upward kick — bananas arc, they don't beam
    bananaGravity: 620,
    bananaRangePx: 360,     // how far a banana gets before it's gone
    blazeSpeed: 96,         // Blaze Rats run hot and fast
    geyserCycleS: 3.2,      // lava geyser: full rest→bubble→erupt cycle
    geyserWarnS: 0.85,      // bubbling telegraph before it blows
    geyserEruptS: 0.9,      // how long the column stays up
    geyserHeight: 150,      // how high the lava shoots
    fallCycleS: 4.2,        // lava waterfall: full off→building→pouring cycle
    fallWarnS: 0.6,         // it visibly builds at the lip before it pours
    fallPourS: 2.0,         // how long the curtain is deadly
    fallWidth: 72,          // width of the falling column — big and dramatic
    magmaSpeed: 62,         // Magma Rats prowl slowly between shots
    magmaCycleS: 2.9,       // full prowl→rear-up→spit cycle
    magmaWarmupS: 0.6,      // glowing rear-up telegraph before a fireball
    fireballSpeedPx: 250,
    fireballLobPx: 70,      // a flatter arc than a banana — it's a shot, not a lob
    fireballGravity: 200,
    fireballRangePx: 330,
    fireballWakePx: 420,    // only spits when Dex is genuinely near
    bloatSpeed: 40,         // Bloat Rats waddle
    bloatHits: 2,           // and take two bounces, same as a Glow Rat
    glowSpeed: 44,          // Glow Rats are big, heavy and slow
    glowHits: 2,            // and take two bounces: knock the glow off, then cure
    floodRisePx: 40,        // how fast the rising slime climbs (px/sec)
                            // Dex climbs a fire escape at ~57px/sec, so at 40
                            // he only nets 17px of margin per step: the chase
                            // is close the whole way and a dither is fatal.
                            // Measured on Glow City: straight up clears both
                            // stages; a 2s dither is caught on the lower steps.
    floodDrainMult: 2.6,    // how much faster it drains once Dex is clear
  },
  platforms: {
    crumbleShakeMs: 550,    // warning shake before a crumbler drops
    crumbleRespawnMs: 3000,
  },
  powerups: {
    // (Spring Boots no longer use a fixed velocity: springJump() solves for
    //  the speed that lands the apex at exactly two normal jump heights.)
    timeSlowFactor: 0,      // Time Bubble: 0 = the world stops entirely
    timeDurationS: 5,
    pulseRadius: 180,       // Cure Pulse reach
    shieldInvulnMs: 900,    // grace after the bubble pops
    fullChargeBonusCrystals: 3,
    cacheCrystals: 10,      // reward for finding a hidden crystal stash
  },
  assist: {
    level1Deaths: 3,  level1SpeedMult: 0.85, level1CoyoteBonusMs: 50,
    level2Deaths: 5,  level2SpeedMult: 0.70, level2SpawnProtectionMs: 3500,
    localDeaths: 3,   localRadius: 340,      localSpeedMult: 0.75,
  },
  level: { width: 10200, sections: [0, 2400, 5400, 8200, 10200] },
  // slideOffsetY: how far down the screen Dex rides while the camera follows
  // him down a chute. Only used while sliding.
  camera: { lerp: 6, offsetX: 380, slideOffsetY: 250,
            // mid-flight Dex sits further left so she can see where she is
            // going — at 620px/s the normal framing arrives too late to steer
            flightOffsetX: 250 },
};

const VIEW_W = 960, VIEW_H = 540;

/* -------------------------------------------------------- 2. POWER-UPS DEF */
const POWERUP_ORDER = ['shield', 'boots', 'time', 'pulse'];
const POWERUPS = {
  shield: {
    name: 'Bubble Shield', icon: '🫧', max: 1, passive: true,
    desc: 'Pops to protect you from one zap — no button needed!',
    rechargeMsg: 'Correct! Bubble Shield recharged! 🫧',
    lockedHint: 'Win it in Level 1!',
  },
  boots: {
    name: 'Spring Boots', icon: '🥾', max: 1,
    desc: 'Press jump twice — a double jump, twice as high!',
    rechargeMsg: 'Great thinking! Your Spring Boots are ready! 🥾',
    lockedHint: 'Win it in Level 2!',
  },
  time: {
    name: 'Time Bubble', icon: '⏳', max: 1,
    desc: '{ACT} to freeze everything for 5 seconds — except you!',
    rechargeMsg: 'Power restored — Time Bubble ready! ⏳',
    lockedHint: 'Win it in Level 3!',
  },
  pulse: {
    name: 'Cure Pulse', icon: '💜', max: 1,
    desc: '{ACT} to cure a Glitch Rat near you!',
    rechargeMsg: 'Brilliant! Cure Pulse charged! 💜',
    lockedHint: 'Win it in Level 4!',
  },
};

/* ------------------------------------------------------------------ 3. DOM */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const ui = {
  healthChip: $('healthChip'),
  crystalChip: $('crystalChip'), zapChip: $('zapChip'), powerChip: $('powerChip'),
  progress: $('progress'), progressFill: $('progressFill'), progressCat: $('progressCat'),
  muteBtn: $('muteBtn'), pauseBtn: $('pauseBtn'),
  overlayTitle: $('overlayTitle'),
  overlayMath: $('overlayMath'), overlayPause: $('overlayPause'),
  overlayVictory: $('overlayVictory'),
  livesChip: $('livesChip'), overlayGameOver: $('overlayGameOver'),
  gameOverLives: $('gameOverLives'), gameOverText: $('gameOverText'),
  gameOverRetryBtn: $('gameOverRetryBtn'), gameOverTreehouseBtn: $('gameOverTreehouseBtn'),
  playBtn: $('playBtn'), replayStoryBtn: $('replayStoryBtn'),
  tjButtons: $('tjButtons'), testJump: $('testJump'),
  introUI: $('introUI'), skipBtn: $('skipBtn'),
  resumeBtn: $('resumeBtn'), pauseMuteBtn: $('pauseMuteBtn'),
  pauseRestartBtn: $('pauseRestartBtn'), pauseTreehouseBtn: $('pauseTreehouseBtn'),
  replayBtn: $('replayBtn'), victoryTreehouseBtn: $('victoryTreehouseBtn'),
  // structural fallbacks: a cached page one generation old has the panel but
  // not the ids, and the ending must not depend on which it is
  victoryTitle: $('victoryTitle') || document.querySelector('#overlayVictory h2'),
  victoryBlurb: $('victoryBlurb') || document.querySelector('#overlayVictory p'),
  mathTitle: $('mathTitle'), mathSub: $('mathSub'),
  mathQuestion: $('mathQuestion'), mathFeedback: $('mathFeedback'),
  mathReward: $('mathReward'), mathHint: $('mathHint'),
  answers: Array.from(document.querySelectorAll('.answer')),
  statTime: $('statTime'), statCrystals: $('statCrystals'),
  statCures: $('statCures'), statSecrets: $('statSecrets'),
  statQuestions: $('statQuestions'), statAccuracy: $('statAccuracy'),
  unlockBanner: $('unlockBanner'),
  overlaySettings: $('overlaySettings'), settingsBtn: $('settingsBtn'),
  settingsCloseBtn: $('settingsCloseBtn'), storyBtn: $('storyBtn'),
  overlayLevels: $('overlayLevels'), levelList: $('levelList'),
  levelsCloseBtn: $('levelsCloseBtn'),
  muteToggle: $('muteToggle'), fxToggle: $('fxToggle'),
  resetBtn: $('resetBtn'), resetConfirm: $('resetConfirm'),
  resetYes: $('resetYes'), resetNo: $('resetNo'),
  toast: $('toast'), debugPanel: $('debugPanel'), zoomHint: $('zoomHint'),
  btnLeft: $('btnLeft'), btnRight: $('btnRight'),
  btnJump: $('btnJump'), btnPower: $('btnPower'),
};

/* ---------------------------------------------------- 4. SAVE (localStorage) */
/* Spare lives. These live in `save`, not in `game`, and that is the whole
   point: `game` is wiped by beginAdventure() on every level start, so a lives
   counter kept there would silently refill between levels. In `save` it
   carries across levels, across the treehouse, and across a browser reload. */
const LIVES = {
  start: 9,               // a cat's nine
  crystalsPerExtra: 25,   // every 25 crystals collected earns a spare
  max: 99,
  // Zapped: spend a life and respawn at the last checkpoint. This was briefly
  // a full level restart, which is what "restart the level after losing a life"
  // literally asks for — but it quietly voids every checkpoint in the level,
  // and Sean read it as the checkpoints being broken. Set true to restart the
  // whole level again; the life cost is identical either way.
  restartLevelOnDeath: false,
};
/* The game is called CatQuest; this key still says numberquest and MUST stay
   that way. It is the localStorage address of the only copy of a real child's
   progress — every power-up built, every level finished, every spare life.
   Renaming it would not migrate that save, it would silently abandon it and
   hand her an empty one. A cosmetic rename is never worth a wiped save. */
const SAVE_KEY = 'numberquest_save_v2';
const LEVEL_COUNT = 5;
const SAVE_DEFAULTS = {
  v: 5,
  // 'blueprints' = power-ups UNLOCKED by finishing a level for the first time;
  // 'built' = made real in the workshop by answering one maths question.
  blueprints: { shield: false, boots: false, time: false, pulse: false },
  built:      { shield: false, boots: false, time: false, pulse: false },
  equipped: null,              // nothing equipped until something is built
  levelDone: new Array(LEVEL_COUNT).fill(false),   // per level: ever finished?
  levelBest: new Array(LEVEL_COUNT).fill(null),    // per level: best time (s)
  ratsRescued: 0,              // lifetime creatures cured
  crystalsBank: 0,             // lifetime crystals (banked on level completion)
  completions: 0,              // total adventures finished (any level)
  lives: 9,                    // spare lives, shared across the whole world
  crystalsToLife: 0,           // crystals collected since the last spare life

  introSeen: false,            // the opening story cinematic has been watched/skipped
  settings: { muted: false, reducedFx: false },
};
function freshSave() { return JSON.parse(JSON.stringify(SAVE_DEFAULTS)); }
// lives can never be negative, never absurd, and never a string from a hand-
// edited save — everything downstream may assume a sane integer
function clampLives(s) {
  const n = Math.floor(Number(s.lives));
  s.lives = Number.isFinite(n) ? Math.max(0, Math.min(LIVES.max, n)) : LIVES.start;
  const c = Math.floor(Number(s.crystalsToLife));
  s.crystalsToLife = Number.isFinite(c) ? Math.max(0, c) : 0;
  return s;
}
function fixArrays(s) {       // keep the per-level arrays the right length
  for (const k of ['levelDone', 'levelBest']) {
    if (!Array.isArray(s[k])) s[k] = SAVE_DEFAULTS[k].slice();
    while (s[k].length < LEVEL_COUNT) s[k].push(k === 'levelDone' ? false : null);
    s[k].length = LEVEL_COUNT;
  }
  return s;
}
let save = loadSave();
function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (d && (d.v === 4 || d.v === 5)) {
      const s = freshSave();
      Object.assign(s, d);
      // v4 saves predate spare lives: start them on a full set rather than 0
      if (d.v === 4) { s.lives = LIVES.start; s.crystalsToLife = 0; }
      // Object.assign copied the OLD version number back over the new one. Stamp
      // it forward or the migration re-runs on every load and lives reset to 9
      // each time the page is refreshed.
      s.v = SAVE_DEFAULTS.v;
      s.blueprints = Object.assign({}, SAVE_DEFAULTS.blueprints, d.blueprints);
      s.built = Object.assign({}, SAVE_DEFAULTS.built, d.built);
      s.settings = Object.assign({}, SAVE_DEFAULTS.settings, d.settings);
      if (s.equipped && !s.built[s.equipped]) s.equipped = null;
      return fixArrays(clampLives(s));
    }
    if (d && (d.v === 2 || d.v === 3)) {        // migrate older saves
      const s = freshSave();
      s.ratsRescued = d.ratsRescued || 0;
      s.crystalsBank = d.crystalsBank || 0;
      s.completions = d.completions || 0;
      s.introSeen = !!d.introSeen;
      s.settings = Object.assign({}, SAVE_DEFAULTS.settings, d.settings);
      // everything earned before was earned in Crystal Canyon
      if (s.completions > 0) { s.levelDone[0] = true; s.levelBest[0] = d.bestTimeS ?? null; }
      const had = d.v === 3 ? d.blueprints : d.unlocked;
      for (const id of POWERUP_ORDER) {
        if (had && had[id]) {
          s.blueprints[id] = true;
          s.built[id] = d.v === 3 ? !!(d.built && d.built[id]) : true;
        }
      }
      if (d.equipped && s.built[d.equipped]) s.equipped = d.equipped;
      return fixArrays(s);
    }
  } catch (_) {}
  return freshSave();
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) {}
}
function resetSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
  save = freshSave();
  applySettings();
}
function applySettings() {
  AudioSys.setMuted(save.settings.muted);
  updateMuteIcons();
  ui.muteToggle.checked = save.settings.muted;
  ui.fxToggle.checked = save.settings.reducedFx;
}
const fxScale = () => save.settings.reducedFx ? 0.5 : 1;

/* ---------------------------------------------------------------- 5. AUDIO */
const AudioSys = {
  ctx: null, master: null, muted: false,
  ensure() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  },
  tone(freq, dur, opts = {}) {
    if (!this.ctx || this.muted) return;
    const { type = 'sine', vol = 0.1, slide = 0, delay = 0 } = opts;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
};
const sfx = {
  jump()      { AudioSys.tone(330, 0.14, { type: 'square', vol: 0.06, slide: 220 }); },
  collect()   { AudioSys.tone(880, 0.09, { type: 'triangle', vol: 0.09 });
                AudioSys.tone(1318, 0.12, { type: 'triangle', vol: 0.08, delay: 0.07 }); },
  cure()      { [392, 523, 659, 880].forEach((f, i) =>
                  AudioSys.tone(f, 0.13, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); },
  zap()       { AudioSys.tone(400, 0.5, { type: 'triangle', vol: 0.09, slide: -330 }); },
  correct()   { [523, 659, 784, 1047].forEach((f, i) =>
                  AudioSys.tone(f, 0.14, { type: 'triangle', vol: 0.09, delay: i * 0.09 })); },
  wrong()     { AudioSys.tone(233, 0.18, { type: 'sine', vol: 0.06, slide: -50 }); },
  checkpoint(){ [523, 784].forEach((f, i) =>
                  AudioSys.tone(f, 0.15, { type: 'triangle', vol: 0.09, delay: i * 0.1 })); },
  victory()   { [523, 659, 784, 1047, 1319].forEach((f, i) =>
                  AudioSys.tone(f, 0.22, { type: 'triangle', vol: 0.1, delay: i * 0.13 })); },
  crumble()   { AudioSys.tone(150, 0.22, { type: 'sawtooth', vol: 0.045, slide: -60 }); },
  stomp()     { AudioSys.tone(200, 0.14, { type: 'square', vol: 0.07, slide: -110 });
                AudioSys.tone(95, 0.2, { type: 'sine', vol: 0.06, slide: -35 }); },
  grab()      { AudioSys.tone(300, 0.1, { type: 'triangle', vol: 0.06, slide: 140 }); },
  pad()       { AudioSys.tone(420, 0.16, { type: 'triangle', vol: 0.08, slide: 620 });
                AudioSys.tone(880, 0.2, { type: 'sine', vol: 0.06, slide: 420, delay: 0.05 }); },
  slide()     { AudioSys.tone(180, 0.8, { type: 'sawtooth', vol: 0.05, slide: 260 }); },
  aim()       { AudioSys.tone(220, 0.9, { type: 'sine', vol: 0.05, slide: 520 }); },
  laser()     { AudioSys.tone(900, 0.35, { type: 'sawtooth', vol: 0.07, slide: -700 }); },
  click()     { AudioSys.tone(600, 0.06, { type: 'triangle', vol: 0.05 }); },
  shrink()    { AudioSys.tone(520, 0.28, { type: 'triangle', vol: 0.08, slide: -240 }); },
  banana()    { AudioSys.tone(420, 0.14, { type: 'triangle', vol: 0.05, slide: 260 }); },
  lavafall()  { AudioSys.tone(180, 0.55, { type: 'sawtooth', vol: 0.04, slide: -70 }); },
  fireball()  { AudioSys.tone(320, 0.18, { type: 'sawtooth', vol: 0.045, slide: -160 }); },
  flood()     { AudioSys.tone(120, 0.7, { type: 'sine', vol: 0.06, slide: 90 }); },
  geyser()    { AudioSys.tone(150, 0.42, { type: 'sawtooth', vol: 0.05, slide: 210 });
                AudioSys.tone(90, 0.5, { type: 'sine', vol: 0.06, slide: -30 }); },
  pop()       { AudioSys.tone(620, 0.08, { type: 'triangle', vol: 0.09 });
                AudioSys.tone(920, 0.1, { type: 'triangle', vol: 0.07, delay: 0.05 }); },
  spring()    { AudioSys.tone(240, 0.22, { type: 'square', vol: 0.07, slide: 420 }); },
  shakeOff()  { AudioSys.tone(140, 0.30, { type: 'sine', vol: 0.09, slide: -60 });
                AudioSys.tone(320, 0.18, { type: 'triangle', vol: 0.05, slide: 260 }); },
  slowmo()    { AudioSys.tone(820, 0.5, { type: 'sine', vol: 0.08, slide: -500 }); },
  unlock()    { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
                  AudioSys.tone(f, 0.18, { type: 'triangle', vol: 0.09, delay: i * 0.09 })); },
};

/* ---------------------------------------------------------------- 6. INPUT */
const input = { left: false, right: false, jump: false, jumpPressed: false };
// Has the player successfully controlled anything yet? If keys never arrive
// (the page hasn't got keyboard focus — common when the game is embedded in a
// preview pane or an iframe) we say so on screen rather than looking frozen.
let sawInput = false;

window.addEventListener('keydown', e => {
  AudioSys.ensure();
  sawInput = true;
  const gameKeys = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (gameKeys.includes(e.code) && game.state !== 'math') e.preventDefault();

  if (game.state === 'intro') {
    if (e.code === 'Escape') skipIntro();
    else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); advanceIntro(); }
    return;
  }
  if (game.state === 'math') {
    const n = '1234'.indexOf(e.key);
    if (n >= 0) pressAnswer(n);
    return;
  }
  if (game.state === 'title') {
    if (e.code === 'Space' || e.code === 'Enter') startFromTitle();
    return;
  }
  if (game.state === 'victory') return;
  if (game.state !== 'treehouse') {
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
    if (game.state === 'paused') return;
  }

  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    if (!e.repeat) input.jumpPressed = true;
    input.jump = true;
  }
  if ((e.code === 'KeyE' || e.code === 'KeyX') && !e.repeat) {
    if (game.state === 'treehouse') treehouseInteract();
    else activatePower();
  }
  if (DEBUG_MODE) {
    if (e.code === 'KeyT') forceDeath();
    if (e.code === 'BracketLeft') debugCheckpoint(-1);
    if (e.code === 'BracketRight') debugCheckpoint(1);
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.jump = false;
});
window.addEventListener('blur', () => {
  if (game.state === 'playing') togglePause();
  if (game.state === 'intro') intro.paused = true;
});
window.addEventListener('focus', () => {
  if (game.state === 'intro') intro.paused = false;
});
// tapping/clicking the scene advances the story
canvas.addEventListener('pointerdown', e => {
  AudioSys.ensure();
  // clicking the game gives this page keyboard focus, which is exactly what the
  // "click here to play" hint is asking for
  try { window.focus(); canvas.focus(); } catch (_) {}
  if (game.state === 'intro') { e.preventDefault(); advanceIntro(); }
});

function bindHold(el, on, off) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); AudioSys.ensure(); sawInput = true;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    on();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev =>
    el.addEventListener(ev, off));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindHold(ui.btnLeft, () => { input.left = true; }, () => { input.left = false; });
bindHold(ui.btnRight, () => { input.right = true; }, () => { input.right = false; });
bindHold(ui.btnJump,
  () => { input.jump = true; input.jumpPressed = true; },
  () => { input.jump = false; });
bindHold(ui.btnPower, () => {
  if (game.state === 'treehouse') treehouseInteract();
  else activatePower();
}, () => {});

// Panels and buttons are sized in --gvmin (1% of the game frame's smaller side)
// rather than viewport units, so the UI scales with the canvas. Without this a
// tall, narrow window gives a short canvas but full-size text, and panel
// content gets clipped — invisibly, because scrollbars are hidden.
// How many device pixels there are per game pixel. Capped: a 3x buffer on a
// large screen is four times the fill rate of a 1.5x one for no visible gain
// on art this flat, and battery matters on a tablet.
let renderScale = 1;
function syncCanvasResolution() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  if (dpr === renderScale && canvas.width === Math.round(VIEW_W * dpr)) return;
  renderScale = dpr;
  canvas.width = Math.round(VIEW_W * dpr);
  canvas.height = Math.round(VIEW_H * dpr);
  resetTransform();
}
// Every place that needs to drop back to raw screen coordinates must come
// through here rather than setTransform(1,0,0,1,0,0), which would silently
// undo the retina scale and draw everything at quarter size in the corner.
function resetTransform() {
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
}
function syncUiScale() {
  const v = Math.min(canvas.clientWidth || VIEW_W, canvas.clientHeight || VIEW_H) / 100;
  document.documentElement.style.setProperty('--gvmin', v.toFixed(3) + 'px');
}
function onViewportChange() { syncCanvasResolution(); syncUiScale(); }
window.addEventListener('resize', onViewportChange);
// rotating an iPad fires orientationchange before the new size has settled
window.addEventListener('orientationchange', () => setTimeout(onViewportChange, 120));
onViewportChange();

if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  document.body.classList.add('touch');
}

/* ---------------------------------------------------------- ZOOM GUARDS --
   CatQuest is a fixed 16:9 layout with controls pinned to the corners. Any
   page zoom pushes those controls off the screen, and a child has no idea
   what has happened or how to undo it — Sean's daughter lost the jump button
   to exactly this after double-tapping a maths answer.

   iOS ignores user-scalable=no, so this has to be done by hand.            */

// 1. Pinch. These are Safari's own non-standard events; other browsers simply
//    never fire them, so there is nothing to feature-detect.
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev =>
  document.addEventListener(ev, e => e.preventDefault(), { passive: false }));

// 2. Double-tap. touch-action: manipulation covers this on every element that
//    honours it; this catches the gaps (and older iOS, which honours less).
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  // NEVER touch the game's own controls. The double jump is two deliberate
  // rapid taps on the jump button, and answering a maths question quickly is
  // normal — those all carry touch-action: manipulation already, so their
  // double-tap zoom is handled without swallowing the second tap.
  const onControl = e.target && e.target.closest &&
                    e.target.closest('#touch, button, .answer, .lvlCard, .iconbtn');
  if (!onControl && now - lastTouchEnd < 320) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

/* 3. And if it still happens — a wedged zoom is unrecoverable for a seven-
      year-old, so say what to do about it. visualViewport reports the pinch
      scale; it is absent on older browsers, where this simply never runs. */
if (window.visualViewport) {
  const vv = window.visualViewport;
  const checkZoom = () => {
    const zoomed = vv.scale > 1.05;
    if (ui.zoomHint) ui.zoomHint.classList.toggle('hidden', !zoomed);
  };
  vv.addEventListener('resize', checkZoom);
  vv.addEventListener('scroll', checkZoom);
  checkZoom();
}

/* ---------------------------------------------------------- 7. MATHS QUIZ */
const MathQuiz = (() => {
  const TABLES = [2, 3, 4, 5, 8, 10];
  let used = new Set();
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[ri(0, a.length - 1)];
  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const tens = n => Math.floor(n / 10) * 10;

  function makeAdd() {
    const a = ri(11, 84), b = ri(6, Math.min(99 - a, 45));
    const hint = b >= 10
      ? `Add the tens first: ${a} + ${tens(b)} = ${a + tens(b)}. Then add ${b % 10} more.`
      : `Start at ${a} and count up ${b} more.`;
    return { text: `${a} + ${b} = ?`, answer: a + b, key: `add${a}+${b}`,
             hint, type: 'add', a, b };
  }
  function makeSub() {
    const a = ri(20, 99), b = ri(6, a - 4);
    const hint = b >= 10
      ? `Take away the tens first: ${a} − ${tens(b)} = ${a - tens(b)}. Then take away ${b % 10}.`
      : `Start at ${a} and count back ${b}.`;
    return { text: `${a} − ${b} = ?`, answer: a - b, key: `sub${a}-${b}`,
             hint, type: 'sub', a, b };
  }
  function makeMul() {
    const t = pick(TABLES), k = ri(2, 12);
    return { text: `${k} × ${t} = ?`, answer: k * t, key: `mul${k}x${t}`,
             hint: `Count in ${t}s, ${k} times: ${t}, ${t * 2}, ${t * 3}…`,
             type: 'mul', table: t };
  }
  function makeDiv() {
    const t = pick(TABLES), k = ri(2, 12), m = t * k;
    return { text: `${m} ÷ ${t} = ?`, answer: k, key: `div${m}/${t}`,
             hint: `How many ${t}s make ${m}? Count in ${t}s: ${t}, ${t * 2}, ${t * 3}…`,
             type: 'div', table: t };
  }
  function makeMissing() {
    if (Math.random() < 0.5) {
      const a = ri(5, 60), d = ri(4, 35);
      return { text: `${a} + ▢ = ${a + d}`, answer: d, key: `mis${a}+${a + d}`,
               hint: `What do you add to ${a} to reach ${a + d}? Count up from ${a}.`,
               type: 'add', a, b: d };
    }
    const t = pick(TABLES), k = ri(2, 10);
    return { text: `▢ × ${t} = ${t * k}`, answer: k, key: `mis${t}x${t * k}`,
             hint: `Count in ${t}s until you reach ${t * k}: ${t}, ${t * 2}, ${t * 3}…`,
             type: 'div', table: t };
  }
  function makeWord() {
    const kind = ri(0, 3);
    if (kind === 0) {
      const a = ri(10, 55), b = ri(5, 30);
      return { text: `Dex finds ${a} shiny fish by the river and ${b} more in the pond. How many fish altogether?`,
               answer: a + b, key: `wadd${a}+${b}`,
               hint: `This is really ${a} + ${b}. Add the tens first!`,
               type: 'add', a, b };
    }
    if (kind === 1) {
      const a = ri(14, 60), b = ri(4, a - 4);
      return { text: `Dex has ${a} balls of yarn. ${b} of them roll away down the hill. How many are left?`,
               answer: a - b, key: `wsub${a}-${b}`,
               hint: `This is really ${a} − ${b}. Count back from ${a}.`,
               type: 'sub', a, b };
    }
    if (kind === 2) {
      const t = pick(TABLES), k = ri(2, 6);
      return { text: `There are ${k} baskets with ${t} berries in each basket. How many berries in total?`,
               answer: k * t, key: `wmul${k}x${t}`,
               hint: `This is really ${k} × ${t}. Count in ${t}s: ${t}, ${t * 2}…`,
               type: 'mul', table: t };
    }
    const t = pick([2, 3, 4, 5]), k = ri(2, 9);
    return { text: `Dex shares ${t * k} cat treats equally between ${t} kittens. How many treats does each kitten get?`,
             answer: k, key: `wdiv${t * k}/${t}`,
             hint: `This is really ${t * k} ÷ ${t}. How many ${t}s make ${t * k}?`,
             type: 'div', table: t };
  }

  function makeSequence() {
    const roll = Math.random();
    if (roll < 0.62) {                       // counting up: 1, 4, 7, 10, ▢
      const step = pick([2, 3, 4, 5, 6, 10]);
      const start = ri(1, 20);
      const terms = [0, 1, 2, 3].map(i => start + step * i);
      const answer = start + step * 4;
      return { text: `What comes next?  ${terms.join(', ')}, ▢`, answer,
               key: `sequp${start}+${step}`,
               hint: `The numbers go up by ${step} each time. ${terms[3]} + ${step} = ?`,
               type: 'seq', table: step };
    }
    if (roll < 0.87) {                       // counting back: 40, 34, 28, 22, ▢
      const step = pick([2, 3, 4, 5, 10]);
      const answer = ri(0, 12);
      const terms = [4, 3, 2, 1].map(i => answer + step * i);
      return { text: `What comes next?  ${terms.join(', ')}, ▢`, answer,
               key: `seqdn${terms[0]}-${step}`,
               hint: `The numbers go down by ${step} each time. ${terms[3]} − ${step} = ?`,
               type: 'seq', table: step };
    }
    const start = pick([1, 2, 3, 5]);        // doubling: 3, 6, 12, 24, ▢
    const terms = [0, 1, 2, 3].map(i => start * Math.pow(2, i));
    return { text: `What comes next?  ${terms.join(', ')}, ▢`, answer: start * 16,
             key: `seqdbl${start}`,
             hint: `Each number is double the one before. Double ${terms[3]} is…?`,
             type: 'seq', table: terms[3] };
  }

  const GENS = [
    [makeAdd, 20], [makeSub, 18], [makeMul, 18],
    [makeDiv, 12], [makeMissing, 12], [makeWord, 11],
    // roughly one question in eight — enough for variety, not enough to
    // crowd out the tables she is actually meant to be practising
    [makeSequence, 13],
  ];
  const totalW = GENS.reduce((s, g) => s + g[1], 0);
  function pickGen() {
    let r = Math.random() * totalW;
    for (const [fn, w] of GENS) { if ((r -= w) <= 0) return fn; }
    return makeAdd;
  }

  function distractors(q) {
    const seen = new Set([q.answer]);
    const out = [];
    const cands = [q.answer + 1, q.answer - 1, q.answer + 2, q.answer - 2,
                   q.answer + 10, q.answer - 10];
    if (q.table) cands.push(q.answer + q.table, q.answer - q.table);
    if (q.type === 'sub' && q.a !== undefined) cands.push(q.a + q.b);
    if (q.type === 'add' && q.a !== undefined) cands.push(Math.abs(q.a - q.b));
    shuffle(cands);
    for (const c of cands) {
      if (out.length >= 3) break;
      if (Number.isInteger(c) && c >= 0 && c <= 200 && !seen.has(c)) {
        seen.add(c); out.push(c);
      }
    }
    let off = 3;
    while (out.length < 3) {
      const c = q.answer + off;
      if (c >= 0 && !seen.has(c)) { seen.add(c); out.push(c); }
      off = off > 0 ? -off : -off + 1;
    }
    return out;
  }

  function next() {
    for (let i = 0; i < 120; i++) {
      const q = pickGen()();
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 200) continue;
      if (used.has(q.key)) continue;
      const choices = shuffle([q.answer, ...distractors(q)]);
      if (new Set(choices).size !== 4) continue;
      used.add(q.key);
      return { ...q, choices };
    }
    used.clear();
    return next();
  }

  function reset() { used.clear(); }
  function selftest(n = 300) {
    const savedSet = used; used = new Set();
    const issues = [], keys = new Set();
    for (let i = 0; i < n; i++) {
      const q = next();
      if (keys.has(q.key)) issues.push(`duplicate question: ${q.key}`);
      keys.add(q.key);
      if (new Set(q.choices).size !== 4) issues.push(`duplicate choices: ${q.text}`);
      if (!q.choices.includes(q.answer)) issues.push(`answer missing: ${q.text}`);
      if (q.choices.some(c => c < 0)) issues.push(`negative choice: ${q.text}`);
      if (!q.hint) issues.push(`no hint: ${q.text}`);
    }
    used = savedSet;
    return { tested: n, issues };
  }
  // The lock on Nova's cage. Sean asked for the last question to be harder
  // than the rest, so it is the only two-step one in the game: a times table
  // and then a subtraction. Everything else about it — the choices, the hint,
  // the encouragement — works exactly like every other question, because the
  // last thing you want at the end is unfamiliar rules.
  function makeFinale() {
    const t = 2 + Math.floor(Math.random() * 8);
    const n = 3 + Math.floor(Math.random() * 6);
    const take = 2 + Math.floor(Math.random() * Math.max(2, t * n - 4));
    const answer = t * n - take;
    return { type: 'finale', table: t, a: t * n, b: take, answer,
             text: `Nova has ${n} boxes with ${t} crystals in each. ` +
                   `She uses ${take} to pick the lock. How many are left?`,
             hint: `First ${n} × ${t} = ${t * n}. Then take away ${take}.`,
             key: `fin${n}x${t}-${take}` };
  }
  function finale() {
    for (let i = 0; i < 200; i++) {
      const q = makeFinale();
      if (!Number.isInteger(q.answer) || q.answer < 4 || q.answer > 200) continue;
      const choices = shuffle([q.answer, ...distractors(q)]);
      if (new Set(choices).size !== 4) continue;
      return { ...q, choices };
    }
    return next();
  }
  return { next, finale, reset, selftest };
})();

/* ----------------------------------------------------- CREATURE REGISTRY --
   Every corrupted creature lives here, so each level can mix its own cast.
     move     'walk'  patrols between x1..x2 on the ground
              'fly'   drifts up and down around a midpoint
              'swing' hangs from a vine and swings to and fro like a pendulum
     stompable  can Dex bounce on it to cure it? (spiky ones: no)
     curable    does bouncing/Cure Pulse turn it friendly? (all of them so far)
     draw       how it looks corrupted; drawFriendly is its cured self
   To add a species (a jungle monkey, say) add one entry and give it a draw
   function — the level kit's CREATURE('monkey', ...) will then spawn it.     */
const CREATURES = {
  rat: {
    label: 'Glitch Rat', move: 'walk', stompable: true, w: 36, h: 24,
    speed: () => TUNING.enemies.ratSpeed, telegraph: true,
  },
  emberRat: {
    label: 'Ember Rat', move: 'walk', stompable: true, w: 36, h: 24,
    speed: () => TUNING.enemies.ratSpeed, telegraph: true, variant: 'ember',
  },
  spikeRat: {
    label: 'Spike Rat', move: 'walk', stompable: false, w: 36, h: 24,
    speed: () => TUNING.enemies.ratSpeed * TUNING.enemies.spikeSpeedMult,
    telegraph: true, variant: 'spike',
  },
  mozzie: {
    label: 'Glitch Mosquito', move: 'fly', stompable: true, w: 34, h: 24,
    omega: () => TUNING.enemies.mozzieOmega,
  },
  // The sewer's heavy. Same two-bounce idea as the Glow Rat, different coat.
  bloatRat: {
    label: 'Bloat Rat', move: 'walk', stompable: true, w: 56, h: 40,
    speed: () => TUNING.enemies.bloatSpeed, telegraph: true, variant: 'bloat',
    hits: () => TUNING.enemies.bloatHits,
  },
  // Big, heavy and radioactive. Two bounces: the first knocks the glow out of
  // it and shrinks it down, the second cures it.
  glowRat: {
    label: 'Glow Rat', move: 'walk', stompable: true, w: 54, h: 38,
    speed: () => TUNING.enemies.glowSpeed, telegraph: true, variant: 'glow',
    hits: () => TUNING.enemies.glowHits,
  },
  // Prowls, rears up glowing, then spits an arcing fireball. Head stays safe.
  magmaRat: {
    label: 'Magma Rat', move: 'walk', stompable: true, w: 38, h: 26,
    speed: () => TUNING.enemies.magmaSpeed, telegraph: true, variant: 'magma',
    spits: true,
  },
  // Ablaze and frantic: flames stream off its back as it runs, but its head
  // stays clear — bouncing on it puts the fire out and cures it.
  blazeRat: {
    label: 'Blaze Rat', move: 'walk', stompable: true, w: 36, h: 24,
    speed: () => TUNING.enemies.blazeSpeed, telegraph: true, variant: 'blaze',
  },
  // Jungle troublemaker: swings to and fro on a vine, winds up, then lobs a
  // banana. Bounce on it at the bottom of its swing to cure it.
  monkey: {
    label: 'Glitch Monkey', move: 'swing', stompable: true, w: 36, h: 34,
    throws: true,
  },
};
// give every species a spawn() built from its declaration
for (const [id, S] of Object.entries(CREATURES)) {
  S.id = id;
  if (S.move === 'fly') {
    S.spawn = (x, cy, amp, phase = 0) => ({
      species: id, type: 'mozzie', x, cy, amp, angle: phase, y: cy,
      alive: true, stompable: S.stompable, w: S.w, h: S.h,
      warn: 0, cured: false, cureTimer: 0 });
  } else if (S.move === 'swing') {
    // (anchorX, anchorY, vineLength, phase) — hangs from a vine at the anchor
    S.spawn = (ax, ay, len = 250, phase = 0) => ({
      species: id, type: 'monkey', ax, ay, len, swingT: phase,
      x: ax - S.w / 2, y: ay + len, dir: 1,
      alive: true, stompable: S.stompable, w: S.w, h: S.h,
      warn: 0, cured: false, cureTimer: 0, vy: 0,
      shotT: (ax * 0.11) % 3, aiming: false, letGo: false });
  } else {
    S.spawn = (x1, x2, y = 480) => ({
      species: id, type: 'rat', variant: S.variant || null,
      x1, x2, y, y0: y, x: x1, dir: 1,
      alive: true, stompable: S.stompable, w: S.w, h: S.h,
      warn: 0, cured: false, cureTimer: 0, vy: 0,
      fireT: (x1 * 0.37) % 2, warmup: false, breathing: false,
      shotT: (x1 * 0.13) % 2, aiming: false,
      hits: S.hits ? S.hits() : 1, hitFlash: 0 });
  }
}

/* --------------------------------------------------- LEVEL BUILDING KIT */
// Every level is authored with the same small vocabulary. levelKit() hands
// back the builder functions plus the arrays they fill, so adding a new level
// is a matter of writing its layout — no engine changes required.
function levelKit() {
  const solids = [], crumblers = [], movers = [], spikes = [],
        enemies = [], crystals = [], signs = [], shards = [], emitters = [],
        caches = [], geysers = [], falls = [], slimes = [], floods = [], vines = [],
        chutes = [], pads = [];
  return {
    solids, crumblers, movers, spikes, enemies, crystals, signs, shards,
    emitters, caches, geysers, falls, slimes, floods, vines, chutes, pads,
    // ground / floating platform (opts can tag a surface, e.g. { slippery: true })
    G: (x, w, opts) => solids.push(Object.assign(
      { x, y: 480, w, h: 80, kind: 'ground' }, opts)),
    F: (x, y, w, opts) => solids.push(Object.assign(
      { x, y, w, h: 20, kind: 'float' }, opts)),
    CR: (x, y) => crumblers.push({ x, y, w: 90, h: 18, kind: 'crumble',
                                   state: 'ok', timer: 0 }),
    MV: (cx, cy, w, rangeX, rangeY, omega, phase = 0) =>
      movers.push({ cx, cy, w, h: 18, rangeX, rangeY, omega, angle: phase,
                    x: cx + Math.sin(phase) * rangeX - w / 2,
                    y: cy + Math.sin(phase) * rangeY,
                    dx: 0, dy: 0, kind: 'mover', isMover: true }),
    SP: (x, w) => spikes.push({ x, y: 460, w, h: 20 }),
    // A crystal geode: a catapult. NOT a platform — a touch volume, so it can
    // never block Dex or trap him, and any contact fires him. Pass the y of
    // the surface it stands on (480 for ground).
    //
    // The trigger column is 130px tall against 30px of visible crystal. That
    // is deliberate: a geode is the only way across the canyon behind it, and
    // a 131px jump would otherwise clear the crystals and drop her in.
    PAD: (x, surfaceY = 480) => pads.push({ x, y: surfaceY - 130, w: 76, h: 130,
                                            baseY: surfaceY, visH: 30,
                                            kind: 'pad', fire: 0 }),
    // lava geyser: bubbles as a warning, then erupts upward. phase staggers them.
    GEYSER: (x, y = 480, phase = 0) => geysers.push({ x, y, w: 46, t: phase,
                                                      warning: false, erupting: false }),
    // RISING slime: once Dex enters the zone the surface climbs steadily and he
    // has to get up and out ahead of it. Drains again once he's clear, so a
    // retry always starts from the bottom.
    FLOOD: (x1, x2, startY, topY) => floods.push({ x1, x2, startY, topY,
                                                   y: startY, active: false }),
    // toxic slime: a glowing pool on the ground. Always dangerous — green
    // means jump it — but it bubbles so it reads as alive.
    SLIME: (x, w, y = 480) => slimes.push({ x, y, w, h: 18 }),
    // A slide. Give it the shape of the chute as [[x, y], …] and it returns a
    // handle you hang obstacles off:
    //   const CH = CHUTE([[200,200],[900,320]]);
    //   CH.bump(500);  CH.pipe(700);  CH.gap(800, 870);
    CHUTE: (pts) => {
      const c = { pts, x1: pts[0][0], x2: pts[pts.length - 1][0], obs: [], gaps: [] };
      // a rat crouched on the chute: jump it (or land on it and cure it)
      c.rat = x => { c.obs.push({ x, kind: 'rat', cured: false }); return c; };
      // a swarm hanging over the chute: stay down, do NOT jump
      c.swarm = x => { c.obs.push({ x, kind: 'swarm' }); return c; };
      c.gap = (a, b) => { c.gaps.push([a, b]); return c; };
      // where the pipe spits him out, back at ordinary level coordinates
      c.exitTo = (x, y) => { c.exit = { x, y }; return c; };
      chutes.push(c);
      return c;
    },
    // a vine Dex can swing on. It hangs from (ax, ay) and is `len` long, so
    // its end sits at (ax, ay + len) at rest. Jump near the end to catch it.
    VINE: (ax, ay, len) => vines.push({ ax, ay, len, theta: 0, omega: 0,
                                        phase: ax * 0.011 }),
    // lava waterfall: pours from a lip down to a floor, easing off between
    // surges so there's always a window to dash through.
    FALL: (x, top, bottom, phase = 0) => falls.push({ x, top, bottom, t: phase,
                                                      warning: false, pouring: false }),
    // CREATURE(species, ...) spawns anything from the CREATURES registry.
    // Walkers take (species, x1, x2, y); flyers take (species, x, midY, swing, phase).
    CREATURE: (species, a, b, c, d) => {
      const S = CREATURES[species];
      if (!S) { console.warn('unknown creature species:', species); return; }
      enemies.push(S.spawn(a, b, c, d));
    },
    // shorthands for the species already in the game
    RAT: (x1, x2, y = 480, variant = null) => enemies.push(
      CREATURES[variant === 'ember' ? 'emberRat'
              : variant === 'spike' ? 'spikeRat'
              : variant === 'blaze' ? 'blazeRat'
              : variant === 'magma' ? 'magmaRat'
              : variant === 'glow'  ? 'glowRat'
              : variant === 'bloat' ? 'bloatRat' : 'rat'].spawn(x1, x2, y)),
    MOZZIE: (x, cy, amp, phase = 0) => enemies.push(
      CREATURES.mozzie.spawn(x, cy, amp, phase)),
    C: (x, y) => crystals.push({ x, y, got: false }),
    SH: (x, y) => shards.push({ x, y, seed: x * 0.13 + y * 0.07 }),
    SIGN: (x, y, text) => signs.push({ x, y, text }),
    EMIT: (x, y, w, rate) => emitters.push({ x, y, w, rate }),
    CACHE: (x, y) => caches.push({ x, y, taken: false }),
    finish(opts) {
      return Object.assign({ pads, solids, crumblers, movers, spikes, enemies,
                             crystals, signs, shards, emitters, caches,
                             geysers, falls, slimes, floods, vines, chutes }, opts);
    },
  };
}

/* ------------------------------------------------- LEVEL 1: CRYSTAL CANYON */
function buildCrystalCanyon() {
  const K = levelKit();
  const { G, F, CR, MV, SP, RAT, MOZZIE, C, SH, SIGN, EMIT, CACHE, PAD } = K;

  /* Crystal Canyon is built as ISLANDS separated by open canyon, and the only
     way from one to the next is a crystal geode: touch it and Dex is thrown on
     a three-second arc across the void. That is the level's whole identity —
     every other level walks its length, this one flies most of it.

     Two numbers govern the layout, and both come from TUNING.player:
       • an arc travels 1,477px at full backward lean and 2,243px at full
         forward lean, so every landing island must be solid across that
         entire 766px window plus a margin;
       • an arc peaks 336px above the launch, so nothing may hang above the
         first ~2,300px in front of a geode.
     checkLevels() flies all three leans off every geode and will refuse any
     arc that clips scenery, lands on spikes, or falls out of the world. Move a
     platform near a launch or a landing and expect it to complain. */

  // a trail of crystals along the arc a geode throws, so flying straight and
  // true is the rewarded line and leaning is a choice with a cost
  // These offsets are measured from the geode's LEFT edge, not its centre:
  // running right, Dex trips the trigger the moment he touches that edge, so
  // the arc actually starts about 29px before pad.x. Computing the trail from
  // the centre put every crystal ~52px beyond his real flight path.
  const ARC = px => {
    [[296, 272], [606, 159], [916, 122], [1226, 159], [1536, 272]]
      .forEach(([dx, y]) => C(px + dx, y));
  };

  /* --- ISLAND A (0–2700): learn to run, jump and cure, then meet a geode --- */
  G(0, 900); G(990, 510); G(1620, 1080);
  F(500, 400, 120); F(1200, 395, 110); F(1900, 410, 110);
  RAT(660, 820); RAT(1760, 1920);
  SIGN(150, 330, 'Run with ◀ ▶ or A D — jump with SPACE');
  SIGN(700, 246, 'Bounce on top to cure a Glitch Rat!');
  SIGN(2180, 300, 'Touch the big crystal — it FLINGS you across!');
  SIGN(2360, 236, 'Lean ◀ ▶ in the air to steer');
  C(230, 445); C(270, 445); C(310, 445);
  C(540, 360); C(580, 360);
  C(905, 420); C(945, 395); C(985, 420);
  C(1235, 355); C(1275, 355);
  C(1535, 420); C(1575, 395); C(1615, 420);
  C(1935, 370); C(1975, 370);
  C(2200, 445); C(2260, 445);
  PAD(2450); ARC(2450);

  /* --- ISLAND B (3800–6500): the first proper platforming --- */
  G(3700, 2800);                           // starts early: the shortest arc lands at 3898
  F(4850, 400, 110); F(5050, 330, 100); F(5900, 410, 100);
  MV(5300, 400, 120, 130, 0, 1.3);
  RAT(4900, 5100); MOZZIE(5200, 330, 70); RAT(5600, 5800);
  SIGN(4180, 320, 'Nice flying! Crystals up ahead…');
  SH(4900, 430); SH(5950, 400);
  C(4880, 360); C(4920, 360);
  C(5080, 290); C(5120, 290);
  C(5300, 350); C(5360, 350);
  C(5650, 440); C(5700, 440);
  C(5930, 370); C(5970, 370);
  PAD(6300); ARC(6300);

  /* --- ISLAND C (7600–10400): crumbling bridge, climb, and a secret --- */
  G(7600, 2800);
  CR(8700, 440); CR(8815, 440); CR(8930, 440);
  F(9100, 400, 90); F(9250, 330, 100); F(9400, 260, 100);
  F(9560, 190, 110);                       // the secret shelf
  RAT(8700, 8900); MOZZIE(9150, 330, 60); RAT(9300, 9500, 480, 'ember');
  SIGN(7980, 320, 'The bridge crumbles — keep moving!');
  SIGN(9120, 300, '✨ Secrets hide up high…');
  EMIT(9600, 200, 80, 3);
  SH(8740, 385); SH(8950, 375); SH(9600, 300);
  C(8720, 400); C(8840, 400); C(8960, 400);
  C(9130, 350); C(9280, 280); C(9430, 210);
  C(9600, 145); C(9650, 145);
  CACHE(9615, 152);                        // the reward for the climb
  PAD(10200); ARC(10200);

  /* --- ISLAND D (11500–14300): ember rats and moving ground --- */
  G(11500, 2800);
  MV(12700, 400, 120, 140, 0, 1.4);
  F(12950, 380, 100); F(13150, 300, 100);
  CR(13600, 430); CR(13715, 430);
  RAT(12600, 12800, 480, 'ember'); MOZZIE(13000, 320, 70); RAT(13300, 13500);
  SIGN(11880, 320, 'Ember Rats breathe glitch-fire — bounce them when calm!');
  SH(12650, 430); SH(13250, 390);
  C(12700, 340); C(12760, 340);
  C(12980, 330); C(13020, 330);
  C(13180, 250); C(13220, 250);
  C(13620, 385); C(13735, 385);
  C(13900, 440); C(13950, 440);
  CACHE(13180, 205);                       // above the high step
  PAD(14100); ARC(14100);

  /* --- ISLAND E (15400–18400): the glitching bridge finale ---
     The ground deliberately runs OUT at 16700. A vertical lift and a
     horizontal ferry carry Dex the rest of the way, and they need open air
     beneath them: a mover that sweeps down through ground Dex can stand on
     will crush him where he stands, which is what checkLevels() caught when
     this island was first laid as one continuous slab. */
  G(15400, 1300);                          // the landing zone and the run-up
  CR(16700, 440); CR(16820, 400);          // the bridge starts giving way
  MV(16990, 380, 110, 0, 80, 1.3, 4.0);    // a lift over the first void
  F(17080, 300, 110);
  CR(17260, 340);
  MV(17420, 430, 110, 90, 0, 1.5, 2.6);    // a ferry over the last one
  G(17700, 700);                           // solid ground, spikes, portal
  RAT(16550, 16650, 480, 'spike'); RAT(17090, 17180, 300);
  SP(17800, 60);
  SIGN(16400, 320, 'The bridge is glitching — run!');
  SH(16540, 380); SH(16740, 385); SH(17300, 285); SH(17760, 430); SH(18040, 430);
  EMIT(16900, 300, 320, 1.5);
  C(16740, 400); C(16860, 360); C(16990, 290); C(17110, 255);
  C(17290, 295); C(17450, 385); C(17760, 440); C(18060, 440);

  return K.finish({
    theme: 'canyon',
    width: 18400,
    sections: [0, 2700, 6500, 10400, 14300, 18400],
    // One checkpoint on each island, sat in the landing zone rather than at
    // its far end: a zap on island C should not cost her the flight to it.
    checkpoints: [
      { x: 80,    y: 480 },
      { x: 4100,  y: 480 },
      { x: 7900,  y: 480 },
      { x: 11800, y: 480 },
      { x: 15700, y: 480 },
    ],
    portal: { x: 18200, y: 380, w: 70, h: 100 },
    helper: { x: 17150, y: 462, w: 180, h: 16, kind: 'helper' },
  });
}
/* ------------------------------------------------- LEVEL 2: TANGLE JUNGLE */
function buildTangleJungle() {
  const K = levelKit();
  const { G, F, CR, MV, RAT, MOZZIE, CREATURE, C, SH, SIGN, EMIT, CACHE, VINE } = K;
  // MONKEY(anchorX, anchorY, vineLength, phase) — hangs from a vine at the anchor
  const MONKEY = (ax, ay, len, phase) => CREATURE('monkey', ax, ay, len, phase);

  /* --- Section 1 (0–2300): meet the monkeys somewhere safe --- */
  G(0, 1020); G(1130, 620); G(1860, 1240);
  F(560, 400, 130); F(1330, 392, 120); F(2080, 402, 120);
  // first monkey stands on its own island of ground with room to watch it
  MONKEY(850, 170, 250, 0); MONKEY(1650, 190, 220, 0.7);
  RAT(1950, 2120);
  SIGN(150, 330, 'Welcome to the jungle!');
  SIGN(470, 240, 'Monkeys throw bananas — bounce them as they swing low!');
  SIGN(1180, 330, 'Mind the gap!');
  SIGN(2210, 320, 'Checkpoint ahead!');
  C(250, 445); C(292, 445); C(334, 445);
  C(600, 358); C(642, 358);
  C(1045, 420); C(1085, 396); C(1125, 420);
  C(1370, 350); C(1412, 350);
  C(1775, 420); C(1815, 396); C(1855, 420);
  C(2120, 360); C(2162, 360);

  /* --- Section 2 (2300–5200): vines and a mixed troop --- */
  G(3160, 520); G(3980, 430); G(4650, 300); G(5420, 420);
  F(3130, 394, 96); F(4650, 356, 190);
  MV(3860, 418, 112, 100, 0, 1.25);                  // swinging vine platform
  MV(4470, 376, 118, 0, 78, 1.35, 2.1);              // rising vine lift
  RAT(2760, 3010); MONKEY(3420, 165, 255, 1.1); MOZZIE(3560, 336, 72);
  RAT(4020, 4300); MONKEY(4150, 162, 256, 1.4); MONKEY(5620, 110, 210, 2.2);
  VINE(5120, 150, 260);                              // swing the big gap
  RAT(5640, 5790, 480, 'ember');
  SIGN(2680, 320, 'Bounce the monkeys too — they turn friendly!');
  SIGN(4680, 318, 'Something glitters up high…');
  SIGN(4880, 320, 'Too far to jump — JUMP to grab the vine, JUMP to let go!');
  SH(2800, 430); SH(4090, 435);
  C(2800, 430); C(2842, 430); C(2884, 430);
  C(3178, 354);
  C(3790, 384); C(3860, 372); C(3930, 384);
  C(4470, 248);
  C(4700, 316); C(4742, 316); C(4784, 316);
  C(5010, 430); C(5245, 380); C(5330, 300);

  /* --- Section 3 (5200–7900): rotten branches and a hidden hollow --- */
  CR(5880, 438); CR(5996, 438); CR(6112, 438);
  G(6190, 300); G(6980, 340); G(7830, 290);
  F(6530, 400, 96); F(6660, 418, 104); F(6780, 348, 104); F(6900, 278, 104);

  // hidden hollow above the leaf steps
  F(7060, 188, 96); F(7215, 148, 116);
  VINE(7480, 140, 270);                              // the second swing
  MOZZIE(6820, 330, 58, 0.5);
  MONKEY(6340, 174, 246, 2.1);
  RAT(7190, 7270, 480, 'ember');
  SIGN(6620, 330, '✨ Something hides above the leaves…');
  SIGN(7250, 320, 'Swing again — and this one is wider!');
  EMIT(7105, 198, 82, 3);
  SH(5920, 385); SH(6120, 375); SH(7150, 300);
  C(5920, 398); C(6040, 398); C(6155, 398);
  C(6710, 378); C(6830, 308); C(6950, 238);
  C(7095, 153); C(7255, 113); C(7300, 113);
  C(7380, 430); C(7609, 380); C(7700, 310);
  C(7860, 400);

  /* --- Section 4 (7900–9900): the sparking canopy run --- */
  G(7940, 420); G(9480, 460);
  CR(8420, 438); CR(8540, 398); CR(9060, 340);
  MV(8740, 378, 112, 0, 78, 1.28, 4.0);
  MV(9330, 428, 112, 88, 0, 1.45, 2.6);
  F(8870, 298, 112); F(9180, 398, 96);
  RAT(8060, 8240); MONKEY(8925, 90, 170, 3.1); MONKEY(9250, 100, 200, 1.7);
  SIGN(8300, 320, 'The canopy is crackling — go!');
  SH(8480, 380); SH(8580, 340); SH(9100, 280); SH(9400, 380); SH(9700, 330);
  EMIT(8700, 300, 300, 1.5);
  C(8465, 398); C(8585, 358); C(8740, 248); C(8925, 258);
  C(9105, 300); C(9225, 358); C(9350, 388); C(9640, 410);

  CACHE(4730, 314);     // optional high ledge
  CACHE(7270, 110);     // hidden hollow

  return K.finish({
    theme: 'jungle',
    width: 9900,
    sections: [0, 2300, 5200, 7900, 9900],
    // Five, not four. Each vine gets a checkpoint on the ledge in front of it,
    // so a missed swing costs one maths question and the run-up.
    checkpoints: [
      { x: 80,   y: 480 },
      { x: 2400, y: 480 },   // ~24%
      { x: 4760, y: 480 },   // ~48% — the ledge before the first vine
      { x: 7060, y: 480 },   // ~71% — the ledge before the second
      { x: 7960, y: 480 },   // ~81%
    ],
    portal: { x: 9780, y: 380, w: 70, h: 100 },
    helper: { x: 9030, y: 462, w: 180, h: 16, kind: 'helper' },
  });
}

/* ------------------------------------------------ LEVEL 3: EMBER VOLCANO */
function buildEmberVolcano() {
  const K = levelKit();
  const { G, F, CR, MV, SP, RAT, MOZZIE, C, SH, SIGN, EMIT, CACHE, GEYSER, FALL } = K;
  const BLAZE = (x1, x2, y) => RAT(x1, x2, y, 'blaze');
  const EMBER = (x1, x2, y) => RAT(x1, x2, y, 'ember');
  const MAGMA = (x1, x2, y) => RAT(x1, x2, y, 'magma');

  /* --- Section 1 (0–2300): meet the lava, safely --- */
  G(0, 1080); G(1190, 640); G(1930, 1180);
  F(560, 402, 130); F(1400, 396, 120); F(2130, 404, 120);
  GEYSER(760, 480, 0.0);                       // the first one, on open ground
  GEYSER(2260, 480, 1.4);
  BLAZE(1250, 1430); MAGMA(1650, 1810);
  SIGN(150, 330, 'Welcome to the volcano!');
  SIGN(700, 246, 'Lava bursts up — wait for the bubbles to stop!');
  SIGN(1230, 250, 'Blaze Rats are on fire — bounce to put them out!');
  SIGN(1630, 244, 'Magma Rats spit fireballs — jump it, then bounce the rat!');
  SIGN(1560, 330, 'Mind the gap!');
  C(250, 445); C(292, 445); C(334, 445);
  C(600, 360); C(642, 360);
  C(1105, 420); C(1145, 396); C(1185, 420);
  C(1440, 354); C(1482, 354);
  C(1845, 420); C(1885, 396); C(1925, 420);
  C(2170, 362); C(2212, 362);

  /* --- Section 2 (2300–5200): the first lava waterfall --- */
  G(3180, 500); G(3990, 440); G(4680, 320); G(5100, 760);
  F(3150, 394, 96); F(4680, 352, 190); F(5020, 404, 96);
  MV(3865, 418, 112, 105, 0, 1.25);
  MV(4500, 374, 118, 0, 76, 1.35, 2.1);
  FALL(3420, 250, 480, 0.0);                   // dash through between surges
  GEYSER(3600, 480, 2.0);
  BLAZE(2800, 3040); EMBER(3200, 3400, 480); MAGMA(3480, 3620);
  EMBER(4030, 4290, 480); MAGMA(4700, 4860);
  MOZZIE(3560, 300, 66);
  BLAZE(4700, 4810, 352);
  SIGN(3300, 318, 'Lava falls in waves — run when it eases!');
  SIGN(4710, 314, 'Something glitters up high…');
  SH(2840, 430); SH(4100, 435);
  C(2840, 430); C(2882, 430); C(2924, 430);
  C(3198, 354);
  C(3800, 384); C(3870, 372); C(3940, 384);
  C(4500, 246);
  C(4730, 312); C(4772, 312); C(4814, 312);
  C(5070, 366);

  /* --- Section 3 (5200–7900): geyser field and a hidden ledge --- */
  CR(5900, 438); CR(6016, 438); CR(6132, 438);
  G(6210, 320); G(7000, 360); G(7640, 500);
  F(6560, 400, 96); F(6680, 416, 104); F(6800, 346, 104); F(6920, 276, 104);
  F(7560, 426, 88);
  F(7080, 186, 96); F(7235, 146, 116);          // secret ledge above the steps
  MV(7440, 416, 112, 60, 0, 1.2, 0.8);
  GEYSER(6300, 480, 0.4); GEYSER(6420, 480, 1.9);
  GEYSER(7060, 480, 0.9); GEYSER(7200, 480, 2.4);
  FALL(6660, 200, 416, 1.5);
  EMBER(7680, 7790, 480); EMBER(6250, 6400, 480); MAGMA(7020, 7250, 480);
  RAT(6300, 6460, 480, 'spike');
  MOZZIE(6840, 322, 58, 0.5);
  SIGN(6230, 328, 'Spiky rats: never bounce! Dodge or Cure Pulse!');
  SIGN(6640, 328, '✨ Something hides above the rocks…');
  EMIT(7125, 196, 82, 3);
  SH(5940, 385); SH(6140, 375); SH(7170, 300);
  C(5940, 398); C(6060, 398); C(6175, 398);
  C(6730, 376); C(6850, 306); C(6970, 236);
  C(7115, 151); C(7275, 111); C(7320, 111);
  C(7400, 376); C(7500, 376);
  C(7880, 400);

  /* --- Section 4 (7900–9900): the eruption run --- */
  G(7960, 440); G(9500, 460);
  CR(8440, 438); CR(8560, 398); CR(9080, 340);
  MV(8760, 376, 112, 0, 76, 1.28, 4.0);
  MV(9350, 426, 112, 86, 0, 1.45, 2.6);
  F(8890, 296, 112); F(9200, 396, 96);
  GEYSER(8120, 480, 0.6); GEYSER(8300, 480, 2.1);
  FALL(8660, 210, 440, 0.7);
  BLAZE(8020, 8120); BLAZE(8900, 8990, 296);
  EMBER(9520, 9620, 480);
  SIGN(8320, 318, 'The mountain is erupting — go!');
  SH(8500, 380); SH(8600, 340); SH(9120, 280); SH(9420, 380);
  EMIT(8720, 300, 300, 1.5);
  C(8485, 398); C(8605, 358); C(8760, 246); C(8945, 256);
  C(9125, 300); C(9245, 356); C(9370, 386); C(9660, 410);

  CACHE(4760, 310);     // optional high ledge
  CACHE(7290, 108);     // secret ledge

  return K.finish({
    theme: 'volcano',
    width: 9900,
    sections: [0, 2300, 5200, 7900, 9900],
    checkpoints: [
      { x: 80,   y: 480 },
      { x: 2420, y: 480 },   // ~25%
      { x: 5480, y: 480 },   // ~56%
      { x: 7990, y: 480 },   // ~81%
    ],
    portal: { x: 9790, y: 380, w: 70, h: 100 },
    helper: { x: 9040, y: 460, w: 180, h: 16, kind: 'helper' },
  });
}

/* ----------------------------------------------------- LEVEL 4: GLOW CITY */
/* Sean's spec: a city with large glowing green rats and toxic slime. The
   headline is the RISING slime — TWO staged chases making up the whole middle
   of the level, the first at 19%. He then asked for both to be harder, with
   smaller platforms and bigger gaps between them.

   The step sizing follows one rule. A full-power jump from a step's edge
   carries Dex about 166px while he is still above the next step's height, so
   a landing step must be at least (166 - gap + 40) wide or a committed jump
   sails straight over it. Widen the gap and the step gets SMALLER — which is
   exactly the shape Sean asked for, and it stays fair because every jump is
   the same jump: run to the edge and go. Nothing here needs a half-press.

     stage one   gaps  55 → 105   steps 150 → 100
     stage two   gaps  60 → 132   steps 146 →  74

   Rules paid for in blood, do not undo:
     - the street STOPS at a flood, or sprinting underneath beats the climb
     - NOTHING hovers over a staircase; a knock mid-step drops you in it
     - nothing on the route may need more than Dex's 131px jump               */
function buildGlowCity() {
  const K = levelKit();
  const { G, F, CR, MV, RAT, MOZZIE, C, SH, SIGN, EMIT, CACHE, SLIME, FLOOD } = K;
  const GLOW = (x1, x2, y) => RAT(x1, x2, y, 'glow');

  /* --- Section 1 (0–1800): a short street, just long enough to teach --- */
  G(0, 1100); G(1210, 900);
  F(580, 400, 130); F(1420, 394, 120);
  SLIME(760, 90); SLIME(1330, 80);
  RAT(880, 1050); GLOW(1600, 1800); MOZZIE(1155, 336, 54, 0.4);
  SIGN(150, 330, 'Welcome to Glow City!');
  SIGN(700, 246, 'Toxic slime — green means jump!');
  SIGN(1540, 250, 'Glow Rats are big: bounce TWICE to cure them!');
  SH(420, 430); SH(1320, 424);
  C(250, 445); C(292, 445); C(334, 445);
  C(620, 358); C(662, 358);
  C(1125, 420); C(1165, 396); C(1205, 420);
  C(1460, 352); C(1502, 352);
  C(1700, 430); C(1742, 430);

  /* --- Section 2 (1800–6500): THE FLOOD, twice --- */
  /* Stage one. Road ends at 2110; the steps shrink and spread as you climb. */
  RAT(1950, 2060);                             // the gate before the climb
  SIGN(1900, 320, '⚠ This street floods with slime!');
  SIGN(2110, 250, '⬆ Run to the edge and JUMP — do not stop!');
  F(2165, 430, 150); F(2380, 392, 140); F(2595, 354, 130);
  F(2810, 316, 120); F(3025, 278, 110); F(3240, 240, 100);
  F(3440, 202, 300);                           // roof one
  FLOOD(2020, 3660, 528, 254);
  MOZZIE(3600, 140, 36, 0.4);                  // above the roof, safe to miss
  EMIT(2600, 470, 1000, 2);
  SH(2210, 400); SH(2860, 286); SH(3540, 178);
  C(1950, 430); C(2050, 430);
  C(2240, 396); C(2450, 358); C(2660, 320);
  C(2870, 282); C(3080, 244); C(3290, 206);
  C(3520, 168); C(3562, 168);

  /* Dry rooftop street, a breather, and the checkpoint between the two. */
  G(3820, 420);
  RAT(4040, 4160);
  SIGN(3860, 320, '⚠ Again — smaller ledges, wider gaps!');
  C(3900, 430); C(4000, 430);

  /* Stage two. Taller, longer, and the last ledges are barely wider than Dex. */
  F(4300, 434, 146); F(4518, 396, 134); F(4736, 358, 122);
  F(4954, 320, 110); F(5172, 282, 98);  F(5390, 244, 86);
  F(5608, 206, 74);  F(5800, 168, 300);        // roof two
  FLOOD(4180, 6020, 528, 230);
  MOZZIE(5930, 106, 34, 0.6);
  EMIT(4800, 470, 1100, 2);
  SH(4370, 404); SH(5220, 250); SH(5930, 144);
  C(4373, 400); C(4585, 362); C(4797, 324); C(5009, 286);
  C(5221, 248); C(5433, 210); C(5645, 172);
  C(5900, 134); C(5942, 134);
  CACHE(5990, 132);                            // for climbing stage two fastest

  /* --- Section 3 (6500–8300): rooftops and pools, a breather with teeth --- */
  G(6180, 320); G(6700, 520); G(7520, 450);
  F(6600, 398, 96);
  MV(7420, 418, 112, 100, 0, 1.25);
  SLIME(6800, 120); SLIME(7560, 110);
  RAT(6380, 6460); GLOW(6950, 7120); MOZZIE(7100, 336, 48, 0.2);
  RAT(7750, 7900);
  SIGN(6900, 318, 'The whole street is leaking slime!');
  SH(6760, 430); SH(7660, 435);
  C(6280, 430); C(6380, 430);
  C(6640, 364);
  C(7000, 430); C(7042, 430);
  C(7320, 384); C(7420, 372); C(7520, 384);
  C(7700, 430);

  /* The way into section 4: one ordinary step across, then a drop. The high
     ledge above it is a REWARD, not the route — the route must never need
     more than Dex can jump. */
  F(8040, 418, 120);
  F(8240, 310, 150);
  SIGN(8020, 330, 'Something glitters above the rooftops…');
  SH(8300, 290);
  C(8080, 384); C(8122, 384);
  C(8290, 276); C(8332, 276); C(8374, 276);
  CACHE(8310, 268);                            // optional high ledge

  /* --- Section 4 (8300–10400): the last climb to the portal --- */
  G(8240, 620); G(9940, 400);
  SLIME(8420, 110); SLIME(8550, 90);
  GLOW(8660, 8770); MOZZIE(8740, 380, 46, 0.3);
  CR(8900, 470); CR(9040, 424); CR(9180, 378);
  F(9330, 330, 120); F(9770, 350, 120);
  MV(9610, 300, 112, 70, 0, 1.3);
  SIGN(8640, 318, 'Nearly there — the portal is above the rooftops!');
  EMIT(9020, 300, 260, 1.5);
  SH(8920, 430); SH(9360, 290); SH(9820, 310); SH(10060, 430);
  C(8360, 430);
  C(8945, 436); C(9085, 390); C(9225, 344);
  C(9390, 296); C(9610, 266); C(9830, 316);
  C(10090, 430);

  return K.finish({
    theme: 'city',
    width: 10400,
    sections: [0, 1800, 6500, 8300, 10400],
    // Five, not the usual four. The two-stage flood needs its own checkpoint
    // either side or a slip in stage two makes you replay stage one.
    checkpoints: [
      { x: 80,   y: 480 },
      { x: 1860, y: 480 },   // ~18% — the run-up to stage one
      { x: 3920, y: 480 },   // ~38% — the dry roof between the two
      { x: 6280, y: 480 },   // ~60% — safely past stage two
      { x: 8300, y: 480 },   // ~80% — the final climb
    ],
    portal: { x: 10240, y: 380, w: 70, h: 100 },
    helper: { x: 9440, y: 462, w: 180, h: 16, kind: 'helper' },
  });
}

/* ------------------------------------------- LEVEL 5: THE RAT KING'S SEWER */
/* Sean's brief, in order: Dex slides in on his backside down a long chute,
   dodging and jumping as he goes; then a normal level through the sewer; then
   King Ratthew. The King is drawn large-but-not-literal — the story keeps its
   "fifty times bigger", the sprite only has to fit on a 960px screen.

   THE CHUTE is the opening set piece, about twenty seconds long. One button
   does two jobs: jump OVER the bumps and holes, and DON'T jump under the low
   pipes. The profile is deliberately asymmetric — short steep drops where he
   picks up speed, longer shallow rises where the obstacles sit — so the pace
   surges and eases instead of running flat.                                */
function buildRatKingSewer() {
  const K = levelKit();
  const { G, F, CR, MV, RAT, MOZZIE, SH, SIGN, EMIT, CACHE, FALL, CHUTE } = K;
  // C(x, 0) on the chute means "38px above the slide at that x" — the descent
  // is 2,600px deep and hand-placing them would be miserable.
  let CH_ = null;
  const C = (x, y) => (y === 0 && CH_) ? K.C(x, chuteY(CH_, x) - 38) : K.C(x, y);

  /* --- Section 1 (0–5400): THE LONG DROP --- */
  /* One continuous descent, 2,600px of it, and the camera comes down with him.
     The gradient never goes negative — it only eases and steepens — so it
     reads as one long slide rather than a series of humps. Everything on it
     is a creature: rats crouched on the chute to jump (or land on and cure),
     and swarms strung across the pipe you have to stay LOW under. */
  F(40, 300, 400);                             // the lip of the storm drain
  SIGN(120, 150, "Nova's trail goes down the drain…");
  SIGN(300, 216, '⬇ Press SPACE to slide!');
  C(150, 254); C(220, 254); C(290, 254);
  const CH = CH_ = CHUTE(chuteFromGrades(440, 300, [
    [260, 0.30], [300, 0.52], [280, 0.38], [320, 0.62], [280, 0.40],
    [300, 0.58], [260, 0.34], [320, 0.66], [280, 0.42], [300, 0.60],
    [260, 0.36], [320, 0.64], [280, 0.44], [300, 0.56], [280, 0.38],
    [320, 0.62], [300, 0.46],
  ]));
  CH.rat(900);                                 // ease in: one rat, nothing else
  CH.swarm(1400);                              // then the first swarm — stay down
  CH.rat(1900);
  CH.gap(2400, 2470);
  CH.swarm(3100);
  CH.rat(3600);
  CH.gap(4100, 4170);
  CH.swarm(4800);
  CH.exitTo(5320, 300);                        // shot out of a pipe into the sewer
  C(700, 0); C(1150, 0); C(1650, 0); C(2150, 0);
  C(2800, 0); C(3350, 0); C(3850, 0); C(4450, 0); C(5100, 0);

  /* --- Section 2 (5400–8200): the sewer proper --- */
  // The chute spits him out here. Its far end is set to y480 by the profile
  // above, so the splash landing lines up with ordinary sewer floor and the
  // camera can ease back to level.
  G(5280, 920);                                // the splash landing
  F(6280, 396, 110);
  G(6420, 520);
  F(7000, 400, 96);
  G(7140, 460);
  CR(7660, 452); CR(7800, 452);
  MV(8040, 400, 112, 80, 0, 1.2);              // a valve wheel turning
  FALL(6000, 240, 480, 0.0);                   // sludge pouring from a broken main
  FALL(6800, 250, 480, 1.6);
  RAT(5480, 5700); RAT(6480, 6700); MOZZIE(6200, 330, 60, 0.3);
  RAT(7200, 7380, 480, 'bloat'); MOZZIE(7500, 320, 54, 0.8);
  SIGN(5360, 320, 'Welcome to the sewer. Mind the sludge.');
  SIGN(7160, 320, 'Bloat Rats are big: bounce TWICE!');
  SH(5600, 430); SH(6560, 430); SH(7300, 430);
  EMIT(6020, 300, 200, 1.4);
  C(5440, 430); C(5482, 430);
  C(6100, 430); C(6142, 430);
  C(6330, 362); C(6520, 430);
  C(7050, 366); C(7200, 430); C(7242, 430);
  C(7730, 410); C(8040, 366);

  /* --- Section 3 (8200–10200): the throne approach, Nova in sight --- */
  G(8200, 480); G(9200, 420); G(10000, 2400);   // floor runs to the level edge
  CR(8720, 448); CR(8860, 448);
  F(9000, 386, 110); F(9280, 366, 120);
  MV(9800, 400, 112, 90, 0, 1.28, 2.0);
  FALL(8460, 230, 480, 0.8);
  RAT(8520, 8620); RAT(9240, 9420, 480, 'bloat');
  MOZZIE(9100, 316, 58, 0.4);
  SIGN(8220, 320, 'Dex! Up here — he wears the crown on his HEAD!');
  SIGN(9640, 318, 'Knock the crown off and he turns back!');
  SH(8400, 430); SH(9300, 430); SH(10100, 430);
  EMIT(8480, 300, 220, 1.2);
  C(8300, 430); C(8342, 430);
  C(8760, 410); C(9050, 352);
  C(9340, 332); C(9500, 430); C(9542, 430);
  C(9800, 366);
  CACHE(9340, 324);                            // last cache in the game

  /* --- Section 4 (10200–12400): the throne room --- */
  // Three tiers either side, 76–88px apart so every step is an easy jump.
  // The top pair sit level with his crown, which is the only way to come down
  // on it while he is standing up straight.
  F(10500, 392, 170); F(10740, 316, 190);
  F(11260, 316, 190); F(11470, 392, 170);
  SIGN(10260, 320, '👑 King Ratthew the Third!');
  SH(10500, 430); SH(11200, 430); SH(11900, 430);
  C(10580, 352); C(10800, 276); C(10880, 276);
  C(11320, 276); C(11400, 276); C(11550, 352);

  return K.finish({
    theme: 'sewer',
    width: 12400,
    sections: [0, 5400, 8200, 10200, 12400],
    checkpoints: [
      { x: 120,   y: 300 },              // up on the drain lip
      { x: 2700,  y: 0, slide: true },   // partway down the chute, well clear
      { x: 5340,  y: 480 },              // the splash landing
      { x: 8260,  y: 480 },              // the throne approach
      { x: 10060, y: 480 },              // the arena door
    ],
    portal: { x: 12160, y: 380, w: 70, h: 100 },
    helper: { x: 8820, y: 462, w: 180, h: 16, kind: 'helper' },
    boss: { x: 11100, floor: 480 },
    cage: { x: 11840, y: 396, w: 84, h: 84, open: false },
  });
}

/* ------------------------------------------------------- LEVEL REGISTRY --
   Each entry is one adventure. `build` returns fresh level data (so replaying
   always starts clean); a null `build` means the level is designed but not yet
   authored, and shows as "coming soon" in the picker. Completing a level for
   the first time unlocks the matching power-up in POWERUP_ORDER.            */
const LEVELS = [
  { id: 'canyon', name: 'Crystal Canyon', icon: '🏞',
    blurb: 'Rolling meadows and crystal cliffs', build: buildCrystalCanyon },
  { id: 'jungle', name: 'Tangle Jungle', icon: '🌴',
    blurb: 'Vines, sparking monkeys and Glitch Rats', build: buildTangleJungle },
  { id: 'volcano', name: 'Ember Volcano', icon: '🌋',
    blurb: 'Lava geysers, waterfalls and rats on fire', build: buildEmberVolcano },
  { id: 'city', name: 'Glow City', icon: '🏙',
    blurb: 'Giant green rats and toxic slime', build: buildGlowCity },
  { id: 'sewer', name: "The Rat King's Sewer", icon: '🕳',
    blurb: 'Deep down where King Ratthew hides', build: buildRatKingSewer, boss: true },
];
let levelIndex = 0;
let LEVEL = LEVELS[0].build();
function loadLevel(i) {
  levelIndex = clamp(i, 0, LEVELS.length - 1);
  LEVEL = LEVELS[levelIndex].build();
  initBoss();
  return LEVEL;
}
// a level can be played once the one before it has been finished.
// Debug mode opens every built level so they can be tested in any order.
function levelUnlocked(i) {
  if (!LEVELS[i].build) return false;
  if (DEBUG_MODE) return true;
  return i === 0 || !!(save.levelDone && save.levelDone[i - 1]);
}

/* --------------------------------------------- 8. GAME STATE & ENTITIES */
const game = {
  state: 'title',            // title | treehouse | playing | dying | math | paused | victory
  time: 0,
  deaths: 0, sectionDeaths: [0, 0, 0, 0],   // internal analytics — UI says "zaps"
  crystals: 0, totalCrystals: LEVEL.crystals.length,
  cures: 0, secrets: 0, newUnlockNames: [],
  checkpoint: 0, maxX: 0,
  invuln: 0, deathTimer: 0,
  assistLevel: 0, deathSpots: [], localZone: null,
  stats: { questions: 0, firstTry: 0, wrongAttempts: 0 },
  pausedFrom: 'playing',
};
const player = {
  x: 80, y: 436, w: TUNING.player.width, h: TUNING.player.height,
  vx: 0, vy: 0, grounded: false, coyote: 0, buffer: 0,
  support: null, face: 1, anim: 0,
  squash: 0, blinkT: 0, blinkNext: 2.5, prevGrounded: true, prevVy: 0,
  big: true,                    // false = shrunk; the next hit zaps him
  jumpFromY: 436,                          // the ground he last left, for the boots
  launchT: 0,                              // geode launch is jump-cut immune
  flight: false, flightT: 0,               // mid-catapult-arc
  vine: null, vineHoldT: 0, vineCool: 0,   // the vine he's swinging on, if any
  chute: null, sliding: false,             // the slide, if he's on one
};
const power = { id: null, charges: 0 };
// King Ratthew's fight. Only ever populated on a level whose data carries a
// `boss` block, which is Level 5 and nothing else.
let boss = null, bossWaves = [], bossRocks = [];
let slowT = 0;                 // Time Bubble seconds remaining
let rings = [];                // cure-pulse ripples
let bolts = [];                // electric bolts fired by Glitch Monkeys
let mathContext = 'zap';       // 'zap' (respawn) | 'build' (treehouse workshop)
let buildTarget = null;        // power-up id being built in the workshop
let roomT = 0;                 // treehouse animation clock
let thRatsDeco = [];           // rescued rats wandering the treehouse floor

// The walkable treehouse room. Drawn in its own smaller coordinate space and
// scaled up on screen, so Dex and the furniture read bigger and cosier than
// they do out in the canyon. All room coordinates below are ROOM space.
const ROOM_W = 768, ROOM_H = 432, ROOM_SCALE = VIEW_W / ROOM_W;  // 1.25×
const ROOM_FLOOR = 384;
const TREEHOUSE = {
  width: ROOM_W, floor: ROOM_FLOOR, scale: ROOM_SCALE,
  // only the floor is solid — furniture is scenery, so nothing can ever block
  // the walk between the workshop and the door
  solids: [
    { x: -40, y: ROOM_FLOOR, w: ROOM_W + 80, h: 80, kind: 'floor' },
    // Walls. Without these the only thing stopping Dex was the world clamp at
    // x = ROOM_W - his width, which sits at EXACTLY the viewport edge: his
    // whiskers rendered past 960 on the right and his tail past 0 on the left,
    // so he looked like he was walking out of the picture. These stop him with
    // the whole sprite still on screen, and still well inside the 56px reach
    // of the door station at x 716.
    { x: -60, y: 0, w: 80, h: ROOM_FLOOR, kind: 'wall' },   // stops him at x 20
    { x: 724, y: 0, w: 80, h: ROOM_FLOOR, kind: 'wall' },   // stops him at x 694
  ],
  chair: { x: 176, y: 338, w: 56, h: 10 },   // Nova's empty chair (decorative)
  stations: [
    { type: 'slot', id: 'shield', x: 380 },
    { type: 'slot', id: 'boots',  x: 464 },
    { type: 'slot', id: 'time',   x: 548 },
    { type: 'slot', id: 'pulse',  x: 632 },
    { type: 'door', x: 716 },
  ],
  // wall furniture, in room space
  window:  { x: 24,  y: 50,  w: 112, h: 108 },
  desk:    { x: 18,  y: 316, w: 150 },
  board:   { x: 190, y: 84,  w: 140, h: 168 },
  bench:   { x: 340, y: 322, w: 332 },
  pegTop:  178,                                  // top of the workshop pegboard
  door:    { x: 671, y: 236, w: 92, h: ROOM_FLOOR - 236 },
};
let ambient = { motes: [], sparks: [], steam: [] };
let camX = 0;
// The camera has only ever panned sideways. The slide needs it to follow Dex
// DOWN as well, or a continuous descent can't be more than 240px long before
// he's off the bottom of the screen. camY is zero everywhere except on a
// chute, and eases back to zero the moment he's off one, so nothing else in
// the game is affected by it.
let camY = 0;
let particles = [];
let shakeMag = 0, hitstop = 0, fadeAlpha = 0;
let currentQ = null, attemptsThisQ = 0, answerLocked = false;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const overlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inset = (r, n) => ({ x: r.x + n, y: r.y + n, w: r.w - 2 * n, h: r.h - 2 * n });

function coyoteTime() {
  const A = TUNING.assist;
  return (TUNING.player.coyoteMs + (game.assistLevel >= 1 ? A.level1CoyoteBonusMs : 0)) / 1000;
}
function protectionTime() {
  const A = TUNING.assist;
  return (game.assistLevel >= 2 ? A.level2SpawnProtectionMs
                                : TUNING.player.spawnProtectionMs) / 1000;
}
function speedMult(x) {
  const A = TUNING.assist;
  let m = 1;
  if (game.assistLevel === 1) m *= A.level1SpeedMult;
  if (game.assistLevel >= 2) m *= A.level2SpeedMult;
  if (game.localZone && Math.abs(x - game.localZone.x) < A.localRadius) m *= A.localSpeedMult;
  return m;
}
// How fast the world runs. 1 normally, 0 inside a Time Bubble. Dex is never
// multiplied by it — that is the whole point of the power-up.
const slowFactor = () => slowT > 0 ? TUNING.powerups.timeSlowFactor : 1;
function sectionOf(x) {
  const s = LEVEL.sections;
  for (let i = s.length - 2; i >= 0; i--) if (x >= s[i]) return i;
  return 0;
}
function activeSolids() {
  const arr = LEVEL.solids.concat(LEVEL.movers);
  for (const c of LEVEL.crumblers) if (c.state !== 'gone') arr.push(c);
  if (game.assistLevel >= 2) arr.push(LEVEL.helper);
  return arr;
}
function burst(x, y, color, count = 14, spread = 220) {
  count = Math.max(3, Math.round(count * fxScale()));
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * spread;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80,
                     life: 0.5 + Math.random() * 0.5, max: 1, color,
                     r: 2 + Math.random() * 3 });
  }
}
function addShake(m) {
  if (!save.settings.reducedFx) shakeMag = Math.max(shakeMag, m);
}

// Grow/shrink Dex, keeping his feet planted. Shrinking is always safe;
// growing only happens on a fresh start, where the ground is known to be clear.
function setPlayerBig(big) {
  const T = TUNING.player;
  const s = big ? 1 : T.smallScale;
  const nw = Math.round(T.width * s), nh = Math.round(T.height * s);
  player.y += player.h - nh;          // keep the feet where they were
  player.w = nw; player.h = nh;
  player.big = big;
}
function shrinkPlayer() {
  if (!player.big) return false;
  setPlayerBig(false);
  game.invuln = TUNING.player.shrinkInvulnMs / 1000;
  player.squash = 0.3;
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  burst(px, py, '#ffd24d', 14, 200);
  rings.push({ x: px, y: py, r: 16, max: 60, life: 0.35, maxLife: 0.35 });
  addShake(1.6);
  hitstop = Math.max(hitstop, 0.06);
  sfx.shrink();
  toast('Ouch! You got small — one more hit and you\'re zapped!');
  updateHud();
  return true;
}
function dropChute() { player.chute = null; player.sliding = false; }
// Everything that has taken hold of Dex's movement, let go at once. Any code
// that moves him somewhere new must call this, or that somewhere inherits the
// last place's physics.
function clearMovementState() {
  dropVine(); dropChute();
  player.flight = false; player.flightT = 0;
  player.launchT = 0;
  player.vx = 0; player.vy = 0;
}
function dropVine() {
  player.vine = null; player.vineHoldT = 0; player.vineCool = 0;
  for (const v of LEVEL.vines) { v.theta = 0; v.omega = 0; }
}
function placeAtCheckpoint() {
  for (const fl of LEVEL.floods) { fl.y = fl.startY; fl.active = false; }
  clearMovementState();
  const cp = LEVEL.checkpoints[game.checkpoint];
  setPlayerBig(true);                 // always start a life at full size
  player.x = cp.x; player.y = cp.y - player.h - 2;
  if (cp.slide) {                     // a checkpoint partway down the chute
    const c = LEVEL.chutes.find(ch => cp.x >= ch.x1 && cp.x <= ch.x2);
    if (c) { startSlide(c); player.y = chuteY(c, cp.x + player.w / 2) - player.h; }
  }
  // Snap the camera to him instead of panning to it. This matters more than it
  // looks: two thousand pixels down a chute, a camera still sitting at zero
  // puts him "below the screen" and the fall check zaps him on the first frame
  // of his own respawn.
  camX = clamp(player.x - TUNING.camera.offsetX, 0, LEVEL.width - VIEW_W);
  camY = player.sliding ? Math.max(0, player.y - TUNING.camera.slideOffsetY) : 0;
  player.vx = 0; player.vy = 0;
  player.grounded = true; player.support = null;
  player.coyote = 0; player.buffer = 0; player.squash = 0; player.launchT = 0;
  player.flight = false; player.flightT = 0;
  camX = clamp(player.x - TUNING.camera.offsetX, 0, LEVEL.width - VIEW_W);
}
function resetEntities() {
  // the King's summons are transient: clear them rather than reviving them
  if (boss) LEVEL.enemies = LEVEL.enemies.filter(e => !e.fromKing);
  for (const e of LEVEL.enemies) {
    e.alive = true; e.cured = false; e.cureTimer = 0; e.warn = 0; e.vy = 0;
    e.warmup = false; e.breathing = false; e.fireT = (e.x1 * 0.37) % 2;
    if (e.type !== 'mozzie') { e.x = e.x1; e.dir = 1; e.y = e.y0; }
  }
  for (const c of LEVEL.crumblers) { c.state = 'ok'; c.timer = 0; }
}
/* Every crystal Dex picks up goes through here, so the "one spare life per 25"
   rule has exactly one home and cannot drift out of step with the counter. */
function awardCrystals(n) {
  game.crystals += n;
  save.crystalsToLife += n;
  let gained = 0;
  while (save.crystalsToLife >= LIVES.crystalsPerExtra && save.lives < LIVES.max) {
    save.crystalsToLife -= LIVES.crystalsPerExtra;
    save.lives++; gained++;
  }
  if (save.lives >= LIVES.max) save.crystalsToLife = 0;   // no pointless hoarding
  if (gained > 0) {
    persist();
    sfx.unlock();
    popLives();
    toast(`⭐ 25 crystals! Dex earned a spare life — 🐱 × ${save.lives}`);
  }
  updateHud();
}
// spend one, and say whether Dex has anything left
function spendLife() {
  save.lives = Math.max(0, save.lives - 1);
  persist();
  popLives();
  updateHud();
  return save.lives > 0;
}
function popLives() {
  if (!ui.livesChip) return;
  ui.livesChip.classList.remove('lifePop');
  void ui.livesChip.offsetWidth;              // restart the animation
  ui.livesChip.classList.add('lifePop');
}
/* Out of lives. The run is over; the world state (power-ups, blueprints,
   finished levels) is untouched — only the spare lives are spent. */
function gameOver() {
  if (game.state === 'gameover') return;
  // if the overlay isn't in the page at all, do the kind thing rather than
  // stranding a child in a state with no way out
  if (!ui.overlayGameOver) {
    toast('😿 Out of spare lives — here are nine more!', 4);
    restartAdventure();
    return;
  }
  game.state = 'gameover';
  input.left = input.right = input.jump = input.jumpPressed = false;
  currentQ = null;
  bolts = [];
  ui.overlayMath.classList.add('hidden');
  ui.gameOverLives.textContent = '🐱 × 0';
  ui.gameOverText.textContent =
    `Dex ran out of spare lives in ${LEVELS[levelIndex].name}. Every cat gets nine more tries — have another go!`;
  ui.overlayGameOver.classList.remove('hidden');
  updateHud();
  // a short falling phrase, built from the existing tone engine so there is no
  // new sfx entry that could go missing (a missing one froze the game once)
  [[392, 0], [330, 190], [262, 380], [196, 600]].forEach(([f, ms]) =>
    setTimeout(() => AudioSys.tone(f, 0.34, { type: 'triangle', vol: 0.09 }), ms));
}
function restartAdventure() {
  save.lives = LIVES.start;
  persist();
  beginAdventure(levelIndex);
  popLives();
  toast(`🐱 Nine fresh lives — good luck, Dex!`);
}

function beginAdventure(index = levelIndex) {
  // NOTE: save.lives is deliberately NOT reset here — lives persist across
  // levels. The only guard is against starting a run with nothing to spend.
  if (save.lives <= 0) { save.lives = LIVES.start; persist(); }
  loadLevel(index);                 // fresh level data every run — nothing stale
  game.state = 'playing';
  game.time = 0; game.deaths = 0;
  game.sectionDeaths = new Array(Math.max(1, LEVEL.sections.length - 1)).fill(0);
  game.crystals = 0; game.totalCrystals = LEVEL.crystals.length;
  game.cures = 0; game.secrets = 0; game.newUnlockNames = [];
  game.checkpoint = 0; game.maxX = 0;
  game.invuln = 0; game.deathTimer = 0;
  game.assistLevel = 0; game.deathSpots = []; game.localZone = null;
  game.stats = { questions: 0, firstTry: 0, wrongAttempts: 0 };
  rebuildProgressTicks();
  particles = []; rings = []; bolts = [];
  slowT = 0; shakeMag = 0; hitstop = 0; fadeAlpha = 1;
  const eq = save.equipped && save.built[save.equipped] ? save.equipped : null;
  power.id = eq;
  power.charges = eq ? POWERUPS[eq].max : 0;
  MathQuiz.reset();
  mathContext = 'zap'; buildTarget = null;
  input.left = input.right = input.jump = input.jumpPressed = false;
  placeAtCheckpoint();
  ['overlayTitle', 'overlayMath', 'overlayPause', 'overlayVictory', 'overlayGameOver', 'overlayLevels']
    .forEach(k => ui[k].classList.add('hidden'));
  ui.overlaySettings.classList.add('hidden');
  ui.progress.classList.remove('hidden');
  updateHud();
}

/* -------------------------------------------------- 9. UPDATE & POWER-UPS */
function activatePower() {
  if (game.state !== 'playing') return;
  if (!power.id) { toast('No power-up yet — build one in your treehouse workshop!'); return; }
  const def = POWERUPS[power.id];
  if (def.passive) { toast('🫧 Bubble Shield protects you all by itself!'); return; }
  if (power.charges <= 0) {
    toast('No charge left — a maths question will recharge it!');
    return;
  }
  const P = TUNING.powerups;
  if (power.id === 'boots') {
    // the boots are really a double jump now; the button is just another way in
    if (player.grounded) { toast('Jump, then press jump again for a big spring!'); return; }
    if (player.vine) releaseVine();     // spring off the vine rather than through it
    if (!canSpring()) return;
    springJump();
  } else if (power.id === 'time') {
    power.charges--;
    slowT = P.timeDurationS;
    sfx.slowmo();
    toast('⏳ Time Bubble! Everything freezes but you!');
  } else if (power.id === 'pulse') {
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    let best = null, bestD = P.pulseRadius;
    for (const e of LEVEL.enemies) {
      if (!e.alive || e.cured || e.type === 'slug') continue;
      const r = enemyRect(e);
      const d = Math.hypot(r.x + r.w / 2 - px, r.y + r.h / 2 - py);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) { toast('No Glitch creature in range!'); return; }
    power.charges--;
    rings.push({ x: px, y: py, r: 14, max: P.pulseRadius + 20, life: 0.5, maxLife: 0.5 });
    cure(best);
  }
  updateHud();
}

function cure(e) {
  e.cured = true;
  e.cureTimer = 2.2;
  e.dir = (player.x + player.w / 2 < e.x + e.w / 2) ? 1 : -1;
  e.fleeDir = e.dir;
  game.cures++;
  save.ratsRescued++;
  persist();
  awardCrystals(1);                              // rescue bonus
  const r = enemyRect(e);
  burst(r.x + r.w / 2, r.y + r.h / 2, '#c07dff', 18, 200);
  burst(r.x + r.w / 2, r.y + r.h / 2, '#ffd24d', 6, 120);
  addShake(1.5);
  hitstop = Math.max(hitstop, 0.06);
  sfx.cure();
  toast(save.ratsRescued === 1
    ? 'You cured a Glitch Rat! 🐀💛 +1 ⭐'
    : 'Cured! 💛 +1 ⭐');
}

function update(dt) {
  if (hitstop > 0) { hitstop -= dt; return; }
  game.time += dt;
  if (slowT > 0) slowT -= dt;
  // wdt is world time: zero while the Time Bubble holds. Dex, the camera and
  // the purely decorative sparkles keep real time, so the screen still feels
  // alive rather than broken while everything that can hurt her stands still.
  const wdt = dt * slowFactor();
  updateMovers(wdt);
  carryPlayer();
  updatePlayerPhysics(dt);
  updateCrumblers(wdt);
  updatePads(dt);
  updateEnemies(wdt);
  checkHazards();
  checkPickupsAndGoals();
  updateParticles(dt);
  updateRings(dt);
  updateBolts(wdt);
  updateGeysers(wdt);
  updateFalls(wdt);
  updateSlimes(dt);
  updateFloods(wdt);
  updateBoss(wdt);
  updateEmitters(dt);
  updateCamera(dt);
  shakeMag *= Math.exp(-6 * dt);
  if (game.invuln > 0) game.invuln -= dt;
  game.maxX = Math.max(game.maxX, player.x);
  updateHud();
}

function updateMovers(dt) {
  const sf = slowFactor();
  for (const m of LEVEL.movers) {
    m.angle += m.omega * speedMult(m.cx) * sf * dt;
    const nx = m.cx + Math.sin(m.angle) * m.rangeX - m.w / 2;
    const ny = m.cy + Math.sin(m.angle) * m.rangeY;
    m.dx = nx - m.x; m.dy = ny - m.y;
    m.x = nx; m.y = ny;
  }
}
function carryPlayer() {
  const s = player.support;
  if (s && s.isMover) { player.x += s.dx; player.y += s.dy; }
}
/* ------------------------------------------------------------- BOSS ----
   King Ratthew the Third. FIVE crown hits, and one loop repeated:

     he blasts the ceiling  →  rock rains down, every piece shadowed on the
     floor  →  Dex dodges through it  →  climbs a shelf  →  jumps on his crown

   He also fires beams straight at Dex (they track him for the first half of
   the wind-up, then commit, so moving is the answer) and every few seconds
   LEAPS at him, landing where he stood. He stands at full height throughout —
   no folding, no crouching — so the two shelves are the route to his head.

   Everything speeds up as the jewels come off (bossPace), he only ever does
   one thing at a time (busy / breatherS), and being zapped never resets his
   phase — losing on the last jewel and starting again would be miserable.

   Design history worth knowing: this fight has been rebuilt several times. It
   once had three phases each demanding a different verb, including grabbing
   his tail like a jungle vine. That was cut — a vine appearing out of nowhere
   while he announced his own tail was baffling rather than clever. If a
   mechanic here needs explaining, it is wrong.                           */
function initBoss() {
  boss = null; bossWaves = []; bossRocks = [];
  const b = LEVEL.boss;
  if (!b) return;
  const T = TUNING.boss;
  boss = { x: b.x, floor: b.floor, w: T.w, h: T.h, scale: 1, home: b.x,
           hp: 5, phase: 1, state: 'idle', t: 0, cured: 0, face: -1,
           leapT: 0, leapFrom: 0, leapTo: 0, winded: 0, busy: 0,
           headDown: 0, hurt: 0, shout: '', shoutT: 0,
           laserT: 0, laser: null, lookUp: 0,
           entered: false, cardT: 0, musicT: 0, musicIdx: 0,
           crownArmed: true };
}
function bossSquash() {
  // He no longer folds up at all — Sean cut it, and he was right, a rat bent
  // double looked like a bug rather than a tell. He stands at full height and
  // you come down on him from the ledges. The ONLY shape change left is
  // rearing up to leap, which now has the tell to itself.
  let sq = 1;
  if (boss.state === 'leap' && boss.t < TUNING.boss.leapWarnS) {
    sq *= 1 + 0.30 * clamp(boss.t / TUNING.boss.leapWarnS, 0, 1);
  }
  return sq;
}
function bossRect() {
  const w = boss.w * boss.scale, h = boss.h * boss.scale * bossSquash();
  return { x: boss.x - w / 2, y: boss.floor - h + (boss.leapY || 0), w, h };
}
function bossCrownRect() {
  const T = TUNING.boss, r = bossRect();
  const w = T.crownW * boss.scale, h = T.crownH * boss.scale;
  return { x: r.x + r.w / 2 - w / 2, y: r.y - h + 8, w, h };
}
function bossEye() {
  const r = bossRect(), u = boss.lookUp;
  // as he throws his head back the eye rises and draws in towards his shoulders
  return { x: r.x + r.w / 2 + boss.face * r.w * (0.26 - 0.10 * u),
           y: r.y + r.h * 0.16 + 4 - 52 * u * boss.scale };
}
// Where the beam ends up: straight up for a roof shot, otherwise along the
// line from his eye through wherever Dex was when it fired, run out to the
// far side of the room.
function bossLaserEnd(l) {
  const e = l.from;
  if (l.up) return { x: e.x, y: -60 };
  const dx = l.aim.x - e.x, dy = l.aim.y - e.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  return { x: e.x + (dx / len) * 1500, y: e.y + (dy / len) * 1500 };
}
// distance from a point to a segment — the beam is a line, not a box, now
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}
function bossLaserHits(l, r) {
  const e = l.from, end = bossLaserEnd(l);
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  return segDist(cx, cy, e.x, e.y, end.x, end.y) < TUNING.boss.laserH / 2 + 13;
}
function bossStartLaser() {
  const T = TUNING.boss;
  const up = Math.random() < T.roofChance;
  boss.laser = { t: 0, state: 'aim', up, dir: boss.face, from: bossEye(),
                 aim: { x: player.x + player.w / 2, y: player.y + player.h / 2 } };
  bossSay(up ? 'Bring the ceiling down on him!' : 'Hold STILL, cat!', T.laserWarnS + 0.4);
  sfx.aim();
}
function bossDropRocks() {
  const T = TUNING.boss;
  const px = player.x + player.w / 2;
  // Spread across the room rather than only on top of Dex: a barrage you run
  // through, with gaps, instead of a guided missile you cannot escape.
  for (let v = 0; v < T.rockVolleys; v++) {
    for (let i = 0; i < T.rocks; i++) {
      const spread = (i - (T.rocks - 1) / 2) * 130 + (Math.random() - 0.5) * 70;
      const x = clamp(px + spread + (v ? 65 : 0), boss.x - 900, boss.x + 800);
      bossRocks.push({ x, y: -30, vy: 0,
                       warn: T.rockWarnS + v * T.rockVolleyGapS + i * 0.05,
                       r: 15 + Math.random() * 9 });
    }
  }
  addShake(2.8);
}
function bossStartLeap() {
  const T = TUNING.boss;
  boss.state = 'leap'; boss.t = 0;
  boss.leapFrom = boss.x;
  boss.leapTo = clamp(player.x + player.w / 2, boss.home - 260, boss.home + 260);
  bossSay(['Come HERE!', 'Squash the cat!', 'I shall land ON you!'][boss.hp % 3], 1.6);
  sfx.aim();
}
function updateBossLeap(dt) {
  const T = TUNING.boss;
  boss.t += 0;                              // t is advanced by updateBoss
  const warn = T.leapWarnS, air = T.leapS;
  if (boss.t < warn) {                      // crouched, shadow showing
    if (boss.t < warn * 0.55) {             // …and only tracking at first
      boss.leapTo = clamp(player.x + player.w / 2, boss.home - 260, boss.home + 260);
    }
    return;
  }
  const k = clamp((boss.t - warn) / air, 0, 1);
  boss.x = boss.leapFrom + (boss.leapTo - boss.leapFrom) * k;
  boss.leapY = -Math.sin(k * Math.PI) * T.leapHeight;
  if (k >= 1) {
    boss.leapY = 0;
    boss.state = 'idle'; boss.t = 0;
    boss.winded = T.windedS;
    boss.busy = T.windedS + T.breatherS;
    addShake(3.4); sfx.stomp();
    // NO shockwave off the leap. He lands where Dex was, so a wave rolling
    // out from his feet catches you the instant you finish dodging — it
    // cancelled the very opening the dodge is meant to earn, every single
    // time. Waves belong to the phase-three pound, where dodging them IS
    // the game.
    novaSay('He\'s winded — get him!', 2);
  }
}
function updateBossLaser(dt) {
  const T = TUNING.boss, l = boss.laser;
  if (!l) {
    // he won't shoot while he's folded up and helpless — that window stays safe
    // never shoot from off screen — a beam you cannot see coming is not a
    // difficulty setting, it is an ambush
    const r = bossRect();
    const onScreen = r.x + r.w > camX + 40 && r.x < camX + VIEW_W - 40;
    if (bossVulnerable() || boss.state === 'hurt' || boss.busy > 0 || !onScreen) {
      boss.laserT = 0; return;
    }
    boss.laserT += dt;
    if (boss.laserT > T.laserEveryS * bossPace()) { boss.laserT = 0; bossStartLaser(); }
    return;
  }
  l.t += dt;
  if (l.state === 'aim') {
    l.from = bossEye();
    if (!l.up && l.t < T.laserWarnS * 0.45) {
      // tracks for the first part of the wind-up, then commits
      l.aim = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
      l.dir = l.aim.x < boss.x ? -1 : 1;
    }
    if (l.t > T.laserWarnS) { l.state = 'fire'; l.t = 0; sfx.laser(); addShake(1.6);
                              if (l.up) bossDropRocks(); }
  } else if (l.t > T.laserFireS) {
    boss.laser = null;
    boss.busy = T.breatherS;
  }
}
function updateBossRocks(dt) {
  const T = TUNING.boss;
  for (const r of bossRocks) {
    if (r.warn > 0) { r.warn -= dt; continue; }
    r.vy = Math.min(r.vy + T.rockFallAccel * dt, T.rockSpeed + 120);
    r.y += r.vy * dt;
    if (r.y > 500) {
      r.dead = true;
      burst(r.x, 486, 'rgba(150,140,130,0.9)', 12, 160);
      addShake(1.2);
    }
  }
  bossRocks = bossRocks.filter(r => !r.dead);
}
function bossSay(text, secs = 2.4) { boss.shout = text; boss.shoutT = secs; }
// Nova is in the cage the whole fight and she is the one who knows what to do.
// Every instruction the player needs comes out of her mouth, once, when it
// becomes relevant — never a wall of text up front.
function novaSay(text, secs = 3.4) { toast('💜 Nova: ' + text, secs); }
// A boss theme. Reuses the intro's music engine — a pattern of notes stepped
// through on a beat — so there's nothing new to maintain.
const BOSS_THEME = { notes: [98, 0, 98, 117, 131, 0, 117, 98, 110, 0, 110, 131, 147, 0, 131, 117],
                     type: 'sawtooth', vol: 0.05, beat: 0.30 };
function updateBossMusic(dt) {
  if (!boss || boss.state === 'cured' || game.state !== 'playing') return;
  boss.musicT = (boss.musicT || 0) + dt;
  if (boss.musicT < BOSS_THEME.beat) return;
  boss.musicT -= BOSS_THEME.beat;
  const f = BOSS_THEME.notes[(boss.musicIdx = (boss.musicIdx || 0) + 1) % BOSS_THEME.notes.length];
  if (f) AudioSys.tone(f, BOSS_THEME.beat * 0.9, { type: BOSS_THEME.type, vol: BOSS_THEME.vol });
  // a low heartbeat underneath it
  if (boss.musicIdx % 4 === 0) AudioSys.tone(49, 0.34, { type: 'sine', vol: 0.07 });
}
function bossEntrance() {
  if (boss.entered) return;
  boss.entered = true;
  boss.cardT = 4.2;
  addShake(4.5);
  introSfx.boom(); introSfx.riser();
  setTimeout(() => { if (boss && boss.state !== 'cured') introSfx.laugh(); }, 900);
  bossSay('So the cat found me. How TIRESOME.', 3.4);
}
function bossCoach() {
  if (boss.coached === boss.phase) return;
  boss.coached = boss.phase;
  if (boss.phase === 1) novaSay('Get up on the ledges and jump on his CROWN!', 4.5);
  else if (boss.phase === 2) novaSay('When the roof comes down — run, then climb!', 4.5);
  else novaSay('Faster now! Dodge the rocks, then get up there!', 4.5);
}
// Everything he does gets quicker as the crown comes apart.
function bossPace() { return 1 - 0.16 * (5 - boss.hp); }
function bossVulnerable() {
  // Reeling counts for something. Without this he can be hit again on the way
  // back down from the same bounce, which skipped a whole phase in testing.
  if (boss.state === 'hurt' || boss.state === 'cured') return false;
  return boss.state === 'stunned' || boss.headDown > 0 || boss.winded > 0;
}
/* The King throws Dex off the moment his crown is struck. It is a shove, not
   an attack — game.invuln covers the whole flight so neither the pulse nor
   anything he lands near can zap him. */
function kingShakeOff() {
  const T = TUNING.boss;
  const pc = player.x + player.w / 2;
  const dir = pc === boss.x ? -1 : Math.sign(pc - boss.x);
  dropVine(); dropChute();
  player.flight = false;
  player.vx = dir * T.crownPulseVx;
  player.vy = -T.crownPulseVy;
  player.grounded = false; player.support = null;
  player.coyote = 0; player.buffer = 0;
  player.launchT = TUNING.player.padNoCutS;   // the shove is not jump-cuttable
  player.squash = -0.18;
  game.invuln = Math.max(game.invuln, T.crownPulseInvulnS);
  // the pulse itself
  const cy = boss.floor - TUNING.boss.h * (boss.scale || 1) * 0.5;
  rings.push({ x: boss.x, y: cy, r: 20, max: 340, life: 0.55, maxLife: 0.55 });
  rings.push({ x: boss.x, y: cy, r: 10, max: 220, life: 0.4, maxLife: 0.4 });
  burst(boss.x, cy, '#c6ffb8', 18, 260);
  addShake(3.0);
  sfx.shakeOff();
}
function bossHurt() {
  const T = TUNING.boss;
  boss.hp--; boss.hurt = T.hurtS; boss.state = 'hurt'; boss.t = 0;
  boss.scale = Math.max(0.4, boss.scale - T.shrinkPerHit);
  boss.headDown = 0; boss.cured = 0;
  sweepKingRats();               // clear the floor between phases
  addShake(3.2); hitstop = Math.max(hitstop, 0.09);
  const c = bossCrownRect();
  burst(c.x + c.w / 2, c.y + c.h / 2, '#ffd24d', 26, 260);
  sfx.unlock();
  boss.winded = 0; boss.busy = TUNING.boss.breatherS;
  kingShakeOff();
  if (boss.hp <= 0) {
    boss.state = 'cured'; boss.t = 0;
    bossSay('My crown! My beautiful — oh. Oh dear.', 5);
    toast('👑 The crown is broken — King Ratthew is cured!');
  } else {
    boss.phase = boss.hp > 3 ? 1 : boss.hp > 1 ? 2 : 3;
    bossSay(boss.phase === 2 ? 'You SCUFFED it! Right, no more Mr Nice King!'
                             : 'ENOUGH! I shall flatten you personally!', 3);
  }
}
function kingRats() {
  return LEVEL.enemies.filter(e => e.fromKing && !e.cured && e.alive !== false);
}
function bossSpawnRat() {
  if (kingRats().length >= TUNING.boss.maxRats) return;   // don't swamp the floor
  boss.ratSide = -(boss.ratSide || 1);                    // alternate the pipes
  const side = boss.ratSide;
  const from = boss.x + side * 190;
  const r = side < 0 ? CREATURES.rat.spawn(boss.x - 760, boss.x - 130, boss.floor)
                     : CREATURES.rat.spawn(boss.x + 130, boss.x + 760, boss.floor);
  r.x = from; r.dir = side; r.fromKing = true;
  LEVEL.enemies.push(r);
  burst(from, boss.floor - 40, '#7de3ff', 12, 150);
}
function sweepKingRats() {
  for (const e of kingRats()) {
    e.alive = false;
    burst(e.x + e.w / 2, e.y + e.h / 2, '#7de3ff', 8, 120);
  }
  LEVEL.enemies = LEVEL.enemies.filter(e => !e.fromKing || e.alive !== false);
}
function updateBoss(dt) {
  if (!boss) return;
  const T = TUNING.boss;
  boss.t += dt;
  if (boss.shoutT > 0) boss.shoutT -= dt;
  if (boss.headDown > 0) boss.headDown -= dt;
  if (boss.winded > 0) boss.winded -= dt;
  if (boss.busy > 0) boss.busy -= dt;
  // and rear back when he's about to shoot the ceiling
  const up = (boss.laser && boss.laser.up) ? 1 : 0;
  boss.lookUp += (up - boss.lookUp) * Math.min(1, 7 * dt);
  boss.face = player.x + player.w / 2 < boss.x ? -1 : 1;
  // shockwaves from a pound roll along the floor
  for (const w of bossWaves) { w.x += w.dir * T.waveSpeed * dt * slowFactor(); w.life -= dt; }
  bossWaves = bossWaves.filter(w => w.life > 0);
  updateBossRocks(dt);
  if (boss.state === 'cured') return;
  if (boss.state === 'hurt') {
    boss.hurt -= dt;
    if (boss.hurt <= 0) { boss.state = 'idle'; boss.t = 0; }
    return;
  }
  // he only wakes up once Dex is actually in the room
  if (player.x + player.w < boss.x - 900) return;
  bossEntrance();
  if (boss.cardT > 0) boss.cardT -= dt;
  updateBossMusic(dt);
  bossCoach();
  if (boss.state === 'leap') { updateBossLeap(dt); return; }
  updateBossLaser(dt);
  if (boss.laser) return;                 // busy charging or firing
  // he hunts you down between everything else
  if (boss.winded <= 0 && !bossVulnerable() && boss.busy <= 0) {
    boss.leapT += dt;
    if (boss.leapT > T.leapEveryS * bossPace()) { boss.leapT = 0; bossStartLeap(); return; }
  }

  if (boss.phase === 1) {
    if (boss.state === 'stunned') {
      if (boss.t > T.stunS) { boss.state = 'idle'; boss.t = 0; boss.cured = 0; }
      return;
    }
    if (boss.t > T.ratEveryS * bossPace()) {
      boss.t = 0; bossSpawnRat();
      bossSay(['Fetch, my minions!', 'Get the cat!', 'Do be quick about it.'][boss.hp % 3], 1.8);
    }
  } else if (boss.phase === 3) {
    if (boss.state === 'idle' && boss.t > T.poundEveryS) {
      boss.state = 'pound'; boss.t = 0;
      bossSay('SQUASH!', 1.2);
    } else if (boss.state === 'pound' && boss.t > 0.55) {
      boss.state = 'idle'; boss.t = 0;
      boss.headDown = T.poundHeadDownS;
      novaSay('Now! His head is down!', 2);
      addShake(2.4); sfx.stomp();
      bossWaves.push({ x: boss.x - 60, dir: -1, life: 3.4 });
    }
  }
}
function bossCheckHits() {
  if (!boss || boss.state === 'cured') return;
  // Nova has been building things all game; she is not going to watch him do
  // this bare-pawed. If he arrives with nothing equipped, she throws the boots
  // down from the cage — which is also the only guarantee that a child who
  // never visited the workshop reaches the finale with a power-up at all.
  if (!boss.gaveBoots && player.x + player.w > boss.x - 780) {
    boss.gaveBoots = true;
    if (!power.id) {
      power.id = 'boots';
      power.charges = POWERUPS.boots.max;
      updateHud();
      burst(player.x + player.w / 2, player.y, '#7de3ff', 20, 220);
      sfx.unlock();
      novaSay('Dex — catch! My Spring Boots. Press jump twice for a big spring!', 5);
    } else {
      power.charges = POWERUPS[power.id].max;
      updateHud();
      novaSay('Topping up your ' + POWERUPS[power.id].name + ' — good luck!', 4);
    }
  }
  // One crown hit per approach. Touching the floor re-arms it — the crown is
  // not solid, so bouncing off his head never counts as landing. Without this
  // the shove alone was not enough: Dex rose, drifted back over the crown and
  // struck it again on the way down, which is the camping it was meant to end.
  if (player.grounded) boss.crownArmed = true;
  const pr = { x: player.x, y: player.y, w: player.w, h: player.h };
  const r = bossRect(), crown = bossCrownRect();
  // Coming down on the crown. Always counts, whatever he's doing — and the
  // target is padded outwards, because "I landed on his head" should never be
  // decided by four pixels.
  const onCrown = { x: crown.x - 16, y: crown.y - 18, w: crown.w + 32, h: crown.h + 30 };
  if (player.vy > 100 && overlap(pr, onCrown)) {
    player.vy = -430;
    if (boss.crownArmed && boss.hurt <= 0 && boss.state !== 'cured') {
      boss.crownArmed = false;
      bossHurt();                                // which shakes him off too
    } else {
      // Not a scoring hit — but he is STILL thrown clear. The crown box is
      // padded wider than the shove first carried him, so without this he
      // bounced on the King's head for ever, never landing, and therefore
      // never re-arming: a softlock strictly worse than the camping it
      // replaced. The King always shrugs him off.
      addShake(1.0); sfx.stomp();
      kingShakeOff();
    }
    return;
  }
  if (game.invuln > 0) return;
  // His body only hurts while he is actually coming down on you. Standing
  // next to him does not, and neither does dropping onto him. Contact damage
  // on a stationary boss you are meant to jump on just punishes you for
  // walking up to do the thing the game asked — it was the top cause of zaps
  // by a mile, and none of them felt like the player's fault.
  const fromAbove = player.vy > 0 && player.y + player.h < r.y + 52;
  if (boss.state === 'leap' && !fromAbove && overlap(pr, inset(r, 10))) {
    if (!absorbHit('king') && !shrinkPlayer()) { die('king'); }
    return;
  }
  for (const w of bossWaves) {
    if (overlap(pr, { x: w.x - 22, y: boss.floor - 34, w: 44, h: 34 })) {
      if (!absorbHit('king') && !shrinkPlayer()) { die('king'); }
      return;
    }
  }
  // …and it only hurts while it is still at full brightness
  if (boss.laser && boss.laser.state === 'fire' &&
      boss.laser.t < TUNING.boss.laserFireS * 0.65 && bossLaserHits(boss.laser, pr)) {
    if (!absorbHit('laser') && !shrinkPlayer()) { die('laser'); }
    return;
  }
  for (const r of bossRocks) {
    if (r.warn > 0) continue;
    if (overlap(pr, { x: r.x - r.r, y: r.y - r.r, w: r.r * 2, h: r.r * 2 })) {
      if (!absorbHit('rock') && !shrinkPlayer()) { die('rock'); }
      return;
    }
  }
}
// phase 1: curing his minions is what brings him down to your level
function bossCountCure() {
  if (!boss || boss.phase !== 1 || boss.state === 'stunned') return;
  boss.cured++;
  const left = TUNING.boss.ratsToStun - boss.cured;
  if (left > 0) novaSay(left === 1 ? 'One more and he\'ll double up!' : left + ' more!', 1.8);
  if (boss.cured >= TUNING.boss.ratsToStun) {
    boss.state = 'stunned'; boss.t = 0;
    bossSay("Ha! Ha ha! Oh, that is priceless — hoo! I can't— hee!", TUNING.boss.stunS);
    novaSay('He\'s folded up — the crown is right there!', 3.4);
  }
}
/* ------------------------------------------------------------ SLIDE ----
   The storm drain. The chute is a polyline; Dex's feet ride it. The camera
   only pans sideways, so the drain can't actually plunge — instead the chute
   dips and rises while the pipe walls rush upward past him, which reads as a
   long drop and keeps everything inside the 540px the engine has.        */
function chuteY(c, x) {
  const pts = c.pts;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      return ay + (by - ay) * ((x - ax) / (bx - ax));
    }
  }
  return pts[pts.length - 1][1];
}
// A chute is authored as (x, gradient) pairs now rather than absolute points,
// because the whole thing is one continuous descent and hand-writing the
// y values for a 2,700px drop is a good way to accidentally put a hill in it.
function chuteFromGrades(x1, y1, spans) {
  const pts = [[x1, y1]];
  let x = x1, y = y1;
  for (const [len, grade] of spans) { x += len; y += len * grade; pts.push([x, y]); }
  return pts;
}
function chuteGrade(c, x) {           // downhill is positive
  const d = 6;
  return (chuteY(c, x + d) - chuteY(c, x - d)) / (2 * d);
}
function chuteHole(c, x) {
  return c.gaps.some(([a, b]) => x > a && x < b);
}
function chuteObsRect(c, o) {
  const y = chuteY(c, o.x);
  return o.kind === 'rat'
    ? { x: o.x - 20, y: y - 36, w: 40, h: 36 }
    : { x: o.x - 30, y: y - 142, w: 60, h: 62 };
}
function startSlide(c) {
  player.chute = c; player.sliding = true;
  player.vx = TUNING.player.slideStartSpeed; player.vy = 0;
  player.grounded = true; player.support = null;
  player.y = chuteY(c, player.x + player.w / 2) - player.h;
  player.buffer = 0;
  sfx.slide();
  toast('Wheeee! SPACE to jump — mind the low pipes!');
}
function endSlide() {
  const c = player.chute;
  player.chute = null; player.sliding = false;
  if (c && c.exit) {
    player.x = c.exit.x; player.y = c.exit.y;
    player.vx = Math.min(player.vx, 320); player.vy = 0;
    player.grounded = false; player.support = null;
    camY = 0;                                   // snap, don't pan 2,000px
    addShake(2.2);
    burst(player.x + player.w / 2, player.y + player.h, 'rgba(180,240,225,0.9)', 26, 320);
    sfx.slide();
    toast('Splash! Welcome to the sewer.');
  }
}
function updateSlide(dt) {
  const T = TUNING.player, c = player.chute;
  const mid = () => player.x + player.w / 2;
  // along the chute: the steeper it is, the faster he goes
  const grade = chuteGrade(c, mid());
  player.vx += (grade * T.slideGravity - T.slideDrag * (player.vx - T.slideMin) * 0.6) * dt;
  player.vx = clamp(player.vx, T.slideMin, T.slideMax);
  player.x += player.vx * dt;
  player.face = 1;
  const surf = chuteY(c, mid());
  if (player.grounded) {
    if (player.buffer > 0) {                    // one button: hop, keep sliding
      player.vy = -T.slideJumpVel; player.grounded = false;
      player.buffer = 0; player.squash = -0.14; sfx.jump();
    } else {
      player.y = surf - player.h;
      player.vy = 0;
    }
  }
  if (!player.grounded) {
    player.vy = Math.min(player.vy + T.gravity * dt, T.maxFall);
    player.y += player.vy * dt;
    if (player.vy > 0 && player.y + player.h >= surf && !chuteHole(c, mid())) {
      player.y = surf - player.h; player.vy = 0; player.grounded = true;
      player.squash = 0.16;
    }
  }
  player.anim += dt * 3;
  if (player.x > c.x2) endSlide();              // out the bottom, into the sewer
}
/* ------------------------------------------------------------ VINES ----
   Dex swings on a vine like a pendulum. Jump catches it, jump lets go —
   one button, because the controls are only ever left, right and jump.
   The same press can't do both: a grab clears the jump buffer and starts a
   short minimum-hold, and letting go starts a cooldown so he doesn't snap
   straight back onto the vine he just left.                             */
function idleVines(dt) {
  for (const v of LEVEL.vines) {
    if (player.vine === v) continue;
    v.theta = 0.07 * Math.sin(game.time * 1.1 + v.phase);
    v.omega = 0;
  }
}
function vineEnd(v) {
  return { x: v.ax + Math.sin(v.theta) * v.len, y: v.ay + Math.cos(v.theta) * v.len };
}
function grabVine(v) {
  const T = TUNING.player;
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
  v.theta = clamp(Math.atan2(cx - v.ax, Math.max(1, cy - v.ay)), -T.vineMaxAngle, T.vineMaxAngle);
  // carry his momentum into the swing, then add the boost that makes a slow
  // arrival still worth something
  const dir = Math.abs(player.vx) > 20 ? Math.sign(player.vx) : player.face;
  const tangential = player.vx * Math.cos(v.theta) - player.vy * Math.sin(v.theta);
  v.omega = tangential / v.len + dir * T.vineGrabBoost;
  player.vine = v; player.vineHoldT = 0; player.buffer = 0;
  player.vx = 0; player.vy = 0;
  player.grounded = false; player.support = null;
  player.squash = -0.1;
  sfx.grab();
}
// The height of one ordinary jump: v^2 / 2g, the number every level is built
// around. Derived, never written down twice.
const singleJumpHeight = () => {
  const T = TUNING.player;
  return T.jumpVel * T.jumpVel / (2 * T.gravity);
};
function springJump() {
  const T = TUNING.player, one = singleJumpHeight();
  // aim for twice a normal jump above the ground he took off from
  const target = player.jumpFromY - one * 2;
  const climb = clamp(player.y - target, 40, one * 2);
  player.vy = -Math.sqrt(2 * T.gravity * climb);
  player.grounded = false; player.support = null;
  player.coyote = 0; player.buffer = 0;
  // Immune to the jump cut. Releasing the button a moment after a quick
  // double-tap would otherwise clamp the spring back to jumpCutVel and eat
  // the whole boost — which is exactly what "doesn't seem to work" looked
  // like. The height of this jump is promised, not negotiated by how long a
  // child happens to hold the button.
  player.launchT = TUNING.player.padNoCutS;
  player.squash = -0.16;
  power.charges--;
  burst(player.x + player.w / 2, player.y + player.h, '#7de3ff', 16, 190);
  burst(player.x + player.w / 2, player.y + player.h, '#c9a6ff', 8, 140);
  sfx.spring();
  updateHud();
}
// can he spring right now? (used by the jump handler and the power button)
function canSpring() {
  return game.state === 'playing' && power.id === 'boots' && power.charges > 0 &&
         !player.grounded && !player.vine && !player.sliding && !player.flight;
}
function releaseVine() {
  const T = TUNING.player, v = player.vine;
  const speed = v.omega * v.len;
  player.vx = clamp(speed * Math.cos(v.theta), -520, 520);
  player.vy = clamp(-speed * Math.sin(v.theta) - T.vineReleaseBoost, -820, 620);
  player.vine = null; player.vineHoldT = 0;
  player.vineCool = T.vineCooldownS; player.buffer = 0;
  player.squash = -0.16;
  sfx.jump();
}
function swingVine(dt) {
  const T = TUNING.player, v = player.vine;
  v.omega += -(T.vineGravity / v.len) * Math.sin(v.theta) * dt;
  v.theta += v.omega * dt;
  if (Math.abs(v.theta) > T.vineMaxAngle) {      // don't loop the loop
    v.theta = Math.sign(v.theta) * T.vineMaxAngle;
    v.omega = 0;
  }
  const e = vineEnd(v);
  player.x = e.x - player.w / 2;
  player.y = e.y - player.h * 0.28;
  player.vx = 0; player.vy = 0;
  player.grounded = false; player.support = null;
  if (Math.abs(v.omega) > 0.15) player.face = v.omega > 0 ? 1 : -1;
  player.vineHoldT += dt;
}
function updatePlayerPhysics(dt, solidsOverride = null, maxXOverride = null) {
  const T = TUNING.player;
  if (player.sliding) {                 // the chute owns his speed entirely
    if (input.jumpPressed) { player.buffer = T.jumpBufferMs / 1000; input.jumpPressed = false; }
    else player.buffer -= dt;
    updateSlide(dt);
    player.prevVy = 0; player.prevGrounded = true;
    player.squash *= Math.exp(-9 * dt);
    if (player.blinkT > 0) player.blinkT -= dt;
    else {
      player.blinkNext -= dt;
      if (player.blinkNext <= 0) { player.blinkT = 0.13; player.blinkNext = 2 + Math.random() * 3; }
    }
    return;
  }
  const ax = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (player.flight) {
    // mid-arc she leans rather than runs: the catapult owns the direction,
    // she only gets to stretch or shorten the throw
    player.flightT += dt;
    player.vx = clamp(player.vx + ax * T.catapultSteer * dt,
                      T.catapultVxMin, T.catapultVxMax);
    player.face = 1;
    if (player.flightT > 8) endFlight();      // nothing flies for ever
  } else {
    if (ax !== 0) player.face = ax;
    const target = ax * T.runSpeed;
    const accel = player.grounded ? (ax !== 0 ? T.accel : T.decel) : T.airAccel;
    if (player.vx < target) player.vx = Math.min(target, player.vx + accel * dt);
    else if (player.vx > target) player.vx = Math.max(target, player.vx - accel * dt);
  }

  if (player.grounded) { player.coyote = coyoteTime(); player.jumpFromY = player.y; }
  else player.coyote -= dt;
  if (input.jumpPressed) { player.buffer = T.jumpBufferMs / 1000; input.jumpPressed = false; }
  else player.buffer -= dt;
  // Standing at the lip of a chute, jump sets him off. Levels only: the
  // treehouse shares this function but not the level's furniture, and LEVEL
  // still holds the last level played while Dex is at home.
  if (game.state === 'playing') {
    const mx = player.x + player.w / 2;
    for (const c of LEVEL.chutes) {
      if (player.grounded && player.buffer > 0 && mx > c.x1 - 70 && mx < c.x1 + 50) {
        startSlide(c); break;
      }
      // stepped off without pressing — catch him rather than drop him
      if (!player.grounded && player.vy > 0 && mx > c.x1 - 20 && mx < c.x2 &&
          player.y + player.h >= chuteY(c, mx) - 4) {
        startSlide(c); break;
      }
    }
  }
  if (player.sliding) { updateSlide(dt); player.prevVy = 0; player.prevGrounded = true; }
  else {
  // vines take priority over jumping: the same button does both
  if (player.vineCool > 0) player.vineCool -= dt;
  idleVines(dt);
  if (player.vine) {
    if (player.buffer > 0 && player.vineHoldT >= T.vineMinHoldS) releaseVine();
  } else if (player.buffer > 0 && player.vineCool <= 0 && !player.grounded &&
             game.state === 'playing') {          // same reason as the chutes
    for (const v of LEVEL.vines) {
      const e = vineEnd(v);
      const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
      if (Math.abs(cx - e.x) < T.vineGrabRadius && Math.abs(cy - e.y) < T.vineGrabRadius) {
        grabVine(v); break;
      }
    }
  }
  if (player.vine) {
    swingVine(dt);
    player.prevVy = 0; player.prevGrounded = false;
  } else {
  if (player.buffer > 0 && player.coyote > 0) {
    player.vy = -T.jumpVel;
    player.grounded = false; player.coyote = 0; player.buffer = 0;
    player.support = null;
    player.squash = -0.14;               // stretch on take-off
    sfx.jump();
  } else if (player.buffer > 0 && canSpring()) {
    springJump();                        // Spring Boots: jump again in mid-air
  }
  if (player.launchT > 0) player.launchT -= dt;
  if (!input.jump && !player.flight && player.launchT <= 0 &&
      player.vy < -T.jumpCutVel) {
    player.vy = -T.jumpCutVel;
  }

  player.prevVy = player.vy;
  player.prevGrounded = player.grounded;
  player.vy = Math.min(player.vy + (player.flight ? T.catapultGravity : T.gravity) * dt,
                       T.maxFall);
  moveAndCollide(dt, solidsOverride, maxXOverride);
  // Spring Boots come back the instant he touches down. A double jump you have
  // to earn back is not a double jump — every platformer a child has played
  // refreshes it on landing, so one airborne period gets one spring and there
  // is nothing to ration. The maths recharge still fires, but finds it already
  // full and hands over bonus crystals instead.
  if (player.grounded && power.id === 'boots' && power.charges < POWERUPS.boots.max) {
    power.charges = POWERUPS.boots.max;
    updateHud();
  }
  // the arc is over the moment he touches down, or is stopped by a wall
  if (player.flight && (player.grounded || player.vx === 0)) endFlight();
  if (player.flight) {
    // a sparkle trail, so three seconds of arc still has something happening
    player.flightSpark = (player.flightSpark || 0) + dt;
    if (player.flightSpark > 0.05) {
      player.flightSpark = 0;
      burst(player.x + player.w / 2, player.y + player.h / 2, '#bff2ff', 2, 60);
    }
  }
  }
  // landing: squash + dust
  if (player.grounded && !player.prevGrounded && player.prevVy > 380) {
    player.squash = 0.2;
    const n = Math.round(6 * fxScale()) + 2;
    for (let i = 0; i < n; i++) {
      particles.push({ x: player.x + player.w / 2 + (Math.random() - 0.5) * 26,
                       y: player.y + player.h - 2,
                       vx: (Math.random() - 0.5) * 120, vy: -30 - Math.random() * 50,
                       life: 0.35, max: 0.35, color: 'rgba(230,220,200,0.8)',
                       r: 2 + Math.random() * 2.5 });
    }
  }
  }
  player.squash *= Math.exp(-9 * dt);
  player.anim += dt * (Math.abs(player.vx) > 20 ? 2.4 : 1);
  // blinking
  if (player.blinkT > 0) player.blinkT -= dt;
  else {
    player.blinkNext -= dt;
    if (player.blinkNext <= 0) { player.blinkT = 0.13; player.blinkNext = 2 + Math.random() * 3; }
  }
}
function moveAndCollide(dt, solidsOverride = null, maxXOverride = null) {
  const sol = solidsOverride || activeSolids();
  const maxMove = Math.max(Math.abs(player.vx), Math.abs(player.vy)) * dt;
  const n = Math.max(1, Math.ceil(maxMove / 12));
  const sd = dt / n;
  player.grounded = false; player.support = null;
  for (let i = 0; i < n; i++) {
    player.x += player.vx * sd;
    for (const s of sol) {
      if (overlap(player, s)) {
        if (player.vx > 0) player.x = s.x - player.w;
        else if (player.vx < 0) player.x = s.x + s.w;
        else player.x = (player.x + player.w / 2 < s.x + s.w / 2) ? s.x - player.w : s.x + s.w;
        player.vx = 0;
      }
    }
    player.y += player.vy * sd;
    for (const s of sol) {
      if (overlap(player, s)) {
        if (player.vy < 0) {
          player.y = s.y + s.h; player.vy = 0;
        } else {
          player.y = s.y - player.h; player.vy = 0;
          player.grounded = true; player.support = s;
          if (s.kind === 'crumble') startCrumble(s);
        }
      }
    }
  }
  player.x = clamp(player.x, 0, (maxXOverride ?? LEVEL.width) - player.w);
}
/* Touching a geode. It always fires to the RIGHT — the way the level runs —
   rather than the way Dex happens to be facing. A catapult that sometimes
   throws you back where you came from is a catapult nobody trusts, and every
   arc in the level is designed and validated left-to-right.

   Note the order: the collision code may have just set grounded/support, and
   this undoes both — otherwise Dex is "standing" on something he has already
   left, and the next jump press is spent on a jump he never needed. */
function bouncePad(pad) {
  const T = TUNING.player;
  player.vy = -T.catapultVy;
  player.vx = T.catapultVx;
  player.face = 1;
  player.flight = true; player.flightT = 0;
  player.grounded = false; player.support = null;
  player.launchT = T.padNoCutS;
  player.coyote = 0; player.buffer = 0;      // no free second jump off the top
  player.squash = -0.2;                      // stretched out, not squashed
  pad.fire = 0.32;
  addShake(2.2);
  sfx.pad();
  burst(pad.x + pad.w / 2, pad.y + 2, '#7de3ff', 16, 260);
  burst(pad.x + pad.w / 2, pad.y + 2, '#c9a6ff', 8, 180);
}
function endFlight() {
  if (!player.flight) return;
  player.flight = false; player.flightT = 0;
  player.squash = 0.4;                       // a little landing scrunch
  burst(player.x + player.w / 2, player.y + player.h, '#bff2ff', 8, 140);
}
function startCrumble(c) {
  if (c.state === 'ok') {
    c.state = 'shaking';
    c.timer = TUNING.platforms.crumbleShakeMs / 1000;
    sfx.crumble();
  }
}
function updateCrumblers(dt) {
  const sf = slowFactor();
  for (const c of LEVEL.crumblers) {
    if (c.state === 'shaking') {
      c.timer -= dt * sf;
      if (c.timer <= 0) {
        c.state = 'gone';
        c.timer = TUNING.platforms.crumbleRespawnMs / 1000;
        if (player.support === c) player.support = null;
        burst(c.x + c.w / 2, c.y + 8, '#cbbfa8', 10, 120);
      }
    } else if (c.state === 'gone') {
      c.timer -= dt;
      if (c.timer <= 0 && !overlap(player, c)) { c.state = 'ok'; }
    }
  }
}
function updateEnemies(dt) {
  const E = TUNING.enemies;
  const sf = slowFactor();
  for (const e of LEVEL.enemies) {
    if (!e.alive) continue;
    if (e.cured) { updateCured(e, dt); continue; }
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.type === 'mozzie') {
      e.angle += E.mozzieOmega * speedMult(e.x) * sf * dt;
      e.y = e.cy + Math.sin(e.angle) * e.amp;
      continue;
    }
    if (e.warn > 0) {                      // telegraph before turning
      e.warn -= dt * sf;
      if (e.warn <= 0) e.dir *= -1;
      continue;
    }
    if (e.variant === 'ember') {
      // Ember Rats pause to puff up (telegraph), then breathe glitch-fire
      e.fireT += dt * sf * speedMult(e.x);
      const c = E.emberCycleS, p = e.fireT % c;
      e.warmup = p > c - E.emberBreathS - E.emberWarmupS && p <= c - E.emberBreathS;
      e.breathing = p > c - E.emberBreathS;
      if (e.warmup || e.breathing) continue;   // stands still while flaming
    }
    if (e.variant === 'magma') {
      // prowls, then rears up glowing before spitting an arcing fireball.
      // Like the monkeys, it stays dormant until Dex is genuinely near, so
      // nothing is ever spat at you from off-screen.
      const dx = (player.x + player.w / 2) - (e.x + e.w / 2);
      const dy = (player.y + player.h / 2) - (e.y - e.h / 2);
      const awake = Math.abs(dx) < E.fireballWakePx && Math.abs(dy) < 110;
      if (!awake) { e.aiming = false; e.shotT = 0; }
      else {
        const prev = e.shotT;
        e.shotT += dt * sf * speedMult(e.x);
        const c = E.magmaCycleS;
        const was = e.aiming;
        e.aiming = (e.shotT % c) > c - E.magmaWarmupS;
        if (e.aiming && !was) e.dir = dx >= 0 ? 1 : -1;   // turn to face Dex
        if (Math.floor(e.shotT / c) > Math.floor(prev / c)) spitFireball(e);
        if (e.aiming) continue;                            // stands still to aim
      }
    }
    if (e.type === 'monkey') {
      // Glitch Monkeys swing to and fro on a vine like a pendulum, wind up,
      // then lob a banana. They only wake once Dex is genuinely near, so
      // nothing is ever thrown at you from off-screen, and arriving always
      // gives you a full cycle to spot them first.
      e.swingT += E.monkeySwingOmega * sf * speedMult(e.ax) * dt;
      const ang = Math.sin(e.swingT) * E.monkeySwingArc;
      e.angle = ang;
      const cx = e.ax + Math.sin(ang) * e.len;
      const cy = e.ay + Math.cos(ang) * e.len;
      e.x = cx - e.w / 2;
      e.y = cy + e.h / 2;                      // e.y stays "feet", as elsewhere
      const dx = (player.x + player.w / 2) - cx;
      const dy = (player.y + player.h / 2) - cy;
      e.dir = dx >= 0 ? 1 : -1;                // always faces Dex
      const awake = Math.abs(dx) < E.bananaRangePx + 90 && Math.abs(dy) < 260;
      if (!awake) {
        e.aiming = false; e.shotT = 0;
      } else {
        const prev = e.shotT;
        e.shotT += dt * sf;
        const c = E.monkeyCycleS;
        e.aiming = (e.shotT % c) > c - E.monkeyWarmupS;
        if (Math.floor(e.shotT / c) > Math.floor(prev / c)) throwBanana(e);
      }
      continue;                                // swingers never walk
    }
    const S = CREATURES[e.species];
    let spd = (S && S.speed ? S.speed() : E.ratSpeed) * speedMult(e.x) * sf;
    e.x += e.dir * spd * dt;
    if (e.dir < 0 && e.x <= e.x1) {
      e.x = e.x1;
      if (S && S.telegraph) e.warn = E.warnMs / 1000; else e.dir = 1;
    }
    if (e.dir > 0 && e.x + e.w >= e.x2) {
      e.x = e.x2 - e.w;
      if (S && S.telegraph) e.warn = E.warnMs / 1000; else e.dir = -1;
    }
  }
}
function updateCured(e, dt) {
  e.cureTimer -= dt;
  if (e.ax !== undefined) e.letGo = true;   // a cured monkey releases the vine
  if (e.type === 'mozzie') {
    // zips away upward, accelerating, so it reads as "flew off happily"
    // rather than fading out on the spot
    e.escape = Math.min((e.escape || 150) + 260 * dt, 460);
    e.y -= e.escape * dt;
    e.x += (e.fleeDir || 1) * 70 * dt + Math.sin(game.time * 9) * 30 * dt;
    if (e.y < -60) { e.alive = false; return; }
  } else {
    // happily scurries away — with real gravity, so it tumbles off edges
    e.x += e.dir * 165 * dt;
    e.vy = Math.min((e.vy || 0) + TUNING.player.gravity * dt, TUNING.player.maxFall);
    const prevY = e.y;
    e.y += e.vy * dt;                      // e.y is the rat's feet line
    for (const s of activeSolids()) {
      if (e.x + e.w > s.x && e.x < s.x + s.w &&
          e.y >= s.y && prevY <= s.y + 4) {   // crossed a platform top this frame
        e.y = s.y; e.vy = 0;
        break;
      }
    }
    if (e.y > VIEW_H + 80) { e.alive = false; return; }   // gone down the abyss
  }
  if (Math.random() < 3 * dt * fxScale()) {
    const r = enemyRect(e);
    particles.push({ x: r.x + r.w / 2, y: r.y, vx: (Math.random() - 0.5) * 30, vy: -60,
                     life: 0.6, max: 0.6, color: '#ff8fb0', r: 3, heart: true });
  }
  if (e.cureTimer <= 0) e.alive = false;
}
function enemyRect(e) {
  return e.type === 'mozzie'
    ? { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h }
    : { x: e.x, y: e.y - e.h, w: e.w, h: e.h };
}
function flameRect(e) {
  const len = TUNING.enemies.emberRangePx;
  return e.dir > 0
    ? { x: e.x + e.w, y: e.y - 26, w: len, h: 24 }
    : { x: e.x - len, y: e.y - 26, w: len, h: 24 };
}
function absorbHit(kind) {
  // Bubble Shield: soak one enemy or hazard hit
  if (power.id === 'shield' && power.charges > 0) {
    power.charges--;
    game.invuln = TUNING.powerups.shieldInvulnMs / 1000;
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    burst(px, py, '#9fdcff', 16, 220);
    rings.push({ x: px, y: py, r: 20, max: 70, life: 0.35, maxLife: 0.35 });
    sfx.pop();
    toast('🫧 Bubble Shield saved you!');
    updateHud();
    return true;
  }
  return false;
}
function checkHazards() {
  if (game.state !== 'playing') return;
  if (player.y > camY + VIEW_H + 60) { die('fall'); return; }

  const pRect = inset(player, 5);
  for (const e of LEVEL.enemies) {
    if (!e.alive || e.cured) continue;
    // Ember Rat glitch-fire: separate hazard in front of the rat
    if (e.variant === 'ember' && e.breathing && game.invuln <= 0 &&
        overlap(pRect, inset(flameRect(e), 3))) {
      if (!absorbHit('fire') && !shrinkPlayer()) { die('fire'); return; }
    }
    const r = enemyRect(e);
    if (!overlap(pRect, inset(r, 3))) continue;
    const stomping = e.stompable && player.vy > 140 &&
                     (player.y + player.h - r.y) < 22;
    if (stomping) {
      player.vy = -430;
      if (e.hits > 1) {
        // a big one: knock the glow out of it, shrink it, and it's cured next hop
        e.hits--;
        e.hitFlash = 0.35;
        e.w = Math.round(e.w * 0.74); e.h = Math.round(e.h * 0.74);
        const r0 = enemyRect(e);
        burst(r0.x + r0.w / 2, r0.y + r0.h / 2, '#8dff6a', 16, 200);
        addShake(1.4);
        hitstop = Math.max(hitstop, 0.05);
        sfx.stomp();
        toast('Knocked the glow out of it — hit it again!');
      } else {
        cure(e);
        bossCountCure();
      }
    } else if (game.invuln <= 0) {
      if (!absorbHit(e.type) && !shrinkPlayer()) { die(e.type); return; }
    }
  }
  if (game.invuln <= 0) {
    for (const b of bolts) {
      if (overlap(pRect, inset(boltRect(b), 2))) {
        b.dead = true;
        burst(b.x, b.y, '#ffdc5e', 10, 150);
        if (!absorbHit('banana') && !shrinkPlayer()) { die('banana'); }
        return;
      }
    }
    for (const s of LEVEL.spikes) {
      if (overlap(pRect, inset(s, 5))) {
        if (!absorbHit('spikes') && !shrinkPlayer()) { die('spikes'); }
        return;
      }
    }
    for (const g of LEVEL.geysers) {
      if (g.erupting && overlap(pRect, inset(geyserRect(g), 4))) {
        if (!absorbHit('lava') && !shrinkPlayer()) { die('lava'); }
        return;
      }
    }
    for (const f of LEVEL.falls) {
      if (f.pouring && overlap(pRect, inset(fallRect(f), 3))) {
        if (!absorbHit('lava') && !shrinkPlayer()) { die('lava'); }
        return;
      }
    }
    for (const sl of LEVEL.slimes) {
      if (overlap(pRect, inset(slimeRect(sl), 4))) {
        if (!absorbHit('slime') && !shrinkPlayer()) { die('slime'); }
        return;
      }
    }
    if (player.sliding) {
      const c = player.chute, mx = player.x + player.w / 2;
      if (chuteHole(c, mx) && player.y > chuteY(c, mx) + 40) {
        if (!absorbHit('slide') && !shrinkPlayer()) { die('slide'); }
        return;
      }
      for (const o of c.obs) {
        if (o.cured || Math.abs(o.x - mx) > 140) continue;
        const r = chuteObsRect(c, o);
        if (!overlap(pRect, inset(r, 4))) continue;
        if (o.kind === 'rat' && player.vy > 90 && player.y + player.h < r.y + 22) {
          o.cured = true;                       // bounced on its head: cured
          player.vy = -TUNING.player.slideJumpVel * 0.75;
          game.cures++;
          burst(o.x, r.y, '#ffe08a', 14, 180);
          addShake(1.0); sfx.cure();
          continue;
        }
        if (!absorbHit('slide') && !shrinkPlayer()) { die('slide'); }
        return;
      }
    }
    for (const fl of LEVEL.floods) {
      if (floodHits(fl, pRect)) {
        if (!absorbHit('slime') && !shrinkPlayer()) { die('slime'); }
        return;
      }
    }
  }
}
function checkPickupsAndGoals() {
  bossCheckHits();
  for (const c of LEVEL.crystals) {
    if (c.got) continue;
    if (Math.abs(player.x + player.w / 2 - c.x) < 26 &&
        Math.abs(player.y + player.h / 2 - c.y) < 30) {
      c.got = true; awardCrystals(1);
      burst(c.x, c.y, '#ffd24d', 10, 140);
      sfx.collect();
    }
  }
  for (const ca of LEVEL.caches) {
    if (ca.taken) continue;
    if (Math.abs(player.x + player.w / 2 - ca.x) < 32 &&
        Math.abs(player.y + player.h / 2 - ca.y) < 38) {
      ca.taken = true;
      game.secrets++;
      awardCrystals(TUNING.powerups.cacheCrystals);
      burst(ca.x, ca.y, '#ffd24d', 22, 240);
      burst(ca.x, ca.y, '#7de3ff', 10, 180);
      addShake(2);
      hitstop = Math.max(hitstop, 0.09);
      sfx.unlock();
      toast(`✨ Secret crystal stash! +${TUNING.powerups.cacheCrystals} ⭐`);
    }
  }
  for (let i = game.checkpoint + 1; i < LEVEL.checkpoints.length; i++) {
    if (player.x + player.w > LEVEL.checkpoints[i].x - 8) {
      game.checkpoint = i;
      // Checkpoints deliberately do NOT restore Dex's size — once he's small
      // he stays small until his next fresh start.
      toast('Checkpoint! 🚩');
      sfx.checkpoint();
    }
  }
  const cage = LEVEL.cage;
  if (cage && !cage.open && overlap(player, cage)) {
    if (boss && boss.state !== 'cured') {
      if (!cage.nagged) { cage.nagged = true; toast('The crown first — then the cage!'); }
    } else { showCageMath(); return; }
  }
  const p = LEVEL.portal;
  if (overlap(player, { x: p.x, y: p.y, w: p.w, h: p.h })) {
    if (boss && boss.state !== 'cured') toast('Not yet — the crown first!');
    else if (cage && !cage.open) toast('Not without Nova!');
    else win();
  }
}
function updateParticles(dt) {
  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (!p.heart) p.vy += 500 * dt;
  }
  particles = particles.filter(p => p.life > 0);
}
function updateRings(dt) {
  for (const r of rings) {
    r.life -= dt;
    r.r += (r.max - r.r) * 9 * dt;
  }
  rings = rings.filter(r => r.life > 0);
}
// Bananas are lobbed in an arc, so they're easy to read and easy to duck under
function throwBanana(e) { lobProjectile(e, 'banana'); }
function spitFireball(e) { lobProjectile(e, 'fireball'); }
function lobProjectile(e, kind) {
  const r = enemyRect(e), E = TUNING.enemies;
  const fire = kind === 'fireball';
  bolts.push({ kind,
    x: r.x + r.w / 2 + e.dir * 18, y: r.y + (fire ? 2 : 14),
    vx: e.dir * (fire ? E.fireballSpeedPx : E.bananaSpeedPx),
    vy: -(fire ? E.fireballLobPx : E.bananaLobPx),
    grav: fire ? E.fireballGravity : E.bananaGravity,
    range: fire ? E.fireballRangePx : E.bananaRangePx,
    dist: 0, spin: 0, w: fire ? 22 : 24, h: fire ? 22 : 16,
    seed: Math.abs((e.ax !== undefined ? e.ax : e.x1) % 10) });
  fire ? sfx.fireball() : sfx.banana();
}
function updateBolts(dt) {
  const sf = slowFactor();
  for (const b of bolts) {
    const sx = b.vx * sf * dt;
    b.x += sx;
    b.vy += b.grav * sf * dt;
    b.y += b.vy * sf * dt;
    b.spin += sf * dt * (b.vx > 0 ? 7 : -7);
    b.dist += Math.abs(sx);
    if (b.kind === 'fireball' && Math.random() < 30 * dt * fxScale()) {
      particles.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 40, vy: -20,
                       life: 0.35, max: 0.35, color: '#ff9b3d', r: 2 });
    }
    if (b.dist > b.range || b.y > VIEW_H + 40) { b.dead = true; continue; }
    // splat / burst against anything solid
    const r = { x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h };
    for (const s of activeSolids()) {
      if (overlap(r, s)) {
        b.dead = true;
        burst(b.x, b.y, b.kind === 'fireball' ? '#ff8a2b' : '#ffdc5e', 8, 130);
        break;
      }
    }
  }
  bolts = bolts.filter(b => !b.dead);
}
function boltRect(b) { return { x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h }; }
function drawBolts() {
  for (const b of bolts) {
    if (b.x < camX - 40 || b.x > camX + VIEW_W + 40) continue;
    if (b.kind === 'fireball') { drawFireball(b); continue; }
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.spin);
    // a tumbling banana: fat yellow crescent with a brown stalk
    ctx.fillStyle = 'rgba(255,220,94,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath();
    ctx.moveTo(-11, -4);
    ctx.quadraticCurveTo(0, 11, 11, -4);
    ctx.quadraticCurveTo(0, 4, -11, -4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f3c11c';
    ctx.beginPath();
    ctx.moveTo(-9, -3.5);
    ctx.quadraticCurveTo(0, 8, 9, -3.5);
    ctx.quadraticCurveTo(0, 2.5, -9, -3.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(-13, -6, 4, 4);
    ctx.restore();
  }
}
// Lava geysers: rest, then bubble as a clear warning, then erupt upward.
function updateGeysers(dt) {
  const E = TUNING.enemies, sf = slowFactor();
  for (const g of LEVEL.geysers) {
    g.t += dt * sf;
    const p = g.t % E.geyserCycleS;
    const warnFrom = E.geyserCycleS - E.geyserEruptS - E.geyserWarnS;
    g.warning  = p > warnFrom && p <= E.geyserCycleS - E.geyserEruptS;
    const wasErupting = g.erupting;
    g.erupting = p > E.geyserCycleS - E.geyserEruptS;
    if (g.erupting && !wasErupting) {
      sfx.geyser();
      if (Math.abs(g.x - player.x) < VIEW_W / 2) addShake(1.6);
    }
    if (g.erupting && Math.random() < 26 * dt * fxScale()) {
      particles.push({ x: g.x + (Math.random() - 0.5) * 30, y: g.y - 10,
                       vx: (Math.random() - 0.5) * 90, vy: -180 - Math.random() * 160,
                       life: 0.6, max: 0.6, color: '#ffb03a', r: 2 + Math.random() * 2 });
    }
  }
}
function geyserRect(g) {
  const h = TUNING.enemies.geyserHeight;
  return { x: g.x - 17, y: g.y - h, w: 34, h };
}
function drawGeysers() {
  const E = TUNING.enemies;
  for (const g of LEVEL.geysers) {
    if (g.x < camX - 60 || g.x > camX + VIEW_W + 60) continue;
    // the vent itself
    ctx.fillStyle = '#2e2622';
    ctx.beginPath(); ctx.ellipse(g.x, g.y, 26, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a3020';
    ctx.beginPath(); ctx.ellipse(g.x, g.y - 2, 19, 6, 0, 0, 7); ctx.fill();
    if (g.warning) {
      // bubbling: unmistakable "stand back" moment
      const b = Math.abs(Math.sin(game.time * 16));
      ctx.fillStyle = `rgba(255,140,40,${(0.45 + b * 0.4).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(g.x, g.y - 3, 14 + b * 5, 6 + b * 3, 0, 0, 7); ctx.fill();
      for (let i = 0; i < 3; i++) {
        const bx = g.x + Math.sin(game.time * 9 + i * 2) * 11;
        const by = g.y - 8 - ((game.time * 46 + i * 22) % 34);
        ctx.fillStyle = 'rgba(255,196,90,0.8)';
        ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, 7); ctx.fill();
      }
    }
    if (g.erupting) {
      const h = E.geyserHeight;
      const flick = 0.88 + Math.abs(Math.sin(game.time * 26 + g.x)) * 0.12;
      const cols = [[20, 'rgba(255,86,26,0.9)'], [13, 'rgba(255,152,44,0.95)'],
                    [7, 'rgba(255,226,140,0.95)']];
      for (const [half, col] of cols) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(g.x - half, g.y);
        ctx.quadraticCurveTo(g.x - half * 0.6, g.y - h * flick * 0.6,
                             g.x, g.y - h * flick);
        ctx.quadraticCurveTo(g.x + half * 0.6, g.y - h * flick * 0.6,
                             g.x + half, g.y);
        ctx.closePath(); ctx.fill();
      }
    }
  }
}
// Lava waterfalls: pour from a lip, then ease off so there's a window to run
// through. The lip visibly swells before each surge, so it's never a surprise.
function updateFalls(dt) {
  const E = TUNING.enemies, sf = slowFactor();
  for (const f of LEVEL.falls) {
    f.t += dt * sf;
    const p = f.t % E.fallCycleS;
    const warnFrom = E.fallCycleS - E.fallPourS - E.fallWarnS;
    f.warning = p > warnFrom && p <= E.fallCycleS - E.fallPourS;
    const was = f.pouring;
    f.pouring = p > E.fallCycleS - E.fallPourS;
    const onScreen = Math.abs(f.x - player.x) < VIEW_W / 2;
    if (f.pouring && !was && onScreen) { sfx.lavafall(); addShake(2.2); }
    if (f.pouring && Math.random() < 40 * dt * fxScale()) {
      // molten spray kicking off the splash pool
      particles.push({ x: f.x + (Math.random() - 0.5) * E.fallWidth, y: f.bottom - 4,
                       vx: (Math.random() - 0.5) * 200, vy: -130 - Math.random() * 150,
                       life: 0.6, max: 0.6, color: '#ff9b3d', r: 2 + Math.random() * 3 });
    }
    if (f.pouring && Math.random() < 14 * dt * fxScale()) {
      // steam boiling up either side of the curtain
      particles.push({ x: f.x + (Math.random() < 0.5 ? -1 : 1) * (E.fallWidth * 0.6),
                       y: f.bottom - 10,
                       vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 40,
                       life: 1.1, max: 1.1, color: 'rgba(220,190,180,0.5)', r: 4, heart: true });
    }
  }
}
function fallRect(f) {
  const w = TUNING.enemies.fallWidth;
  return { x: f.x - w / 2, y: f.top, w, h: f.bottom - f.top };
}
function drawFalls() {
  const E = TUNING.enemies, W = E.fallWidth;
  for (const f of LEVEL.falls) {
    if (f.x < camX - 80 || f.x > camX + VIEW_W + 80) continue;
    const h = f.bottom - f.top;
    // the lip it pours from
    ctx.fillStyle = '#3a2b24';
    ctx.fillRect(f.x - W / 2 - 16, f.top - 16, W + 32, 18);
    ctx.fillStyle = '#4d382e';
    ctx.fillRect(f.x - W / 2 - 16, f.top - 16, W + 32, 5);
    if (f.warning) {                     // molten swell at the lip
      const b = Math.abs(Math.sin(game.time * 13));
      ctx.fillStyle = `rgba(255,140,40,${(0.5 + b * 0.4).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(f.x, f.top + 2, W / 2 * (0.7 + b * 0.4), 7 + b * 4, 0, 0, 7);
      ctx.fill();
    }
    if (f.pouring) {
      const wob = Math.sin(game.time * 9 + f.x) * 5;
      // heat glow behind the whole curtain
      const glow = ctx.createLinearGradient(f.x - W, 0, f.x + W, 0);
      glow.addColorStop(0, 'rgba(255,110,30,0)');
      glow.addColorStop(0.5, 'rgba(255,130,40,0.30)');
      glow.addColorStop(1, 'rgba(255,110,30,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(f.x - W, f.top - 10, W * 2, h + 30);
      const layers = [[W / 2, 'rgba(255,70,20,0.9)'],
                      [W / 2.6, 'rgba(255,120,32,0.92)'],
                      [W / 3.6, 'rgba(255,168,54,0.94)'],
                      [W / 6, 'rgba(255,238,170,0.96)']];
      for (const [half, col] of layers) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(f.x - half, f.top);
        ctx.quadraticCurveTo(f.x - half + wob, f.top + h * 0.5, f.x - half * 0.8, f.bottom);
        ctx.lineTo(f.x + half * 0.8, f.bottom);
        ctx.quadraticCurveTo(f.x + half - wob, f.top + h * 0.5, f.x + half, f.top);
        ctx.closePath(); ctx.fill();
      }
      // streaks running down the curtain
      ctx.strokeStyle = 'rgba(255,244,210,0.6)'; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const sx = f.x - W / 2.4 + i * (W / 6);
        const off = (game.time * 420 + i * 70) % h;
        ctx.beginPath();
        ctx.moveTo(sx, f.top + off);
        ctx.lineTo(sx, Math.min(f.bottom, f.top + off + 34));
        ctx.stroke();
      }
      // a big roiling splash pool where it lands
      const pool = Math.abs(Math.sin(game.time * 11));
      ctx.fillStyle = 'rgba(255,120,40,0.55)';
      ctx.beginPath();
      ctx.ellipse(f.x, f.bottom, W * 1.35, 16 + pool * 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,190,90,0.8)';
      ctx.beginPath();
      ctx.ellipse(f.x, f.bottom - 2, W * 0.85, 10 + pool * 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,246,200,0.85)';
      ctx.beginPath();
      ctx.ellipse(f.x, f.bottom - 4, W * 0.4, 5 + pool * 3, 0, 0, 7); ctx.fill();
    } else {
      // between surges: a safe trickle, so the spot still reads as dangerous
      ctx.strokeStyle = 'rgba(255,150,60,0.45)'; ctx.lineWidth = 3;
      const dp = (game.time * 0.6) % 1;
      ctx.beginPath();
      ctx.moveTo(f.x, f.top);
      ctx.lineTo(f.x, f.top + h * 0.18);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,170,70,${(0.8 - dp * 0.7).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(f.x, f.top + h * dp, 3, 5.5, 0, 0, 7); ctx.fill();
    }
  }
}
function drawFireball(b) {
  const flick = 0.85 + Math.abs(Math.sin(game.time * 30 + b.seed)) * 0.15;
  ctx.save();
  ctx.translate(b.x, b.y);
  // trailing flame, streaming behind the direction of travel
  const dir = Math.sign(b.vx) || 1;
  ctx.fillStyle = 'rgba(255,120,40,0.45)';
  ctx.beginPath();
  ctx.moveTo(-dir * 6, -7);
  ctx.quadraticCurveTo(-dir * 26, 0, -dir * 6, 7);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,150,60,0.30)';
  ctx.beginPath(); ctx.arc(0, 0, 15 * flick, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff6a1e';
  ctx.beginPath(); ctx.arc(0, 0, 10 * flick, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffab3c';
  ctx.beginPath(); ctx.arc(0, 0, 6.5 * flick, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffeeb4';
  ctx.beginPath(); ctx.arc(-dir * 1.5, -1, 3.4 * flick, 0, 7); ctx.fill();
  ctx.restore();
}
// Rising slime. It only climbs while Dex is inside the zone, and drains back
// down once he's clear — so dying and retrying always starts from the bottom.
function updateFloods(dt) {
  const T = TUNING.enemies, sf = slowFactor();
  for (const fl of LEVEL.floods) {
    const px = player.x + player.w / 2;
    const inside = px > fl.x1 && px < fl.x2;
    if (inside && !fl.active) { fl.active = true; sfx.flood(); toast('The slime is rising — climb!'); }
    if (!inside) fl.active = false;
    if (fl.active) {
      fl.y = Math.max(fl.topY, fl.y - T.floodRisePx * sf * dt);
    } else {
      fl.y = Math.min(fl.startY, fl.y + T.floodRisePx * T.floodDrainMult * dt);
    }
    if (fl.y < fl.startY && Math.random() < 9 * dt * fxScale()) {
      const fx = fl.x1 + Math.random() * (fl.x2 - fl.x1);
      particles.push({ x: fx, y: floodSurfaceAt(fl, fx),
                       vx: (Math.random() - 0.5) * 26, vy: -34 - Math.random() * 26,
                       life: 1.0, max: 1.0, color: 'rgba(150,255,120,0.6)', r: 3, heart: true });
    }
  }
}
// The slime tapers back down to its resting level over the last stretch at
// each end of the zone, so it never ends in a sheer vertical wall of green —
// and so the hazard matches exactly what's drawn.
const FLOOD_EDGE = 130;
function floodSurfaceAt(fl, x) {
  const t = clamp(Math.min(x - fl.x1, fl.x2 - x) / FLOOD_EDGE, 0, 1);
  const ease = t * t * (3 - 2 * t);
  return fl.startY + (fl.y - fl.startY) * ease;
}
function floodHits(fl, r) {
  if (r.x + r.w < fl.x1 || r.x > fl.x2) return false;
  const feet = r.y + r.h;
  for (const x of [r.x + 2, r.x + r.w / 2, r.x + r.w - 2]) {
    if (x < fl.x1 || x > fl.x2) continue;
    if (feet > floodSurfaceAt(fl, x) + 4) return true;
  }
  return false;
}
function drawFloods() {
  for (const fl of LEVEL.floods) {
    if (fl.x2 < camX - 60 || fl.x1 > camX + VIEW_W + 60) continue;
    const w = fl.x2 - fl.x1, y = fl.y;
    const surf = px => floodSurfaceAt(fl, fl.x1 + px) +
                       Math.sin(px * 0.05 + game.time * 2.4) * 5;
    // glow above the surface
    const g = ctx.createLinearGradient(0, y - 60, 0, y + 6);
    g.addColorStop(0, 'rgba(120,255,90,0)');
    g.addColorStop(1, 'rgba(120,255,90,0.34)');
    ctx.fillStyle = g;
    ctx.fillRect(fl.x1 + FLOOD_EDGE, y - 60, Math.max(0, w - FLOOD_EDGE * 2), 66);
    // The body is deliberately translucent: once it is up over the rooftops it
    // covers most of the screen, and a flat opaque green slab reads as a bug.
    // Murky lets the drowned city and the fire escapes show through it.
    const body = ctx.createLinearGradient(0, y, 0, VIEW_H + 120);
    body.addColorStop(0, 'rgba(126,224,86,0.70)');
    body.addColorStop(0.30, 'rgba(64,158,52,0.82)');
    body.addColorStop(1, 'rgba(18,52,16,0.92)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(fl.x1, VIEW_H + 120);
    for (let px = 0; px <= w; px += 12) {
      ctx.lineTo(fl.x1 + px, surf(px));
    }
    ctx.lineTo(fl.x2, VIEW_H + 120);
    ctx.closePath(); ctx.fill();
    // bubbles drifting up inside it, so the depths aren't a dead pane of green
    const deep = Math.max(0, VIEW_H - y);
    for (let i = 0; i < Math.floor(w / 70); i++) {
      const seed = fl.x1 * 0.02 + i * 5.1, h1 = hash(seed);
      const bx = fl.x1 + 24 + ((i * 131 + h1 * 90) % Math.max(1, w - 48));
      if (bx < fl.x1 + FLOOD_EDGE || bx > fl.x2 - FLOOD_EDGE) continue;  // not in the shallows
      const ph = (game.time * (0.22 + h1 * 0.2) + h1) % 1;
      const by = y + deep - ph * deep;
      ctx.fillStyle = `rgba(178,240,140,${(0.30 * (1 - ph)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(bx, by, 3 + h1 * 6, 0, 7); ctx.fill();
    }
    // bright wobbling surface line
    ctx.strokeStyle = 'rgba(200,255,160,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath();
    for (let px = 0; px <= w; px += 12) {
      const sy = surf(px);
      px === 0 ? ctx.moveTo(fl.x1, sy) : ctx.lineTo(fl.x1 + px, sy);
    }
    ctx.stroke();
    // bubbles breaking the surface
    for (let i = 0; i < Math.floor(w / 90); i++) {
      const seed = fl.x1 * 0.05 + i * 3.7;
      const ph = (game.time * 0.8 + hash(seed)) % 1;
      const bx = fl.x1 + 20 + ((i * 97 + hash(seed) * 60) % Math.max(1, w - 40));
      ctx.fillStyle = `rgba(215,255,175,${(0.8 - ph * 0.75).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(bx, floodSurfaceAt(fl, bx) + 4 - ph * 8, 2.5 + ph * 5, 0, 7);
      ctx.fill();
    }
  }
}
// He is drawn large but not literal: the story keeps its "fifty times bigger",
// the sprite only has to fit on a 960px screen and read as enormous next to a
// 30px cat. Vain, over-dressed, and increasingly cross.
function drawCage() {
  const c = LEVEL.cage;
  if (!c) return;
  if (c.x + c.w < camX - 80 || c.x > camX + VIEW_W + 80) return;
  const sway = Math.sin(game.time * 1.2) * 3;
  ctx.save();
  ctx.translate(c.x + c.w / 2 + sway, c.y);
  // the chain it hangs from
  ctx.strokeStyle = '#6d7a82'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-sway * 2, -240); ctx.stroke();
  // Nova inside, or standing free on top of it
  drawNovaActor(c.open ? 0 : 0, c.open ? -6 : c.h - 6, { scale: 0.9 });
  if (!c.open) {
    ctx.fillStyle = 'rgba(20,28,26,0.28)';
    roundRect(-c.w / 2, 0, c.w, c.h, 8); ctx.fill();
    ctx.strokeStyle = '#8d9aa2'; ctx.lineWidth = 5;
    roundRect(-c.w / 2, 0, c.w, c.h, 8); ctx.stroke();
    ctx.lineWidth = 4;
    for (let i = 1; i < 5; i++) {
      const bx = -c.w / 2 + (c.w / 5) * i;
      ctx.beginPath(); ctx.moveTo(bx, 4); ctx.lineTo(bx, c.h - 4); ctx.stroke();
    }
    // the lock, glowing to say "come here"
    const glow = 0.5 + Math.abs(Math.sin(game.time * 2.6)) * 0.4;
    ctx.fillStyle = `rgba(255,214,130,${glow.toFixed(2)})`;
    ctx.beginPath(); ctx.arc(0, c.h - 10, 13, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a2a10'; ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔒', 0, c.h - 9);
  }
  ctx.restore();
}
// Everything of the King's that can reach Dex, drawn separately from the King
// himself. This function must NEVER early-return on visibility: his beam is
// 1,500px long and his rocks fall the height of the room, so both routinely
// reach places he cannot be seen from.
function drawBossFx() {
  if (!boss) return;
  // The beam. While he's charging it is a thin dashed sighting line and the
  // eye winds up, so you always get most of a second to move before anything
  // can actually hurt you.
  if (boss.laser) {
    const T = TUNING.boss, l = boss.laser, e = l.from;
    const charging = l.state === 'aim';
    const k = charging ? clamp(l.t / T.laserWarnS, 0, 1)
                       : clamp((T.laserFireS - l.t) / (T.laserFireS * 0.35), 0, 1);
    const end = bossLaserEnd(l);
    const beam = (col, width) => {
      ctx.strokeStyle = col; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    };
    ctx.save();
    ctx.lineCap = 'round';
    if (charging) {
      ctx.setLineDash([14, 12]);
      beam('rgba(150,255,120,' + (0.25 + k * 0.4).toFixed(2) + ')', 2 + k * 3);
      ctx.setLineDash([]);
    } else {
      beam('rgba(190,255,150,' + (0.30 * k).toFixed(2) + ')', T.laserH * 2.4);
      beam('rgba(120,255,90,' + (0.90 * k).toFixed(2) + ')', T.laserH);
      beam('rgba(240,255,230,' + (0.95 * k).toFixed(2) + ')', T.laserH * 0.34);
    }
    const glow = charging ? 8 + k * 14 : 22;
    ctx.fillStyle = 'rgba(150,255,120,' + (charging ? (0.3 + k * 0.5).toFixed(2) : '0.85') + ')';
    ctx.beginPath(); ctx.arc(e.x, e.y, glow, 0, 7); ctx.fill();
    ctx.restore();
  }
  // Ceiling coming down. The shadow marks the spot before it falls AND the
  // whole way down — it tightens and darkens as the rock closes, so the floor
  // always tells you where the next one lands.
  for (const r of bossRocks) {
    const warning = r.warn > 0;
    const k = warning ? 1 - clamp(r.warn / TUNING.boss.rockWarnS, 0, 1)
                      : clamp(r.y / (boss.floor - 20), 0, 1);
    const near = warning ? k * 0.5 : 0.5 + k * 0.5;      // 0 → far, 1 → about to land
    ctx.fillStyle = 'rgba(0,0,0,' + (0.16 + near * 0.42).toFixed(2) + ')';
    ctx.beginPath();
    ctx.ellipse(r.x, boss.floor - 4, r.r * (1.5 - near * 0.5), 8 + near * 7, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,140,120,' + (0.30 + near * 0.5).toFixed(2) + ')';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(r.x, boss.floor - 4, r.r * (1.5 - near * 0.5), 8 + near * 7, 0, 0, 7);
    ctx.stroke();
    if (warning) continue;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.y * 0.01);
    ctx.fillStyle = '#6d6459';
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const rad = r.r * (0.78 + ((k * 37) % 11) / 26);
      k === 0 ? ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad)
              : ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a8175';
    ctx.beginPath(); ctx.ellipse(-r.r * 0.25, -r.r * 0.3, r.r * 0.4, r.r * 0.28, 0.4, 0, 7); ctx.fill();
    ctx.restore();
  }
  // shockwaves
  for (const w of bossWaves) {
    const a = clamp(w.life / 3.4, 0, 1);
    ctx.fillStyle = `rgba(190,240,225,${(a * 0.75).toFixed(2)})`;
    const hgt = 26 + Math.sin(game.time * 20 + w.x) * 5;
    ctx.beginPath();
    ctx.moveTo(w.x - 22, boss.floor);
    ctx.quadraticCurveTo(w.x, boss.floor - hgt, w.x + 22, boss.floor);
    ctx.closePath(); ctx.fill();
  }
  // The objective, spelled out. A boss fight where you are not certain what
  // you are trying to achieve is just a room full of hazards, and the jewel
  // counter is what tells you a zap did NOT cost you your progress.
  if (boss.state !== 'cured') {
    const left = Math.max(0, boss.hp);
    ctx.save();
    resetTransform();                            // pin it to the screen
    // bottom-centre: the top strip belongs to the HUD and the toasts, and the
    // touch controls sit hard left and hard right, so this lane is free
    const bw = 330, bx = (VIEW_W - bw) / 2, by = VIEW_H - 62;
    ctx.fillStyle = 'rgba(18,12,26,0.72)';
    roundRect(bx, by, bw, 46, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,130,0.55)'; ctx.lineWidth = 2;
    roundRect(bx, by, bw, 46, 12); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffe6a8';
    ctx.fillText('Cure King Ratthew to free Nova!', VIEW_W / 2, by + 15);
    // one jewel per hit he has left
    const gap = 26, startX = VIEW_W / 2 - ((5 - 1) * gap) / 2;
    for (let i = 0; i < 5; i++) {
      const gx = startX + i * gap, gy = by + 33;
      const got = i < left;
      ctx.fillStyle = got ? '#9dff6a' : 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(gx, gy - 7); ctx.lineTo(gx + 6, gy); ctx.lineTo(gx, gy + 7); ctx.lineTo(gx - 6, gy);
      ctx.closePath(); ctx.fill();
      if (got) {
        ctx.strokeStyle = 'rgba(220,255,190,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
    ctx.restore();
  }
  // The title card on the way in.
  if (boss.cardT > 0) {
    const k = clamp(boss.cardT > 3.6 ? (4.2 - boss.cardT) / 0.6
                                     : Math.min(1, boss.cardT / 0.8), 0, 1);
    ctx.save();
    resetTransform();
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(12,8,18,0.62)';
    ctx.fillRect(0, VIEW_H * 0.30, VIEW_W, 132);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff9db4';
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillText('KING RATTHEW THE THIRD', VIEW_W / 2, VIEW_H * 0.30 + 48);
    ctx.fillStyle = '#ffe6a8';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText('Cure him to free Nova!', VIEW_W / 2, VIEW_H * 0.30 + 92);
    ctx.restore();
  }
}
function drawKing() {
  if (!boss) return;
  const r = bossRect(), sc = boss.scale;
  if (r.x + r.w < camX - 100 || r.x > camX + VIEW_W + 100) return;
  const cured = boss.state === 'cured';
  const cx = r.x + r.w / 2, feet = boss.floor;
  const bob = Math.sin(game.time * 1.6) * 4 * sc;
  const rearing = boss.state === 'leap' && boss.t < TUNING.boss.leapWarnS
                  ? clamp(boss.t / TUNING.boss.leapWarnS, 0, 1) : 0;
  const lean = (boss.state === 'pound' ? 0.10 : 0) - 0.14 * rearing;
  ctx.save();
  ctx.translate(cx, feet);
  ctx.scale(boss.face, 1);
  ctx.rotate(lean - 0.26 * boss.lookUp);       // rears back to aim at the roof
  ctx.scale(sc, sc * bossSquash());
  const W = TUNING.boss.w, H = TUNING.boss.h;
  const fur    = cured ? '#8a6242' : '#4a3f7a';
  const furLit = cured ? '#a67a52' : '#63548f';
  // tail, curling away behind him
  ctx.strokeStyle = fur; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-W * 0.42, -H * 0.22);
  ctx.quadraticCurveTo(-W * 0.86, -H * 0.52 + bob, -W * 0.72, -H * 0.86 + bob * 2);
  ctx.stroke();
  // haunches and belly
  ctx.fillStyle = fur;
  ctx.beginPath(); ctx.ellipse(0, -H * 0.36, W * 0.44, H * 0.38, 0, 0, 7); ctx.fill();
  ctx.fillStyle = furLit;
  ctx.beginPath(); ctx.ellipse(W * 0.10, -H * 0.30, W * 0.30, H * 0.28, 0, 0, 7); ctx.fill();
  // a truly regal cloak
  ctx.fillStyle = cured ? '#7a5340' : '#8e2f4d';
  ctx.beginPath();
  ctx.moveTo(-W * 0.34, -H * 0.62); ctx.lineTo(-W * 0.52, -2);
  ctx.lineTo(W * 0.06, -2); ctx.lineTo(-W * 0.04, -H * 0.62);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(-W * 0.53, -18, W * 0.60, 14);
  // head — thrown back and up when he's aiming at the ceiling
  const hy = -H * 0.74 + bob - H * 0.16 * boss.lookUp;
  ctx.fillStyle = fur;
  ctx.beginPath(); ctx.ellipse(W * 0.16, hy, W * 0.30, H * 0.24, 0, 0, 7); ctx.fill();
  ctx.fillStyle = furLit;                                   // snout
  ctx.beginPath(); ctx.ellipse(W * 0.38, hy + H * 0.06, W * 0.14, H * 0.10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffb9c8';                                // nose
  ctx.beginPath(); ctx.ellipse(W * 0.50, hy + H * 0.06, 7, 6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = fur;                                      // ears
  ctx.beginPath(); ctx.ellipse(W * 0.02, hy - H * 0.20, 26, 30, -0.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#c99ad0';
  ctx.beginPath(); ctx.ellipse(W * 0.02, hy - H * 0.19, 14, 18, -0.2, 0, 7); ctx.fill();
  // eye — a smug half-lid unless he's just been hit
  ctx.fillStyle = cured ? '#2a1c10' : 'rgba(174,243,255,0.95)';
  const eyeH = boss.state === 'hurt' ? 3 : boss.state === 'stunned' ? 2 : 9;
  ctx.beginPath(); ctx.ellipse(W * 0.30, hy - 6, 9, eyeH, 0, 0, 7); ctx.fill();
  if (!cured) {
    ctx.strokeStyle = '#2c2545'; ctx.lineWidth = 4;         // an imperious brow
    ctx.beginPath(); ctx.moveTo(W * 0.22, hy - 20); ctx.lineTo(W * 0.38, hy - 13); ctx.stroke();
  }
  // whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    ctx.moveTo(W * 0.46, hy + H * 0.05);
    ctx.lineTo(W * 0.72, hy + H * 0.05 + k * 16);
    ctx.stroke();
  }
  ctx.restore();
  // the Gamma Crown, drawn upright in world space so it reads as a target
  const c = bossCrownRect();
  if (!cured) {
    const glow = 0.45 + Math.abs(Math.sin(game.time * 3)) * 0.3;
    ctx.fillStyle = `rgba(160,255,120,${glow.toFixed(2)})`;
    ctx.beginPath(); ctx.ellipse(c.x + c.w / 2, c.y + c.h / 2, c.w * 0.9, c.h * 1.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y + c.h);
    ctx.lineTo(c.x, c.y + c.h * 0.4);
    for (let k = 0; k < 4; k++) {
      const t = k / 3;
      ctx.lineTo(c.x + c.w * (t - 0.055), c.y - (k % 2 ? 0 : c.h * 0.35));
      ctx.lineTo(c.x + c.w * (t + 0.055), c.y + c.h * 0.30);
    }
    ctx.lineTo(c.x + c.w, c.y + c.h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9dff6a';
    for (let k = 0; k < boss.hp; k++) {
      ctx.beginPath();
      ctx.arc(c.x + c.w * (0.24 + k * 0.26), c.y + c.h * 0.72, 5, 0, 7);
      ctx.fill();
    }
  }
  // Where he's about to land. This is the whole reason the leap is fair: the
  // marker is on the floor for most of a second before he leaves the ground,
  // and it tracks you until he commits.
  if (boss.state === 'leap') {
    const T = TUNING.boss;
    const warn = clamp(boss.t / T.leapWarnS, 0, 1);
    const committed = boss.t >= T.leapWarnS;
    const w = boss.w * boss.scale * 0.6;
    ctx.save();
    ctx.fillStyle = committed ? 'rgba(255,90,90,0.45)'
                              : 'rgba(255,90,90,' + (0.14 + warn * 0.3).toFixed(2) + ')';
    ctx.beginPath();
    ctx.ellipse(boss.leapTo, boss.floor - 5, w * (0.5 + warn * 0.5), 12 + warn * 7, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,150,150,' + (0.5 + warn * 0.4).toFixed(2) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(boss.leapTo, boss.floor - 5, w * (0.5 + warn * 0.5), 12 + warn * 7, 0, 0, 7);
    ctx.stroke();
    if (!committed) {                       // a little chevron, pointing down
      ctx.fillStyle = 'rgba(255,120,120,' + (0.3 + warn * 0.6).toFixed(2) + ')';
      const yy = boss.floor - 60 - Math.sin(game.time * 9) * 8;
      ctx.beginPath();
      ctx.moveTo(boss.leapTo - 16, yy); ctx.lineTo(boss.leapTo + 16, yy);
      ctx.lineTo(boss.leapTo, yy + 22); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // what he's shouting
  if (boss.shoutT > 0 && boss.shout) {
    ctx.font = '700 17px system-ui, sans-serif';
    const tw = ctx.measureText(boss.shout).width;
    const bx = clamp(cx - tw / 2 - 14, camX + 12, camX + VIEW_W - tw - 40);
    const by = r.y - 74;
    ctx.fillStyle = 'rgba(24,16,34,0.86)';
    roundRect(bx, by, tw + 28, 34, 10); ctx.fill();
    ctx.fillStyle = '#ffe6a8'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(boss.shout, bx + 14, by + 18);
  }
}
function drawChutes() {
  for (const c of LEVEL.chutes) {
    if (c.x2 < camX - 80 || c.x1 > camX + VIEW_W + 80) continue;
    const from = Math.max(c.x1, camX - 60), to = Math.min(c.x2, camX + VIEW_W + 60);
    const step = 10;
    // the slick itself, filled down to well below the screen
    const path = (extra) => {
      ctx.beginPath();
      ctx.moveTo(from, chuteY(c, from));
      for (let x = from; x <= to; x += step) ctx.lineTo(x, chuteY(c, x) + extra);
      ctx.lineTo(to, VIEW_H + 200); ctx.lineTo(from, VIEW_H + 200);
      ctx.closePath();
    };
    ctx.fillStyle = '#243a33'; path(0); ctx.fill();
    ctx.fillStyle = '#31564a'; path(12); ctx.fill();
    // a wet highlight running down the surface
    ctx.strokeStyle = 'rgba(150,230,210,0.75)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = from; x <= to; x += step) {
      const y = chuteY(c, x);
      x === from ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    // the holes: no floor, just a drop
    ctx.fillStyle = '#0b1512';
    for (const [a, b] of c.gaps) {
      if (b < from - 40 || a > to + 40) continue;
      ctx.beginPath();
      ctx.moveTo(a, chuteY(c, a) - 2);
      for (let x = a; x <= b; x += step) ctx.lineTo(x, chuteY(c, x) - 2);
      ctx.lineTo(b, VIEW_H + 200); ctx.lineTo(a, VIEW_H + 200);
      ctx.closePath(); ctx.fill();
    }
    // water racing down past him
    for (let i = 0; i < 26; i++) {
      const sx = from + ((i * 137 + (game.time * 620) % 900) % Math.max(1, to - from));
      const sy = chuteY(c, sx) - 3 - (i % 3) * 4;
      ctx.strokeStyle = 'rgba(180,240,225,0.30)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 26, sy + 4); ctx.stroke();
    }
    // obstacles
    for (const o of c.obs) {
      const r = chuteObsRect(c, o);
      if (r.x + r.w < from - 40 || r.x > to + 40) continue;
      if (o.kind === 'rat') {
        if (o.cured) continue;
        const bob = Math.sin(game.time * 7 + o.x) * 2;
        ctx.save();
        ctx.translate(r.x + r.w / 2, r.y + r.h + bob);
        ctx.fillStyle = '#4a3f7a';                          // hunched, facing uphill
        ctx.beginPath(); ctx.ellipse(0, -13, 20, 13, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-15, -20, 10, 9, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#63548f';
        ctx.beginPath(); ctx.ellipse(-21, -18, 6, 5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(174,243,255,0.9)';            // glitchy eye
        ctx.beginPath(); ctx.arc(-19, -22, 3, 0, 7); ctx.fill();
        ctx.strokeStyle = '#4a3f7a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(18, -12);
        ctx.quadraticCurveTo(34, -18, 30, -30); ctx.stroke();
        ctx.restore();
      } else {
        // a swarm of sewer mosquitoes strung across the pipe
        for (let k = 0; k < 7; k++) {
          const px2 = r.x + 6 + (k * 8.5) % (r.w - 12);
          const py2 = r.y + 12 + Math.sin(game.time * 6 + k * 1.7 + o.x) * 13 + (k % 3) * 14;
          ctx.fillStyle = 'rgba(140,120,170,0.95)';
          ctx.beginPath(); ctx.ellipse(px2, py2, 6, 4.5, 0, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(210,200,255,0.5)';
          ctx.beginPath();
          ctx.ellipse(px2 - 3, py2 - 4, 5, 2.6, -0.5 + Math.sin(game.time * 40 + k) * 0.4, 0, 7);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(120,90,160,0.16)';
        roundRect(r.x, r.y, r.w, r.h, 14); ctx.fill();
      }
    }
  }
}
function drawVines() {
  for (const v of LEVEL.vines) {
    if (v.ax < camX - 200 || v.ax > camX + VIEW_W + 200) continue;
    const e = vineEnd(v), held = player.vine === v;
    // the rope, bowing a little against the swing
    const bow = -Math.sin(v.theta) * 14;
    ctx.strokeStyle = held ? 'rgba(126,196,96,0.95)' : 'rgba(48,104,58,0.9)';
    ctx.lineWidth = held ? 7 : 6; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(v.ax, v.ay);
    ctx.quadraticCurveTo((v.ax + e.x) / 2 + bow, (v.ay + e.y) / 2, e.x, e.y);
    ctx.stroke();
    // leaves down its length
    ctx.fillStyle = 'rgba(70,140,74,0.9)';
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const lx = v.ax + (e.x - v.ax) * t + bow * (1 - Math.abs(t - 0.5) * 2) * 0.6;
      const ly = v.ay + (e.y - v.ay) * t;
      ctx.beginPath(); ctx.ellipse(lx + 8, ly, 9, 4.5, 0.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(lx - 8, ly + 12, 9, 4.5, -0.5, 0, 7); ctx.fill();
    }
    // the knot at the end — the bit you actually aim for
    ctx.fillStyle = held ? '#b8f090' : '#4f9c5a';
    ctx.beginPath(); ctx.arc(e.x, e.y, held ? 9 : 8, 0, 7); ctx.fill();
    if (!held) {                                  // a soft pulse to say "grab me"
      const pulse = 0.25 + Math.abs(Math.sin(game.time * 2.2 + v.phase)) * 0.25;
      ctx.fillStyle = `rgba(180,255,150,${pulse.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, 16, 0, 7); ctx.fill();
    }
  }
}
// Toxic slime: a permanent pool. It bubbles so it reads as alive and nasty,
// but it never changes state — green always means jump.
function updateSlimes(dt) {
  for (const sl of LEVEL.slimes) {
    if (sl.x + sl.w < camX - 60 || sl.x > camX + VIEW_W + 60) continue;
    if (Math.random() < 5 * dt * fxScale()) {
      particles.push({ x: sl.x + Math.random() * sl.w, y: sl.y - 4,
                       vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30,
                       life: 0.9, max: 0.9, color: 'rgba(150,255,120,0.6)', r: 3, heart: true });
    }
  }
}
function slimeRect(sl) { return { x: sl.x, y: sl.y - 10, w: sl.w, h: 24 }; }
function drawSlimes() {
  for (const sl of LEVEL.slimes) {
    if (sl.x + sl.w < camX - 60 || sl.x > camX + VIEW_W + 60) continue;
    const y = sl.y;
    // glow spilling out of the pool
    const g = ctx.createLinearGradient(0, y - 40, 0, y + 12);
    g.addColorStop(0, 'rgba(120,255,90,0)');
    g.addColorStop(1, 'rgba(120,255,90,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(sl.x - 12, y - 40, sl.w + 24, 52);
    // the pool itself, with a wobbling surface
    ctx.fillStyle = '#2f6a24';
    ctx.fillRect(sl.x, y - 2, sl.w, 16);
    ctx.fillStyle = '#5ec93c';
    ctx.beginPath();
    ctx.moveTo(sl.x, y + 12);
    for (let px = 0; px <= sl.w; px += 10) {
      ctx.lineTo(sl.x + px, y - 2 + Math.sin(px * 0.12 + game.time * 3) * 3);
    }
    ctx.lineTo(sl.x + sl.w, y + 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(190,255,150,0.75)';
    ctx.beginPath();
    ctx.moveTo(sl.x, y + 4);
    for (let px = 0; px <= sl.w; px += 10) {
      ctx.lineTo(sl.x + px, y - 1 + Math.sin(px * 0.12 + game.time * 3) * 3);
    }
    ctx.lineTo(sl.x + sl.w, y + 4);
    ctx.closePath(); ctx.fill();
    // bubbles swelling and popping on the surface
    for (let i = 0; i < Math.max(2, Math.floor(sl.w / 42)); i++) {
      const seed = sl.x * 0.07 + i * 2.3;
      const ph = (game.time * 0.7 + hash(seed)) % 1;
      const bx = sl.x + 14 + ((i * 47 + hash(seed) * 30) % Math.max(1, sl.w - 28));
      const br = 2 + ph * 5;
      ctx.fillStyle = `rgba(210,255,170,${(0.75 - ph * 0.7).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(bx, y + 1 - ph * 5, br, 0, 7); ctx.fill();
    }
  }
}
function updateEmitters(dt) {
  for (const em of LEVEL.emitters) {
    if (em.x + em.w < camX - 60 || em.x > camX + VIEW_W + 60) continue;
    if (Math.random() < em.rate * dt * fxScale()) {
      particles.push({ x: em.x + Math.random() * em.w, y: em.y + Math.random() * 40,
                       vx: (Math.random() - 0.5) * 16, vy: -35 - Math.random() * 25,
                       life: 1.1, max: 1.1, color: '#ffe9a0', r: 2, heart: true });
    }
  }
}
function updateCamera(dt) {
  // mid-arc Dex is pushed further left so the landing comes into view early
  // enough to lean towards. At 620px/s the normal framing shows it too late.
  const offX = player.flight ? TUNING.camera.flightOffsetX : TUNING.camera.offsetX;
  const target = clamp(player.x - offX, 0, LEVEL.width - VIEW_W);
  camX += (target - camX) * Math.min(1, TUNING.camera.lerp * dt);
  // settle completely once close — no slow background creep while Dex stands still
  if (Math.abs(target - camX) < 0.5) camX = target;
  const ty = player.sliding ? Math.max(0, player.y - TUNING.camera.slideOffsetY) : 0;
  camY += (ty - camY) * Math.min(1, TUNING.camera.lerp * dt);
  if (Math.abs(ty - camY) < 0.5) camY = ty;
}

/* ------------------------------------------------------------- 10. RENDER */
const lerp = (a, b, t) => a + (b - a) * t;
function lerpColor(c1, c2, t) {
  const r = Math.round(lerp(c1[0], c2[0], t)),
        g = Math.round(lerp(c1[1], c2[1], t)),
        b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r},${g},${b})`;
}
/* ------------------------------------------------------------- THEMES ----
   A theme owns everything that makes a level *look* like somewhere: the four
   colour moods it drifts through, the backdrop behind the action, and the
   colours of the ground and platforms. Adding a new setting means adding one
   entry here and naming it in the level's `theme` field.                    */
const THEMES = {
  canyon: {
    palette: [
      { skyTop: [126, 199, 255], skyBot: [222, 245, 255], hillFar: [148, 205, 158], hillNear: [96, 176, 116] },
      { skyTop: [96, 178, 199],  skyBot: [206, 240, 226], hillFar: [98, 168, 132],  hillNear: [64, 138, 96] },
      { skyTop: [122, 116, 196], skyBot: [230, 205, 235], hillFar: [150, 122, 168], hillNear: [110, 88, 140] },
      { skyTop: [244, 148, 92],  skyBot: [255, 224, 168], hillFar: [206, 122, 96],  hillNear: [160, 88, 76] },
    ],
    ground: { body: '#8a5a3b', speck: '#6e4227', top: '#5abf4a', topLit: '#7fdc6b' },
    float:  { body: '#98a0b5', top: '#5abf4a' },
    backdrop(pal) {
      drawSun(); drawClouds();
      drawHills(0.22, 340, pal.hillFar, 46, 0.0042, 60, 0.0013);
      drawHills(0.42, 400, pal.hillNear, 34, 0.006, 44, 0.0021);
      drawTrees();
    },
  },
  // Steamy tangled jungle: layered canopy, hanging vines, shafts of green light.
  jungle: {
    palette: [
      { skyTop: [118, 196, 168], skyBot: [214, 244, 214], hillFar: [96, 158, 106], hillNear: [58, 122, 76] },
      { skyTop: [96, 176, 150],  skyBot: [198, 236, 200], hillFar: [82, 146, 96],  hillNear: [46, 108, 68] },
      { skyTop: [122, 176, 128], skyBot: [206, 238, 186], hillFar: [92, 150, 88],  hillNear: [52, 112, 60] },
      { skyTop: [150, 186, 118], skyBot: [228, 242, 182], hillFar: [116, 158, 84], hillNear: [70, 118, 58] },
    ],
    ground: { body: '#6b4a2e', speck: '#553a24', top: '#4d9c46', topLit: '#6fc45c' },
    float:  { body: '#7c5a3a', top: '#4d9c46' },
    backdrop(pal) { drawJungle(pal); },
  },
  // Ash, basalt and a river of lava far below.
  volcano: {
    palette: [
      { skyTop: [64, 30, 34], skyBot: [140, 62, 44], hillFar: [78, 44, 44], hillNear: [52, 32, 34] },
      { skyTop: [78, 32, 30], skyBot: [166, 74, 44], hillFar: [92, 48, 42], hillNear: [60, 34, 32] },
      { skyTop: [92, 34, 28], skyBot: [190, 86, 42], hillFar: [104, 52, 40], hillNear: [68, 36, 30] },
      { skyTop: [110, 38, 26], skyBot: [214, 104, 44], hillFar: [120, 58, 38], hillNear: [78, 40, 28] },
    ],
    ground: { body: '#3b302c', speck: '#2a221f', top: '#57433a', topLit: '#7a5a48' },
    float:  { body: '#4a3a34', top: '#7a5a48' },
    backdrop(pal) { drawVolcano(pal); },
  },
  // Rooftops under a sickly green haze, neon burning through the smog.
  city: {
    palette: [
      { skyTop: [26, 24, 52], skyBot: [72, 96, 88], hillFar: [44, 54, 68], hillNear: [30, 38, 50] },
      { skyTop: [30, 26, 58], skyBot: [86, 112, 90], hillFar: [50, 60, 72], hillNear: [34, 42, 54] },
      { skyTop: [24, 30, 48], skyBot: [96, 126, 96], hillFar: [46, 62, 66], hillNear: [30, 44, 48] },
      { skyTop: [34, 28, 56], skyBot: [110, 140, 100], hillFar: [56, 70, 74], hillNear: [38, 48, 56] },
    ],
    ground: { body: '#3c4048', speck: '#2d3037', top: '#5a6070', topLit: '#79808f' },
    float:  { body: '#4a4f5a', top: '#79808f' },
    backdrop(pal) { drawCity(pal); },
  },
  // Where King Ratthew hides. Brick tunnels, pipes and murky green water.
  sewer: {
    palette: [
      { skyTop: [26, 34, 30], skyBot: [52, 66, 52], hillFar: [44, 58, 46], hillNear: [34, 46, 36] },
      { skyTop: [24, 32, 34], skyBot: [46, 64, 60], hillFar: [40, 58, 52], hillNear: [30, 44, 40] },
      { skyTop: [30, 30, 26], skyBot: [62, 62, 46], hillFar: [52, 54, 40], hillNear: [38, 40, 30] },
      { skyTop: [34, 26, 32], skyBot: [70, 52, 62], hillFar: [58, 44, 54], hillNear: [42, 32, 40] },
    ],
    ground: { body: '#4b4a42', speck: '#3a3931', top: '#5d6b4a', topLit: '#7a8a5e' },
    float:  { body: '#6b6a60', top: '#7a8a5e' },
    backdrop(pal) {
      drawSewerTunnel(pal);
    },
  },
};
const theme = () => THEMES[LEVEL.theme] || THEMES.canyon;
function palAt(x) {
  const PAL = theme().palette;
  const p = clamp(x / LEVEL.width * 4 - 0.5, 0, 3);
  const i = Math.min(2, Math.floor(p)), t = clamp(p - i, 0, 1);
  const a = PAL[i], b = PAL[Math.min(3, i + 1)];
  return {
    skyTop: lerpColor(a.skyTop, b.skyTop, t), skyBot: lerpColor(a.skyBot, b.skyBot, t),
    hillFar: lerpColor(a.hillFar, b.hillFar, t), hillNear: lerpColor(a.hillNear, b.hillNear, t),
  };
}
// Layered tower blocks, lit windows, neon signs and a green haze rolling through.
function drawCity(pal) {
  // three depths of building silhouettes
  const layers = [
    { f: 0.10, base: 470, w: 150, minH: 150, maxH: 260, col: pal.hillFar,  lit: 0.16 },
    { f: 0.24, base: 476, w: 120, minH: 110, maxH: 210, col: pal.hillNear, lit: 0.30 },
    { f: 0.44, base: 482, w: 96,  minH: 70,  maxH: 150, col: '#232a36',    lit: 0.5 },
  ];
  for (const L of layers) {
    const first = Math.floor((camX * L.f - 200) / L.w);
    for (let i = first; i < first + Math.ceil(VIEW_W / L.w) + 3; i++) {
      const sx = i * L.w - camX * L.f;
      if (sx < -L.w - 20 || sx > VIEW_W + 20) continue;
      const h = L.minH + hash(i * 1.7 + L.f * 10) * (L.maxH - L.minH);
      ctx.fillStyle = L.col;
      ctx.fillRect(sx, L.base - h, L.w - 8, h);
      // roof clutter: a water tower or an aerial
      const cl = hash(i * 3.1 + L.f);
      if (cl > 0.7) {
        ctx.fillRect(sx + L.w * 0.5, L.base - h - 16, 10, 16);
        ctx.fillRect(sx + L.w * 0.42, L.base - h - 22, 26, 8);
      } else if (cl > 0.5) {
        ctx.fillRect(sx + L.w * 0.6, L.base - h - 24, 3, 24);
      }
      // Lit windows. Seed these from the building index and the window's row
      // and column — NEVER from sx/wx, which are screen coordinates. Those
      // slide every frame as the camera follows Dex, so the hash re-rolls
      // constantly and the whole skyline strobes the moment he starts running.
      let row = 0;
      for (let wy = L.base - h + 14; wy < L.base - 14; wy += 20, row++) {
        let col = 0;
        for (let wx = sx + 10; wx < sx + L.w - 18; wx += 18, col++) {
          const on = hash(i * 4.13 + row * 1.77 + col * 0.53 + L.f * 97);
          if (on < L.lit) {
            ctx.fillStyle = on < L.lit * 0.35 ? 'rgba(180,255,150,0.55)' : 'rgba(255,214,130,0.6)';
            ctx.fillRect(wx, wy, 8, 10);
            ctx.fillStyle = L.col;
          }
        }
      }
      // the odd neon sign on the nearest layer
      if (L.f > 0.4 && hash(i * 5.3) > 0.72) {
        const ny = L.base - h + 30;
        const hue = hash(i * 7.7) > 0.5 ? '150,255,120' : '255,120,190';
        const flick = Math.sin(game.time * 9 + i) > -0.75 ? 1 : 0.3;
        ctx.fillStyle = `rgba(${hue},${(0.25 * flick).toFixed(2)})`;
        ctx.fillRect(sx + 8, ny - 6, L.w - 24, 22);
        ctx.fillStyle = `rgba(${hue},${(0.9 * flick).toFixed(2)})`;
        ctx.fillRect(sx + 14, ny, L.w - 36, 5);
        ctx.fillRect(sx + 14, ny + 8, (L.w - 36) * 0.6, 4);
      }
    }
  }
  // green haze rolling through at street level
  const haze = ctx.createLinearGradient(0, 330, 0, 500);
  haze.addColorStop(0, 'rgba(120,200,110,0)');
  haze.addColorStop(1, 'rgba(120,200,110,0.22)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 330, VIEW_W, 180);
  for (let i = 0; i < 5; i++) {
    const hx = ((i * 260 - camX * 0.2 - game.time * 9) % (VIEW_W + 320)) - 160;
    ctx.fillStyle = 'rgba(140,210,130,0.10)';
    ctx.beginPath(); ctx.ellipse(hx, 430 + Math.sin(game.time * 0.5 + i) * 8, 150, 34, 0, 0, 7); ctx.fill();
  }
}
// Ash falling, volcanic cones, and a glowing lava river across the valley.
function drawVolcano(pal) {
  // distant cones
  ctx.fillStyle = pal.hillFar;
  const cFirst = Math.floor((camX * 0.14 - 300) / 520);
  for (let i = cFirst; i < cFirst + 5; i++) {
    const sx = i * 520 + hash(i) * 180 - camX * 0.14;
    if (sx < -320 || sx > VIEW_W + 320) continue;
    const peak = 120 + hash(i + 3) * 70;
    ctx.beginPath();
    ctx.moveTo(sx - 250, 430); ctx.lineTo(sx, peak); ctx.lineTo(sx + 250, 430);
    ctx.closePath(); ctx.fill();
    // glowing crater and a lazy smoke plume
    ctx.fillStyle = 'rgba(255,140,50,0.75)';
    ctx.beginPath(); ctx.ellipse(sx, peak + 4, 18, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(120,100,96,0.35)';
    for (let k = 0; k < 3; k++) {
      const py = peak - 22 - k * 30 - Math.sin(game.time * 0.5 + k + i) * 6;
      ctx.beginPath(); ctx.arc(sx + Math.sin(game.time * 0.4 + k) * 14, py, 16 + k * 7, 0, 7); ctx.fill();
    }
    ctx.fillStyle = pal.hillFar;
  }
  // a river of lava glowing across the middle distance
  const ly = 402;
  ctx.fillStyle = 'rgba(255,110,36,0.85)';
  ctx.fillRect(0, ly, VIEW_W, 16);
  ctx.fillStyle = 'rgba(255,206,120,0.8)';
  for (let sx = 0; sx <= VIEW_W; sx += 8) {
    const wx = sx + camX * 0.26;
    ctx.fillRect(sx, ly + 4 + Math.sin(wx * 0.03 + game.time * 1.6) * 3, 8, 5);
  }
  ctx.fillStyle = 'rgba(60,36,32,0.9)';       // crusted rock over the river
  for (let i = 0; i < 12; i++) {
    const rx = (i * 190 - camX * 0.26) % (VIEW_W + 240) - 120;
    ctx.beginPath(); ctx.ellipse(rx, ly + 8, 34 + hash(i) * 24, 7, 0, 0, 7); ctx.fill();
  }
  // near ridges
  drawHills(0.5, 452, pal.hillNear, 26, 0.006, 34, 0.0022);
  // ash drifting down, and embers rising
  for (let i = 0; i < 22; i++) {
    const ax = (i * 137 + hash(i) * 90 - camX * 0.35) % (VIEW_W + 120) - 60;
    const ay = (game.time * (16 + hash(i + 4) * 18) + hash(i) * 500) % (VIEW_H + 60) - 30;
    ctx.fillStyle = 'rgba(190,176,168,0.35)';
    ctx.beginPath(); ctx.arc(ax, ay, 1.4 + hash(i + 9), 0, 7); ctx.fill();
  }
  for (let i = 0; i < 10; i++) {
    const ex = (i * 211 + hash(i + 30) * 120 - camX * 0.45) % (VIEW_W + 120) - 60;
    const ey = VIEW_H - ((game.time * (52 + hash(i) * 40) + hash(i) * 400) % (VIEW_H + 80));
    ctx.fillStyle = `rgba(255,${140 + Math.floor(hash(i) * 80)},60,0.7)`;
    ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, 7); ctx.fill();
  }
}
// Deep canopy, hanging vines and shafts of green light through the leaves.
function drawJungle(pal) {
  // far canopy: overlapping leaf clumps along the top
  ctx.fillStyle = pal.hillFar;
  const cFirst = Math.floor((camX * 0.18 - 120) / 150);
  for (let i = cFirst; i < cFirst + 10; i++) {
    const sx = i * 150 - camX * 0.18;
    if (sx < -140 || sx > VIEW_W + 140) continue;
    const r = 70 + hash(i) * 46;
    ctx.beginPath(); ctx.arc(sx, 40 + hash(i + 5) * 40, r, 0, 7); ctx.fill();
  }
  // shafts of light slanting down between the leaves
  for (let i = 0; i < 4; i++) {
    const sx = ((i * 280 - camX * 0.3) % (VIEW_W + 380)) - 120;
    const g = ctx.createLinearGradient(sx, 60, sx + 120, 470);
    g.addColorStop(0, 'rgba(226,255,190,0.16)');
    g.addColorStop(1, 'rgba(226,255,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx, 60); ctx.lineTo(sx + 66, 60);
    ctx.lineTo(sx + 150, 470); ctx.lineTo(sx + 40, 470);
    ctx.closePath(); ctx.fill();
  }
  // mid trunks with buttress roots
  const tFirst = Math.floor((camX * 0.4 - 140) / 260);
  for (let i = tFirst; i < tFirst + 7; i++) {
    const sx = i * 260 + hash(i) * 90 - camX * 0.4;
    if (sx < -90 || sx > VIEW_W + 90) continue;
    ctx.fillStyle = 'rgba(58,42,28,0.55)';
    const tw = 22 + hash(i + 3) * 14;
    ctx.fillRect(sx - tw / 2, 90, tw, 390);
    ctx.beginPath();                                    // roots flaring out
    ctx.moveTo(sx - tw / 2 - 22, 480); ctx.lineTo(sx - tw / 2, 400);
    ctx.lineTo(sx + tw / 2, 400); ctx.lineTo(sx + tw / 2 + 22, 480);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.hillNear;                       // leaf cluster on top
    ctx.beginPath(); ctx.arc(sx, 96, 44 + hash(i + 9) * 20, 0, 7); ctx.fill();
  }
  // near hills of undergrowth
  drawHills(0.55, 430, pal.hillNear, 30, 0.0055, 40, 0.002);
  // hanging vines that sway
  const vFirst = Math.floor((camX * 0.7 - 100) / 165);
  for (let i = vFirst; i < vFirst + 9; i++) {
    const sx = i * 165 + hash(i * 1.7) * 70 - camX * 0.7;
    if (sx < -40 || sx > VIEW_W + 40) continue;
    const len = 90 + hash(i + 11) * 150;
    const sway = Math.sin(game.time * 0.7 + i) * 12;
    ctx.strokeStyle = 'rgba(48,104,58,0.75)'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx, 60);
    ctx.quadraticCurveTo(sx + sway * 0.5, 60 + len * 0.6, sx + sway, 60 + len);
    ctx.stroke();
    ctx.fillStyle = 'rgba(70,140,74,0.8)';              // leaves down the vine
    for (let L = 1; L <= 3; L++) {
      const t = L / 4, lx = sx + sway * t, ly = 60 + len * t;
      ctx.beginPath(); ctx.ellipse(lx + 6, ly, 8, 4, 0.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(lx - 6, ly + 14, 8, 4, -0.5, 0, 7); ctx.fill();
    }
  }
}
// Receding brick arches, dripping pipes and a channel of murky water.
function drawSewerTunnel(pal) {
  // brick back wall
  ctx.fillStyle = pal.hillFar;
  ctx.fillRect(0, 60, VIEW_W, VIEW_H - 60);
  const bw = 62, bh = 26, off = (camX * 0.25) % (bw * 2);
  for (let row = 0; row * bh < VIEW_H; row++) {
    for (let bx = -bw * 2; bx < VIEW_W + bw * 2; bx += bw) {
      const px = bx - off + (row % 2 ? bw / 2 : 0);
      const sh = hash(row * 7.3 + Math.round(px / bw) * 3.1);
      ctx.fillStyle = `rgba(${sh > 0.5 ? '255,255,240' : '0,0,0'},${(0.03 + sh * 0.05).toFixed(3)})`;
      ctx.fillRect(px + 1, 60 + row * bh + 1, bw - 3, bh - 3);
    }
  }
  // big arches marching into the distance
  const aSpace = 340, aFirst = Math.floor((camX * 0.45 - 200) / aSpace);
  for (let i = aFirst; i < aFirst + 5; i++) {
    const sx = i * aSpace - camX * 0.45;
    if (sx < -260 || sx > VIEW_W + 260) continue;
    ctx.fillStyle = 'rgba(12,18,14,0.5)';
    ctx.beginPath();
    ctx.moveTo(sx - 110, 470);
    ctx.lineTo(sx - 110, 250);
    ctx.quadraticCurveTo(sx, 120, sx + 110, 250);
    ctx.lineTo(sx + 110, 470);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(150,160,130,0.28)'; ctx.lineWidth = 7;
    ctx.stroke();
  }
  // pipes along the ceiling, with the odd drip
  ctx.fillStyle = '#3f4a40';
  ctx.fillRect(0, 44, VIEW_W, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, 46, VIEW_W, 5);
  const pFirst = Math.floor((camX * 0.6 - 100) / 190);
  for (let i = pFirst; i < pFirst + 8; i++) {
    const sx = i * 190 - camX * 0.6;
    if (sx < -40 || sx > VIEW_W + 40) continue;
    ctx.fillStyle = '#55604f';
    ctx.fillRect(sx - 9, 40, 18, 30);
    ctx.fillStyle = '#39423a';
    ctx.fillRect(sx - 12, 66, 24, 7);
    if (hash(i * 2.7) > 0.55) {                       // a slow drip
      const dp = ((game.time * 0.5) + hash(i)) % 1;
      ctx.fillStyle = `rgba(150,220,150,${(0.75 - dp * 0.6).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(sx, 76 + dp * 300, 2.4, 4.5, 0, 0, 7); ctx.fill();
    }
  }
  // murky water channel below the walkway
  const wy = 500;
  ctx.fillStyle = 'rgba(74,120,66,0.75)';
  ctx.fillRect(0, wy, VIEW_W, VIEW_H - wy);
  ctx.strokeStyle = 'rgba(170,235,150,0.35)'; ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    for (let sx = 0; sx <= VIEW_W; sx += 24) {
      const wx = sx + camX * 0.3;
      const yy = wy + 8 + i * 12 + Math.sin(wx * 0.02 + game.time * 1.4 + i) * 3;
      sx === 0 ? ctx.moveTo(sx, yy) : ctx.lineTo(sx, yy);
    }
    ctx.stroke();
  }
}
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

function render() {
  if (game.state === 'intro') { renderIntro(); return; }
  // the treehouse room (also shown behind the workshop maths overlay)
  if (game.state === 'treehouse' || (game.state === 'math' && mathContext === 'build')) {
    renderTreehouseRoom();
    if (fadeAlpha > 0) {
      ctx.fillStyle = `rgba(10,14,35,${fadeAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    return;
  }
  const pal = palAt(camX + VIEW_W / 2);
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, pal.skyTop); sky.addColorStop(1, pal.skyBot);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  theme().backdrop(pal);

  ctx.save();
  const shx = (Math.random() * 2 - 1) * shakeMag, shy = (Math.random() * 2 - 1) * shakeMag;
  ctx.translate(-Math.round(camX) + shx, -Math.round(camY) + shy);
  drawSigns();
  drawShards();
  drawPlatforms();
  drawSpikes();
  drawCheckpoints();
  drawPortal();
  drawCrystals();
  drawCaches();
  drawCage();
  drawKing();
  drawBossFx();
  drawChutes();
  drawVines();
  drawSlimes();
  drawFloods();
  drawGeysers();
  drawFalls();
  drawEnemies();
  drawBolts();
  drawPlayer();
  drawRings();
  drawParticles();
  if (DEBUG_MODE) drawDebugBoxes();
  ctx.restore();

  drawTimeBubbleFx();
  drawFocusHint();
  if (fadeAlpha > 0) {
    ctx.fillStyle = `rgba(10,14,35,${fadeAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}
// If the level has been running for a couple of seconds and no key or tap has
// ever arrived, the page almost certainly hasn't got keyboard focus. Say so,
// instead of leaving a child staring at a cat that won't move.
function drawFocusHint() {
  if (sawInput || game.state !== 'playing' || game.time < 2) return;
  const pulse = 0.75 + Math.sin(game.time * 3) * 0.25;
  ctx.textAlign = 'center';
  ctx.font = '900 26px "Segoe UI", sans-serif';
  const msg = '👆 Click the game to start playing!';
  const w = ctx.measureText(msg).width + 60;
  ctx.fillStyle = `rgba(12,18,48,${(0.85 * pulse).toFixed(3)})`;
  roundRect(VIEW_W / 2 - w / 2, VIEW_H / 2 - 46, w, 92, 18); ctx.fill();
  ctx.strokeStyle = `rgba(255,206,84,${pulse.toFixed(3)})`; ctx.lineWidth = 4;
  roundRect(VIEW_W / 2 - w / 2, VIEW_H / 2 - 46, w, 92, 18); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.fillText(msg, VIEW_W / 2, VIEW_H / 2 - 6);
  ctx.font = '800 17px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffe9b8';
  ctx.fillText('then use ← → to run and SPACE to jump', VIEW_W / 2, VIEW_H / 2 + 24);
}
function drawSun() {
  ctx.fillStyle = 'rgba(255,244,190,0.9)';
  ctx.beginPath(); ctx.arc(820, 90, 42, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,244,190,0.28)';
  ctx.beginPath(); ctx.arc(820, 90, 62, 0, 7); ctx.fill();
}
function drawClouds() {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 10; i++) {
    const wx = i * 1200 + hash(i) * 700;
    let sx = (wx - camX * 0.3 - game.time * 8) % (LEVEL.width * 0.3 + VIEW_W);
    if (sx < -200) sx += LEVEL.width * 0.3 + VIEW_W;
    const sy = 50 + hash(i + 40) * 120, r = 18 + hash(i + 80) * 16;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, 7);
    ctx.arc(sx + r * 0.9, sy + 4, r * 0.75, 0, 7);
    ctx.arc(sx - r * 0.9, sy + 5, r * 0.7, 0, 7);
    ctx.fill();
  }
}
function drawHills(f, base, color, a1, w1, a2, w2) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let sx = 0; sx <= VIEW_W; sx += 16) {
    const wx = sx + camX * f;
    ctx.lineTo(sx, base - Math.abs(Math.sin(wx * w1)) * a1 - Math.abs(Math.sin(wx * w2)) * a2);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.closePath(); ctx.fill();
}
function drawTrees() {
  const f = 0.6;
  const first = Math.floor((camX * f - 100) / 260);
  for (let i = first; i < first + 6; i++) {
    if (i < 0) continue;
    const wx = i * 260 + hash(i) * 140;
    const sx = wx - camX * f;
    if (sx < -80 || sx > VIEW_W + 80) continue;
    const h = 70 + hash(i + 7) * 60, ty = 470;
    ctx.fillStyle = 'rgba(90,64,44,0.55)';
    ctx.fillRect(sx - 5, ty - h, 10, h);
    ctx.fillStyle = hash(i + 13) > 0.5 ? 'rgba(70,140,90,0.6)' : 'rgba(96,120,170,0.5)';
    ctx.beginPath(); ctx.arc(sx, ty - h, 26 + hash(i + 3) * 16, 0, 7); ctx.fill();
    // gentle sway sparkle on some trees (animated environmental detail)
    if (hash(i + 21) > 0.72) {
      ctx.fillStyle = 'rgba(255,240,180,0.5)';
      ctx.beginPath();
      ctx.arc(sx + Math.sin(game.time * 1.5 + i) * 10, ty - h - 14, 2.5, 0, 7);
      ctx.fill();
    }
  }
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
/* A crystal geode: a cluster of facets that squashes flat and flares when Dex
   lands on it, so the launch is something the geode visibly DID rather than
   something that merely happened. */
function drawGeode(s) {
  const k = s.fire || 0;                      // 0.32 → 0 over a third of a second
  const squash = 1 - k * 0.55;                // flattens on impact
  // draw the visible crystals only — s.y/s.h are the tall trigger column
  const cx = s.x + s.w / 2, base = s.baseY;
  const h = (s.visH || 30) * squash, w = s.w * (1 + k * 0.18);
  ctx.save();
  // the glow it throws while firing
  if (k > 0) {
    ctx.globalAlpha = k * 2.4;
    ctx.fillStyle = '#7de3ff';
    ctx.beginPath(); ctx.ellipse(cx, base - h, w * 0.75, h * 1.5, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // three facets, tallest in the middle
  const facets = [[-0.42, 0.55], [-0.08, 1], [0.3, 0.72]];
  for (const [off, tall] of facets) {
    const fx = cx + off * w, fh = h * tall * 1.5;
    const grad = ctx.createLinearGradient(fx, base - fh, fx, base);
    grad.addColorStop(0, '#bff2ff'); grad.addColorStop(0.5, '#5fc8f0');
    grad.addColorStop(1, '#2f7bb0');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(fx, base - fh);
    ctx.lineTo(fx + w * 0.15, base - fh * 0.35);
    ctx.lineTo(fx + w * 0.11, base);
    ctx.lineTo(fx - w * 0.11, base);
    ctx.lineTo(fx - w * 0.15, base - fh * 0.35);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(fx, base - fh);
    ctx.lineTo(fx + w * 0.05, base - fh * 0.4);
    ctx.lineTo(fx - w * 0.04, base - fh * 0.4);
    ctx.closePath(); ctx.fill();
  }
  // the rocky collar it grows out of
  ctx.fillStyle = '#4a4568';
  roundRect(s.x + 2, base - 8, s.w - 4, 8, 4); ctx.fill();
  ctx.restore();
}
function updatePads(dt) {
  if (game.state !== 'playing') return;      // level furniture, level only
  for (const pad of (LEVEL.pads || [])) {
    if (pad.fire > 0) pad.fire = Math.max(0, pad.fire - dt * 3.2);
    // launchT doubles as the re-trigger guard: while it runs Dex is already on
    // his way up, so overlapping the same geode cannot fire it twice
    if (!player.flight && player.launchT <= 0 && overlap(player, pad)) bouncePad(pad);
  }
}
function drawPlatforms() {
  for (const pad of (LEVEL.pads || [])) {
    if (pad.x + pad.w < camX - 40 || pad.x > camX + VIEW_W + 40) continue;
    drawGeode(pad);
  }
  for (const s of LEVEL.solids) {
    if (s.x + s.w < camX - 40 || s.x > camX + VIEW_W + 40) continue;
    const T = theme();
    if (s.kind === 'ground') {
      ctx.fillStyle = T.ground.body; ctx.fillRect(s.x, s.y, s.w, VIEW_H - s.y + 40);
      ctx.fillStyle = T.ground.speck;
      for (let i = 0; i < s.w / 60; i++) {
        const px = s.x + 14 + (i * 60 + hash(s.x + i) * 30) % (s.w - 26);
        ctx.fillRect(px, s.y + 26 + hash(px) * 30, 10, 6);
      }
      ctx.fillStyle = T.ground.top; ctx.fillRect(s.x, s.y, s.w, 14);
      ctx.fillStyle = T.ground.topLit; ctx.fillRect(s.x, s.y, s.w, 5);
    } else {
      ctx.fillStyle = T.float.body; roundRect(s.x, s.y, s.w, s.h, 6); ctx.fill();
      ctx.fillStyle = T.float.top; ctx.fillRect(s.x + 2, s.y, s.w - 4, 8);
    }
  }
  for (const m of LEVEL.movers) {
    ctx.fillStyle = '#7a5ec9'; roundRect(m.x, m.y, m.w, m.h, 7); ctx.fill();
    ctx.fillStyle = '#a68ef0'; ctx.fillRect(m.x + 3, m.y + 3, m.w - 6, 5);
    ctx.fillStyle = '#4d3a85';
    ctx.beginPath(); ctx.arc(m.x + 10, m.y + m.h - 6, 3, 0, 7);
    ctx.arc(m.x + m.w - 10, m.y + m.h - 6, 3, 0, 7); ctx.fill();
  }
  for (const c of LEVEL.crumblers) {
    if (c.state === 'gone') {
      ctx.strokeStyle = 'rgba(210,200,175,0.4)';
      ctx.setLineDash([5, 6]);
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      ctx.setLineDash([]);
      continue;
    }
    const ox = c.state === 'shaking' ? Math.sin(game.time * 55) * 2.4 : 0;
    ctx.fillStyle = '#d8ccb0'; roundRect(c.x + ox, c.y, c.w, c.h, 5); ctx.fill();
    ctx.strokeStyle = '#a4977a'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x + ox + c.w * 0.3, c.y + 2); ctx.lineTo(c.x + ox + c.w * 0.42, c.y + c.h - 2);
    ctx.moveTo(c.x + ox + c.w * 0.68, c.y + 2); ctx.lineTo(c.x + ox + c.w * 0.6, c.y + c.h - 2);
    ctx.stroke();
  }
  if (game.assistLevel >= 2) {
    const hp = LEVEL.helper;
    ctx.fillStyle = '#ffd24d'; roundRect(hp.x, hp.y, hp.w, hp.h, 8); ctx.fill();
    ctx.fillStyle = '#fff1b8'; ctx.fillRect(hp.x + 3, hp.y + 3, hp.w - 6, 4);
  }
}
function drawSpikes() {
  for (const s of LEVEL.spikes) {
    ctx.fillStyle = '#5b6270';
    for (let px = s.x; px < s.x + s.w; px += 14) {
      ctx.beginPath();
      ctx.moveTo(px, s.y + s.h);
      ctx.lineTo(px + 7, s.y);
      ctx.lineTo(px + 14, s.y + s.h);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#e8ecf5';
    for (let px = s.x; px < s.x + s.w; px += 14) {
      ctx.beginPath();
      ctx.moveTo(px + 4.5, s.y + s.h * 0.45);
      ctx.lineTo(px + 7, s.y + 1);
      ctx.lineTo(px + 9.5, s.y + s.h * 0.45);
      ctx.closePath(); ctx.fill();
    }
  }
}
function drawCheckpoints() {
  LEVEL.checkpoints.forEach((cp, i) => {
    if (i === 0) return;
    const active = i <= game.checkpoint;
    ctx.fillStyle = '#7c5a3a'; ctx.fillRect(cp.x - 3, cp.y - 78, 6, 78);
    ctx.fillStyle = active ? '#ff5f6d' : '#aab3c5';
    ctx.beginPath();
    ctx.moveTo(cp.x + 3, cp.y - 76);
    ctx.lineTo(cp.x + 40, cp.y - 64);
    ctx.lineTo(cp.x + 3, cp.y - 52);
    ctx.closePath(); ctx.fill();
    if (active) {
      ctx.fillStyle = 'rgba(255,210,77,0.35)';
      ctx.beginPath(); ctx.arc(cp.x, cp.y - 76, 10 + Math.sin(game.time * 5) * 3, 0, 7); ctx.fill();
    }
  });
}
function drawPortal() {
  const p = LEVEL.portal, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  for (let i = 3; i >= 0; i--) {
    ctx.strokeStyle = i % 2 ? '#7de3ff' : '#c07dff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 16 + i * 9, 34 + i * 10, Math.sin(game.time * 1.6 + i) * 0.25, 0, 7);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff7cf';
  const spin = game.time * 2;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = spin + i * (Math.PI * 2 / 5);
    ctx.lineTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
    ctx.lineTo(cx + Math.cos(a + 0.628) * 5, cy + Math.sin(a + 0.628) * 5);
  }
  ctx.closePath(); ctx.fill();
}
function drawCrystals() {
  for (const c of LEVEL.crystals) {
    if (c.got) continue;
    if (c.x < camX - 30 || c.x > camX + VIEW_W + 30) continue;
    const bob = Math.sin(game.time * 3 + c.x * 0.05) * 4;
    const y = c.y + bob;
    ctx.fillStyle = 'rgba(255,220,90,0.25)';
    ctx.beginPath(); ctx.arc(c.x, y, 14, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath();
    ctx.moveTo(c.x, y - 11); ctx.lineTo(c.x + 8, y);
    ctx.lineTo(c.x, y + 11); ctx.lineTo(c.x - 8, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.moveTo(c.x, y - 7); ctx.lineTo(c.x + 4, y);
    ctx.lineTo(c.x, y + 7); ctx.lineTo(c.x - 4, y);
    ctx.closePath(); ctx.fill();
  }
}
function drawCaches() {
  // a hidden stash of crystals, tucked away off the main route
  for (const ca of LEVEL.caches) {
    if (ca.taken) continue;
    if (ca.x < camX - 60 || ca.x > camX + VIEW_W + 60) continue;
    const bob = Math.sin(game.time * 2.4 + ca.x * 0.03) * 5;
    const y = ca.y + bob;
    ctx.save();
    ctx.fillStyle = 'rgba(255,220,90,0.28)';
    ctx.beginPath(); ctx.arc(ca.x, y, 24 + Math.sin(game.time * 4) * 4, 0, 7); ctx.fill();
    // a little pile of crystals
    const P = [[-13, 4, 0.9], [13, 4, 0.9], [0, -6, 1.25]];
    for (const [ox, oy, sc] of P) {
      const cx2 = ca.x + ox, cy2 = y + oy;
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath();
      ctx.moveTo(cx2, cy2 - 11 * sc); ctx.lineTo(cx2 + 8 * sc, cy2);
      ctx.lineTo(cx2, cy2 + 11 * sc); ctx.lineTo(cx2 - 8 * sc, cy2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.moveTo(cx2, cy2 - 7 * sc); ctx.lineTo(cx2 + 4 * sc, cy2);
      ctx.lineTo(cx2, cy2 + 7 * sc); ctx.lineTo(cx2 - 4 * sc, cy2);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}
function drawSigns() {
  ctx.textAlign = 'center';
  ctx.font = '700 15px "Segoe UI", sans-serif';
  for (const s of LEVEL.signs) {
    if (s.x < camX - 220 || s.x > camX + VIEW_W + 220) continue;
    const w = ctx.measureText(s.text).width + 26;
    ctx.fillStyle = 'rgba(124,90,58,0.92)';
    roundRect(s.x - w / 2, s.y - 16, w, 30, 8); ctx.fill();
    ctx.fillStyle = '#7c5a3a'; ctx.fillRect(s.x - 4, s.y + 12, 8, 30);
    ctx.fillStyle = '#ffefd0';
    ctx.fillText(s.text, s.x, s.y + 5);
  }
}
function drawShards() {
  // floating corrupted fragments: the "glitch" visibly infecting the canyon
  for (const sh of LEVEL.shards) {
    if (sh.x < camX - 40 || sh.x > camX + VIEW_W + 40) continue;
    const vis = Math.sin(game.time * 6 + sh.seed * 20);
    if (vis < -0.55) continue;              // gentle flicker (never rapid strobe)
    const y = sh.y + Math.sin(game.time * 1.8 + sh.seed * 9) * 6;
    const a = game.time * 1.2 + sh.seed;
    ctx.save();
    ctx.translate(sh.x, y);
    ctx.rotate(a % (Math.PI * 2));
    ctx.globalAlpha = 0.5 + vis * 0.2;
    ctx.fillStyle = (Math.floor(sh.seed * 10) % 2) ? '#c07dff' : '#7de3ff';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawPlayer() {
  if (game.state === 'dying') return;
  const px = player.x + player.w / 2, py = player.y + player.h;
  ctx.save();
  if (game.invuln > 0 && Math.sin(game.time * 22) > 0) ctx.globalAlpha = 0.35;
  ctx.translate(px, py);
  if (player.vine) {                    // hanging: lean into the swing
    ctx.translate(0, -player.h);
    ctx.rotate(player.vine.theta * 0.6);
    ctx.translate(0, player.h);
  }
  if (player.sliding) {                 // sitting down, leaning back into it
    ctx.rotate(player.grounded ? -0.34 : -0.18);
    ctx.translate(4, 6);
  }
  // squash & stretch: positive = landed squash, negative = jump stretch
  let sy = 1 - player.squash, sx = 1 + player.squash * 0.8;
  if (!player.grounded) {
    const st = clamp(Math.abs(player.vy) / 900, 0, 1) * 0.12;
    sy += st; sx -= st * 0.6;
  }
  // shrunken Dex is visibly smaller — the one-hit warning is impossible to miss
  const size = player.big === false ? TUNING.player.smallScale : 1;
  ctx.scale(player.face * sx * size, sy * size);
  // sliding is grounded and fast, but it is the opposite of running
  const run = !player.sliding && Math.abs(player.vx) > 20 && player.grounded;
  const ph = Math.sin(player.anim * 10);
  // tail
  ctx.strokeStyle = '#d67f22'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, -12);
  ctx.quadraticCurveTo(-26, -18 + Math.sin(player.anim * 6) * 5, -24, -32 + Math.sin(player.anim * 6) * 4);
  ctx.stroke();
  // legs
  ctx.fillStyle = '#e8912f';
  if (run) {
    ctx.beginPath(); ctx.ellipse(-6 + ph * 4, -4, 5, 4, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7 - ph * 4, -4, 5, 4, 0, 0, 7); ctx.fill();
  } else if (player.sliding) {
    // On his backside: both legs straight out in front, roughly square to the
    // body, feet cocked up. Drawn before the body so the hips tuck under it.
    ctx.beginPath(); ctx.ellipse(12, -10, 14, 4.6, -0.10, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(13, -3.5, 14, 4.6, -0.02, 0, 7); ctx.fill();
    ctx.fillStyle = '#d67f22';                       // paws, turned up
    ctx.beginPath(); ctx.ellipse(26, -12.5, 5.2, 3.6, -0.55, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(27, -5, 5.2, 3.6, -0.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8912f';
  } else if (!player.grounded) {
    ctx.beginPath(); ctx.ellipse(-7, -6, 5, 4, -0.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, -3, 5, 4, 0.4, 0, 7); ctx.fill();
  } else {
    ctx.beginPath(); ctx.ellipse(-6, -4, 5, 4, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -4, 5, 4, 0, 0, 7); ctx.fill();
  }
  if (player.sliding) {                              // trailing arm, propping him up
    ctx.strokeStyle = '#e8912f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, -20); ctx.lineTo(-17, -6); ctx.stroke();
  }
  // body
  ctx.fillStyle = '#f5a144';
  ctx.beginPath(); ctx.ellipse(0, -17, 13, 13, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe9c9';
  ctx.beginPath(); ctx.ellipse(2, -14, 7, 8, 0, 0, 7); ctx.fill();
  // stripes
  ctx.strokeStyle = '#d67f22'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-10, -22); ctx.lineTo(-4, -24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-11, -16); ctx.lineTo(-5, -18); ctx.stroke();
  // scarf
  ctx.fillStyle = '#e2571f';
  ctx.beginPath(); ctx.ellipse(2, -27, 9, 4, 0, 0, 7); ctx.fill();
  // head
  const hy = -34 + (run ? ph * 1.2 : Math.sin(player.anim * 3));
  ctx.fillStyle = '#f5a144';
  ctx.beginPath(); ctx.ellipse(3, hy, 11, 10, 0, 0, 7); ctx.fill();
  // ears
  ctx.beginPath();
  ctx.moveTo(-6, hy - 5); ctx.lineTo(-4, hy - 16); ctx.lineTo(1, hy - 8); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, hy - 7); ctx.lineTo(10, hy - 16); ctx.lineTo(12, hy - 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2b7c6';
  ctx.beginPath();
  ctx.moveTo(-4.6, hy - 7); ctx.lineTo(-4, hy - 13); ctx.lineTo(-1, hy - 8); ctx.closePath(); ctx.fill();
  // muzzle + face
  ctx.fillStyle = '#ffe9c9';
  ctx.beginPath(); ctx.ellipse(8, hy + 3, 5.5, 4.5, 0, 0, 7); ctx.fill();
  if (player.blinkT > 0) {
    ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(4, hy - 2); ctx.lineTo(8, hy - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, hy - 2); ctx.lineTo(14, hy - 2); ctx.stroke();
  } else {
    ctx.fillStyle = '#2a3550';
    ctx.beginPath(); ctx.arc(6, hy - 2, 2.1, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(12, hy - 2, 2.1, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#e2846f';
  ctx.beginPath(); ctx.arc(9.5, hy + 2.4, 1.6, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(42,53,80,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(11, hy + 3); ctx.lineTo(17, hy + 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(11, hy + 4.5); ctx.lineTo(17, hy + 5.5); ctx.stroke();
  ctx.restore();
  // Bubble Shield aura
  if (power.id === 'shield' && power.charges > 0 && game.state === 'playing') {
    ctx.strokeStyle = 'rgba(159,220,255,0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(px, py - 22, 30 + Math.sin(game.time * 4) * 2, 0, 7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(159,220,255,0.10)';
    ctx.fill();
  }
}
function drawEnemies() {
  for (const e of LEVEL.enemies) {
    if (!e.alive) continue;
    const r = enemyRect(e);
    if (r.x + r.w < camX - 140 || r.x > camX + VIEW_W + 140) continue;
    ctx.save();
    if (e.cured && e.cureTimer < 0.6) ctx.globalAlpha = Math.max(0, e.cureTimer / 0.6);
    if (e.type === 'rat') drawRat(e, r);
    else if (e.type === 'monkey') drawMonkey(e, r);
    else if (e.type === 'slug') drawSlug(e, r);
    else drawMozzie(e);
    ctx.restore();
    if (e.type === 'rat' && !e.cured && e.variant === 'ember' && e.breathing) drawFlame(e);
  }
}
function drawMonkey(e, r) {
  const cured = e.cured;
  const fur    = cured ? '#8a6242' : '#4b3a63';
  const furLit = cured ? '#a67a52' : '#6b5486';
  const face   = cured ? '#e0b287' : '#8f7ab0';
  // the vine it hangs from, running up to its anchor in the canopy
  if (!cured && e.ax !== undefined) {
    const topX = r.x + r.w / 2, topY = r.y + 4;
    ctx.strokeStyle = 'rgba(48,104,58,0.9)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.ax, e.ay);
    ctx.quadraticCurveTo((e.ax + topX) / 2 + Math.sin(e.angle || 0) * 12,
                         (e.ay + topY) / 2, topX, topY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(70,140,74,0.9)';    // a few leaves on the vine
    for (let L = 1; L <= 2; L++) {
      const t = L / 3;
      const lx = e.ax + (topX - e.ax) * t, ly = e.ay + (topY - e.ay) * t;
      ctx.beginPath(); ctx.ellipse(lx + 7, ly, 8, 4, 0.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(lx - 7, ly + 10, 8, 4, -0.5, 0, 7); ctx.fill();
    }
  }
  ctx.translate(r.x + r.w / 2, r.y + r.h);
  const shiver = (!e.cured && e.aiming) ? Math.sin(game.time * 46) * 1.4 : 0;
  ctx.translate(shiver, 0);
  ctx.scale(e.dir, 1);
  const sway = Math.sin(game.time * 6 + (e.ax || 0)) * 3;
  // curly tail
  ctx.strokeStyle = fur; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, -14);
  ctx.quadraticCurveTo(-26, -20 + sway, -20, -30 + sway);
  ctx.quadraticCurveTo(-15, -36 + sway, -22, -37 + sway);
  ctx.stroke();
  // legs + arms
  ctx.fillStyle = fur;
  ctx.beginPath(); ctx.ellipse(-7, -3, 5, 4, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7, -3, 5, 4, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = fur; ctx.lineWidth = 6;
  if (!cured && e.aiming) {                    // one arm cocked back to throw
    ctx.beginPath(); ctx.moveTo(4, -22); ctx.lineTo(-6, -36); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(4, -22); ctx.lineTo(13, -10 + sway); ctx.stroke();
  }
  // the other arm reaches up, gripping the vine it's hanging from
  if (!cured && e.ax !== undefined) {
    ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(-2, -46); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(-12, -10 - sway); ctx.stroke();
  }
  // body + head
  ctx.fillStyle = fur;
  ctx.beginPath(); ctx.ellipse(0, -16, 11, 12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = furLit;
  ctx.beginPath(); ctx.ellipse(1, -14, 6.5, 8, 0, 0, 7); ctx.fill();
  const hy = -32;
  ctx.fillStyle = fur;
  ctx.beginPath(); ctx.arc(2, hy, 10, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(-7, hy - 1, 4.5, 0, 7); ctx.fill();   // ears
  ctx.beginPath(); ctx.arc(11, hy - 1, 4.5, 0, 7); ctx.fill();
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.arc(-7, hy - 1, 2.4, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(11, hy - 1, 2.4, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(3, hy + 3, 7, 6, 0, 0, 7); ctx.fill();  // muzzle
  if (cured) {                                  // happy closed eyes + smile
    ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(-3, hy - 3); ctx.lineTo(-1, hy - 5); ctx.lineTo(1, hy - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, hy - 3); ctx.lineTo(7, hy - 5); ctx.lineTo(9, hy - 3); ctx.stroke();
    ctx.beginPath(); ctx.arc(3, hy + 3, 3.4, 0.25, Math.PI - 0.25); ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(174,243,255,0.4)';    // glowing glitch eyes
    ctx.beginPath(); ctx.arc(-1, hy - 3, 3.6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(7, hy - 3, 3.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#aef3ff';
    ctx.beginPath(); ctx.arc(-1, hy - 3, 1.9, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(7, hy - 3, 1.9, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 1.6;   // grumpy mouth
    ctx.beginPath(); ctx.arc(3, hy + 6, 3.2, Math.PI + 0.3, -0.3); ctx.stroke();
    // winding up: a banana held back in the raised paw, wobbling
    if (e.aiming) {
      const wob = Math.sin(game.time * 24) * 2;
      ctx.save();
      ctx.translate(-8, -40 + wob);
      ctx.rotate(-0.6);
      ctx.fillStyle = '#ffd93d';
      ctx.beginPath();
      ctx.moveTo(-9, -3);
      ctx.quadraticCurveTo(0, 9, 9, -3);
      ctx.quadraticCurveTo(0, 3, -9, -3);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(-11, -5, 3.5, 3.5);
      ctx.restore();
    } else if (Math.sin(game.time * 7 + (e.ax || 0)) > 0.45) {   // idle sparks
      ctx.strokeStyle = 'rgba(174,243,255,0.75)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-12, hy - 12); ctx.lineTo(-9, hy - 17); ctx.lineTo(-6, hy - 13);
      ctx.stroke();
    }
  }
  if (!cured && e.warn > 0) {                   // "!" turn telegraph
    ctx.scale(e.dir, 1);
    ctx.fillStyle = '#ffd24d';
    ctx.font = '900 16px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -48);
  }
}
function drawFlame(e) {
  // cartoon glitch-fire: layered green→orange→yellow tongues, gently flickering
  const fr = flameRect(e);
  const mouthX = e.dir > 0 ? fr.x : fr.x + fr.w;
  const midY = fr.y + fr.h / 2;
  const flick = 0.75 + Math.abs(Math.sin(game.time * 14 + e.x1)) * 0.25;
  const layers = [
    { len: fr.w * flick,        half: 13, col: 'rgba(141,255,110,0.7)' },
    { len: fr.w * flick * 0.72, half: 9,  col: 'rgba(255,155,61,0.85)' },
    { len: fr.w * flick * 0.45, half: 5,  col: 'rgba(255,243,160,0.95)' },
  ];
  for (const L of layers) {
    const tip = mouthX + e.dir * L.len;
    ctx.fillStyle = L.col;
    ctx.beginPath();
    ctx.moveTo(mouthX, midY - L.half);
    ctx.quadraticCurveTo(mouthX + e.dir * L.len * 0.6, midY - L.half * 1.4, tip, midY + Math.sin(game.time * 20) * 3);
    ctx.quadraticCurveTo(mouthX + e.dir * L.len * 0.6, midY + L.half * 1.4, mouthX, midY + L.half);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,243,160,0.9)';
  for (let i = 0; i < 3; i++) {
    const p = (game.time * 2.2 + i / 3) % 1;
    ctx.beginPath();
    ctx.arc(mouthX + e.dir * fr.w * p, midY - 14 - p * 10, 2.2 * (1 - p), 0, 7);
    ctx.fill();
  }
}
function drawRat(e, r) {
  ctx.translate(r.x + r.w / 2, r.y + r.h);
  if (e.w !== 36) { const k = e.w / 36; ctx.scale(k, k); }   // big rats draw big
  const shiver = (!e.cured && e.warn > 0) ? Math.sin(game.time * 50) * 1.6 : 0;
  ctx.translate(shiver, 0);
  ctx.scale(e.dir, 1);
  const wob = Math.sin(game.time * 12 + e.x1) * 1.5;
  const roll = e.cured ? 0 : Math.sin(game.time * 9 + e.x1) * 0.06;
  ctx.rotate(roll);
  if (e.cured) {
    // friendly, cured rat — warm fur, happy closed eyes
    ctx.strokeStyle = '#e8a2b8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-14, -8);
    ctx.quadraticCurveTo(-24, -12 + wob, -27, -4 + wob); ctx.stroke();
    ctx.fillStyle = '#a58363';
    ctx.beginPath(); ctx.ellipse(0, -10, 15, 9, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(9, -16); ctx.lineTo(21, -8); ctx.lineTo(9, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a6a4d';
    ctx.beginPath(); ctx.arc(6, -18, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2b7c6';
    ctx.beginPath(); ctx.arc(6, -18, 2.2, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 1.8;  // happy ^ eye
    ctx.beginPath(); ctx.moveTo(10, -12); ctx.lineTo(12, -14); ctx.lineTo(14, -12); ctx.stroke();
    ctx.fillStyle = '#8a6a4d';
    ctx.beginPath(); ctx.ellipse(-6 + wob, -1.5, 4, 2.5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6 - wob, -1.5, 4, 2.5, 0, 0, 7); ctx.fill();
    return;
  }
  // corrupted Glitch Rat — indigo fur, glowing eyes, sparks
  const ember = e.variant === 'ember';
  const blaze = e.variant === 'blaze';
  const magma = e.variant === 'magma';
  const glow  = e.variant === 'glow' || e.variant === 'bloat';
  if (glow && !e.cured) {
    const lit = e.hits > 1 ? 1 : 0.45;          // dimmer once knocked down
    const pulse = 0.7 + Math.abs(Math.sin(game.time * 2.4 + e.x1)) * 0.3;
    ctx.fillStyle = `rgba(140,255,110,${(0.22 * lit * pulse).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(0, -14, 34 * pulse, 0, 7); ctx.fill();
    if (e.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(e.hitFlash * 1.6).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(0, -14, 26, 0, 7); ctx.fill();
    }
  }
  if (magma && e.aiming) {                 // mouth glows before it spits
    const g = 4 + Math.abs(Math.sin(game.time * 20)) * 5;
    ctx.fillStyle = 'rgba(255,140,50,0.4)';
    ctx.beginPath(); ctx.arc(21, -10, g + 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffb03a';
    ctx.beginPath(); ctx.arc(21, -10, g * 0.55, 0, 7); ctx.fill();
  }
  if (blaze) {
    // flames trailing off its back, always behind it so the head reads as safe
    const t = game.time * 12 + e.x1;
    for (let i = 0; i < 4; i++) {
      const fx = -6 - i * 6, fh = 12 + Math.abs(Math.sin(t + i * 1.3)) * 12;
      ctx.fillStyle = i < 2 ? 'rgba(255,214,120,0.9)' : 'rgba(255,120,40,0.75)';
      ctx.beginPath();
      ctx.moveTo(fx - 5, -18);
      ctx.quadraticCurveTo(fx - 2, -18 - fh * 0.6, fx + 1, -18 - fh);
      ctx.quadraticCurveTo(fx + 4, -18 - fh * 0.5, fx + 5, -18);
      ctx.closePath(); ctx.fill();
    }
  }
  if (ember && e.warmup) {                  // puff-up telegraph before breathing
    const puff = 1 + 0.13 * Math.abs(Math.sin(game.time * 11));
    ctx.scale(puff, puff);
    ctx.fillStyle = 'rgba(255,155,61,0.30)';
    ctx.beginPath(); ctx.arc(18, -12, 6 + Math.abs(Math.sin(game.time * 9)) * 5, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = '#c07dff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-14, -8);
  ctx.quadraticCurveTo(-24, -12 + wob, -27, -4 + wob); ctx.stroke();
  ctx.fillStyle = glow ? '#69b04d' : magma ? '#5c2418' : blaze ? '#7a3524' : ember ? '#6a3f66' : '#4a3f7a';
  ctx.beginPath(); ctx.ellipse(0, -10, 15, 9, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(9, -16); ctx.lineTo(21, -8); ctx.lineTo(9, -4); ctx.closePath(); ctx.fill();
  // glowing zigzag marking (orange on Ember Rats)
  ctx.strokeStyle = glow ? '#a4ff78' : magma ? '#ff7a2a' : blaze ? '#ffdc6e' : ember ? '#ffb84d' : '#7de3ff'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, -12); ctx.lineTo(-5, -8); ctx.lineTo(0, -13); ctx.lineTo(5, -9);
  ctx.stroke();
  if (magma) {                              // molten cracks glowing through
    ctx.strokeStyle = 'rgba(255,150,50,0.9)'; ctx.lineWidth = 1.6;
    const pulse = 0.6 + Math.abs(Math.sin(game.time * 3 + e.x1)) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.beginPath(); ctx.moveTo(-9, -6); ctx.lineTo(-4, -12); ctx.lineTo(1, -7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, -15); ctx.lineTo(7, -9); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (e.variant === 'spike') {              // corrupted crystal spikes — never bounce!
    for (let i = -1; i <= 1; i++) {
      ctx.fillStyle = '#b96ee0';
      ctx.beginPath();
      ctx.moveTo(i * 8 - 4, -16); ctx.lineTo(i * 8, -28); ctx.lineTo(i * 8 + 4, -16);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7de3ff';
      ctx.beginPath();
      ctx.moveTo(i * 8 - 1.5, -23); ctx.lineTo(i * 8, -28); ctx.lineTo(i * 8 + 1.5, -23);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.fillStyle = '#372e5e';
  ctx.beginPath(); ctx.arc(6, -18, 4.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#c07dff';
  ctx.beginPath(); ctx.arc(6, -18, 2.2, 0, 7); ctx.fill();
  // glowing eye (warm orange on Ember Rats)
  ctx.fillStyle = glow ? 'rgba(150,255,110,0.5)' : (ember || blaze || magma) ? 'rgba(255,184,77,0.45)' : 'rgba(125,227,255,0.4)';
  ctx.beginPath(); ctx.arc(12, -12, 4, 0, 7); ctx.fill();
  ctx.fillStyle = glow ? '#ddffc4' : (ember || blaze || magma) ? '#ffe2ae' : '#aef3ff';
  ctx.beginPath(); ctx.arc(12, -12, 2, 0, 7); ctx.fill();
  ctx.fillStyle = '#5a5090';
  ctx.beginPath(); ctx.ellipse(-6 + wob, -1.5, 4, 2.5, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6 - wob, -1.5, 4, 2.5, 0, 0, 7); ctx.fill();
  // electric sparks (soft flicker, not strobing)
  if (Math.sin(game.time * 7 + e.x1) > 0.3) {
    ctx.strokeStyle = 'rgba(125,227,255,0.8)'; ctx.lineWidth = 1.5;
    const sxr = Math.sin(game.time * 13 + e.x1) * 6;
    ctx.beginPath();
    ctx.moveTo(-4 + sxr, -22); ctx.lineTo(-1 + sxr, -26); ctx.lineTo(2 + sxr, -23);
    ctx.stroke();
  }
  if (e.warn > 0) {                       // "!" telegraph before turning
    ctx.scale(e.dir, 1);                  // keep the mark upright
    ctx.fillStyle = '#ffd24d';
    ctx.font = '900 16px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -30);
  }
}
function drawSlug(e, r) {
  ctx.translate(r.x + r.w / 2, r.y + r.h);
  const sq = 1 + Math.sin(game.time * 4 + e.x1) * 0.06;
  ctx.fillStyle = '#6a7350';
  ctx.beginPath(); ctx.ellipse(0, -8, 18 * sq, 9 / sq, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#b96ee0';                 // corrupted slime spikes
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 9 - 4, -13); ctx.lineTo(i * 9, -23); ctx.lineTo(i * 9 + 4, -13);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(192,125,255,0.5)';
  ctx.beginPath(); ctx.arc(e.dir * 12, -10, 3.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#efdaff';
  ctx.beginPath(); ctx.arc(e.dir * 12, -10, 1.6, 0, 7); ctx.fill();
}
function drawMozzie(e) {
  // Glitch Mosquito — the pest everyone loves to bounce on.
  // Self-contained transform: cinematic scenes call this directly, so it must
  // never leave the canvas translated for whatever is drawn next.
  ctx.save();
  ctx.translate(e.x, e.y);
  const cured = e.cured;
  const buzz = Math.sin(game.time * 40 + (e.cy || 0)) * 1.2;   // jittery hover
  ctx.translate(0, buzz);
  const bodyCol   = cured ? '#b08d63' : '#3f3568';
  const stripeCol = cured ? '#8a6a4d' : '#c07dff';
  const wingCol   = cured ? 'rgba(255,246,214,0.75)' : 'rgba(174,243,255,0.55)';
  if (!cured) {
    ctx.fillStyle = 'rgba(192,125,255,0.22)';                  // corruption halo
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, 7); ctx.fill();
  }
  // blurred wings, flapping far too fast to see properly
  const flap = 0.4 + Math.abs(Math.sin(game.time * 26 + (e.cy || 0))) * 0.6;
  ctx.fillStyle = wingCol;
  ctx.beginPath(); ctx.ellipse(-7, -9, 12, 4.5 * flap, -0.55, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7, -9, 12, 4.5 * flap, 0.55, 0, 7); ctx.fill();
  // dangly legs
  ctx.strokeStyle = bodyCol; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 3, 4);
    ctx.quadraticCurveTo(i * 9, 10, i * 12 + buzz, 15);
    ctx.stroke();
  }
  // long thin abdomen, tilted, with stripes
  ctx.save();
  ctx.rotate(0.32);
  ctx.fillStyle = bodyCol;
  ctx.beginPath(); ctx.ellipse(-4, 3, 11, 4, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = stripeCol; ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-11 + i * 5, 0.6); ctx.lineTo(-11 + i * 5, 5.6);
    ctx.stroke();
  }
  ctx.restore();
  // head + the famous needle nose
  ctx.fillStyle = bodyCol;
  ctx.beginPath(); ctx.arc(7, -2, 5.2, 0, 7); ctx.fill();
  ctx.strokeStyle = cured ? '#8a6a4d' : '#aef3ff';
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(22, 4); ctx.stroke();
  if (cured) {                                   // friendly: happy closed eye
    ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(6, -4); ctx.lineTo(8, -6); ctx.lineTo(10, -4);
    ctx.stroke();
  } else {                                       // corrupted: big glowing eye
    ctx.fillStyle = 'rgba(174,243,255,0.45)';
    ctx.beginPath(); ctx.arc(8.5, -3.5, 3.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#aef3ff';
    ctx.beginPath(); ctx.arc(8.5, -3.5, 1.9, 0, 7); ctx.fill();
    if (Math.sin(game.time * 8 + (e.cy || 0)) > 0.4) {         // spark
      ctx.strokeStyle = 'rgba(125,227,255,0.75)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-13, -12); ctx.lineTo(-10, -16); ctx.lineTo(-7, -13);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function drawRings() {
  for (const r of rings) {
    ctx.globalAlpha = clamp(r.life / r.maxLife, 0, 1);
    ctx.strokeStyle = '#c07dff';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(125,227,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.8, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    if (p.heart && p.color === '#ff8fb0') {
      ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('♥', p.x, p.y);
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function drawTimeBubbleFx() {
  if (slowT <= 0 || game.state !== 'playing') return;
  // blink gently in the final second so the end is predictable
  if (slowT < 1.2 && Math.sin(game.time * 10) > 0.3) return;
  if (!save.settings.reducedFx) {
    ctx.fillStyle = 'rgba(125,227,255,0.08)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.strokeStyle = 'rgba(125,227,255,0.7)';
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, VIEW_W - 8, VIEW_H - 8);
  ctx.fillStyle = 'rgba(10,30,60,0.55)';
  roundRect(VIEW_W / 2 - 56, 30, 112, 30, 15); ctx.fill();
  ctx.fillStyle = '#aef3ff';
  ctx.font = '900 16px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`⏳ ${Math.ceil(slowT)}s`, VIEW_W / 2, 51);
}
function drawDebugBoxes() {
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(80,140,255,0.8)';
  for (const s of activeSolids()) ctx.strokeRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = 'rgba(255,80,80,0.9)';
  for (const e of LEVEL.enemies) {
    if (!e.alive || e.cured) continue;
    const r = enemyRect(e);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (e.variant === 'ember' && e.breathing) {
      ctx.strokeStyle = 'rgba(255,155,61,0.9)';
      const fr = flameRect(e);
      ctx.strokeRect(fr.x, fr.y, fr.w, fr.h);
      ctx.strokeStyle = 'rgba(255,80,80,0.9)';
    }
  }
  for (const s of LEVEL.spikes) ctx.strokeRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = 'rgba(60,220,120,0.95)';
  ctx.strokeRect(player.x, player.y, player.w, player.h);
}

/* ------------------------------------------- 11. ZAP / MATHS / RESPAWN */
const PRAISE = ['Purr-fect! ⭐', 'Great job! 🎉', 'You got it! 🌟', 'Brilliant! 💛', 'Super maths! ✨'];
const ENCOURAGE = ['Nearly — try again! 💪', 'So close! Have another go 😺', 'Not quite — you can do it!', 'Good try! Look again 🌈'];

function die(cause) {
  dropVine(); dropChute();
  player.flight = false; player.flightT = 0;
  // internal name for analytics; the child-facing UI only ever says "zapped"
  if (game.state !== 'playing') return;
  game.state = 'dying';
  game.deathTimer = 0.7;
  game.deaths++;
  game.livesLeft = spendLife();      // one zap, one spare life
  game.sectionDeaths[sectionOf(player.x)]++;
  slowT = 0;
  burst(player.x + player.w / 2, Math.min(player.y + player.h / 2, VIEW_H - 30), '#f5a144', 22, 260);
  burst(player.x + player.w / 2, Math.min(player.y + player.h / 2, VIEW_H - 30), '#7de3ff', 8, 180);
  sfx.zap();
  input.left = input.right = input.jump = input.jumpPressed = false;

  const A = TUNING.assist;
  const lvl = game.deaths >= A.level2Deaths ? 2 : game.deaths >= A.level1Deaths ? 1 : 0;
  if (lvl !== game.assistLevel) {
    game.assistLevel = lvl;
    if (lvl === 1) toast('A friendly breeze slows the hazards a little… 🍃');
    if (lvl === 2) toast('⭐ Explorer Boost! Hazards slow down and a golden platform appears!');
  }
  const dx = player.x;
  game.deathSpots.push(dx);
  const nearby = game.deathSpots.filter(x => Math.abs(x - dx) < 250).length;
  if (nearby >= A.localDeaths && (!game.localZone || Math.abs(game.localZone.x - dx) > 120)) {
    game.localZone = { x: dx };
    toast('✨ Helper magic slows things down near this spot!');
  }
}
function updateDying(dt) {
  updateParticles(dt);
  shakeMag *= Math.exp(-6 * dt);
  game.deathTimer -= dt;
  if (game.deathTimer <= 0) {
    // no spares left: straight to the game over screen, no maths question for
    // a run that has already ended
    if (game.livesLeft === false) gameOver(); else showMath();
  }
}
function openMathOverlay() {
  currentQ = MathQuiz.next();
  attemptsThisQ = 0; answerLocked = false;
  ui.mathQuestion.textContent = currentQ.text;
  ui.mathFeedback.textContent = '';
  ui.mathReward.classList.add('hidden');
  ui.mathReward.textContent = '';
  ui.mathHint.classList.add('hidden');
  ui.mathHint.textContent = '';
  ui.answers.forEach((b, i) => {
    b.innerHTML = `${currentQ.choices[i]}<span class="keyhint">press ${i + 1}</span>`;
    b.classList.remove('correct', 'faded', 'shake');
  });
  ui.overlayMath.classList.remove('hidden');
  ui.answers[0].focus();
}
function showMath() {                    // after a zap in the level
  game.state = 'math';
  mathContext = 'zap';
  game.stats.questions++;
  ui.mathTitle.textContent = '⚡ Zapped! Let\'s power back up!';
  ui.mathSub.textContent = 'Solve this to jump back in, Dex!';
  openMathOverlay();
}
function showCageMath() {                // the lock on Nova's cage
  game.state = 'math';
  mathContext = 'cage';
  game.stats.questions++;
  ui.mathTitle.textContent = '🔒 Nova\'s cage!';
  ui.mathSub.textContent = 'Nova: "I can pick the lock — just work out the number, Dex!"';
  currentQ = MathQuiz.finale();
  attemptsThisQ = 0; answerLocked = false;
  ui.mathQuestion.textContent = currentQ.text;
  ui.mathFeedback.textContent = '';
  ui.mathReward.classList.add('hidden'); ui.mathReward.textContent = '';
  ui.mathHint.classList.add('hidden'); ui.mathHint.textContent = '';
  ui.answers.forEach((b, i) => {
    b.innerHTML = `${currentQ.choices[i]}<span class="keyhint">press ${i + 1}</span>`;
    b.classList.remove('correct', 'faded', 'shake');
  });
  ui.overlayMath.classList.remove('hidden');
  ui.answers[0].focus();
}
function freeNova() {
  if (game.state !== 'math' || mathContext !== 'cage') return;
  ui.overlayMath.classList.add('hidden');
  currentQ = null; mathContext = 'zap';
  if (LEVEL.cage) LEVEL.cage.open = true;
  game.state = 'playing';
  toast('🔓 Nova is free!');
  sfx.unlock();
  setTimeout(() => { if (game.state === 'playing') win(); }, 1600);
}
function showBuildMath(id) {             // building a power-up in the workshop
  game.state = 'math';
  mathContext = 'build';
  buildTarget = id;
  ui.mathTitle.textContent = '🔧 Workshop Challenge!';
  ui.mathSub.textContent = `Solve this to build the ${POWERUPS[id].name}!`;
  openMathOverlay();
}
function pressAnswer(i) {
  if (game.state !== 'math' || answerLocked || !currentQ) return;
  const btn = ui.answers[i];
  const choice = currentQ.choices[i];
  if (choice === currentQ.answer) {
    answerLocked = true;
    btn.classList.add('correct');
    ui.mathFeedback.textContent = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    if (mathContext === 'cage') {
      ui.mathReward.textContent = '🔓 Click! The cage swings open — Nova is free!';
      ui.mathReward.classList.remove('hidden');
      sfx.correct(); sfx.unlock();
      setTimeout(freeNova, 1600);
      return;
    }
    if (mathContext === 'build') {
      const def = POWERUPS[buildTarget];
      ui.mathReward.textContent = `🔧 ${def.icon} ${def.name} built! It's up on your wall!`;
      ui.mathReward.classList.remove('hidden');
      sfx.correct();
      sfx.unlock();
      setTimeout(finishBuild, 1400);
      return;
    }
    if (attemptsThisQ === 0) game.stats.firstTry++;
    // power restored: recharge the equipped power-up (or give a bonus instead)
    const def = power.id ? POWERUPS[power.id] : null;
    let reward;
    if (def && power.charges < def.max) {
      power.charges++;
      reward = def.rechargeMsg;
    } else if (def) {
      awardCrystals(TUNING.powerups.fullChargeBonusCrystals);
      reward = `⭐ Power already full — ${TUNING.powerups.fullChargeBonusCrystals} bonus crystals!`;
    } else {
      awardCrystals(TUNING.powerups.fullChargeBonusCrystals);
      reward = `⭐ Brilliant thinking — ${TUNING.powerups.fullChargeBonusCrystals} bonus crystals!`;
    }
    ui.mathReward.textContent = '⚡ Power restored! ' + reward;
    ui.mathReward.classList.remove('hidden');
    sfx.correct();
    setTimeout(respawn, 1400);
  } else {
    attemptsThisQ++;
    if (mathContext === 'zap') game.stats.wrongAttempts++;
    btn.classList.add('faded');
    btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
    ui.mathFeedback.textContent = ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)];
    if (attemptsThisQ >= (mathContext === 'cage' ? 1 : 2)) {
      ui.mathHint.textContent = (mathContext === 'cage' ? '💡 Nova: ' : '💡 Hint: ') + currentQ.hint;
      ui.mathHint.classList.remove('hidden');
    }
    sfx.wrong();
  }
}
function respawn() {
  if (game.state !== 'math' || mathContext !== 'zap') return;
  ui.overlayMath.classList.add('hidden');
  currentQ = null;
  bolts = [];
  if (save.lives <= 0) { gameOver(); return; }          // belt and braces
  if (LIVES.restartLevelOnDeath) {                      // a life costs the whole level
    beginAdventure(levelIndex);
    toast(`🐱 × ${save.lives} — starting ${LEVELS[levelIndex].name} again!`);
    return;
  }
  resetEntities();
  placeAtCheckpoint();
  game.invuln = protectionTime();
  fadeAlpha = 0.6;
  game.state = 'playing';
  updateHud();
}
function finishBuild() {
  if (game.state !== 'math' || mathContext !== 'build' || !buildTarget) return;
  save.built[buildTarget] = true;
  const wasFirst = !save.equipped;
  if (wasFirst) save.equipped = buildTarget;      // auto-equip your first power-up
  persist();
  ui.overlayMath.classList.add('hidden');
  currentQ = null;
  const st = TREEHOUSE.stations.find(s => s.id === buildTarget);
  if (st) { burst(st.x, 240, '#ffd24d', 22, 200); burst(st.x, 240, '#7de3ff', 10, 150); }
  addShake(2);
  const def = POWERUPS[buildTarget];
  toast(`${def.icon} ${def.name} ready!` +
        (wasFirst ? ' (equipped)' : ` ${ActHint('✋')} at its bench to equip.`));
  mathContext = 'zap'; buildTarget = null;
  game.state = 'treehouse';
  updateHud();
}

/* ------------------------------------------------------ LEVEL PICKER ---- */
function fmtTime(s) {
  if (s == null) return null;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
// progress-bar ticks come from the current level's checkpoints, so they always
// match whichever adventure is loaded
function rebuildProgressTicks() {
  ui.progress.querySelectorAll('.tick').forEach(t => t.remove());
  LEVEL.checkpoints.forEach((cp, i) => {
    if (i === 0) return;
    const d = document.createElement('div');
    d.className = 'tick';
    d.style.left = clamp(cp.x / LEVEL.portal.x, 0, 1) * 100 + '%';
    ui.progress.insertBefore(d, ui.progressCat);
  });
}
function openLevelPicker() {
  ui.levelList.innerHTML = '';
  const nextUp = LEVELS.findIndex((L, i) => levelUnlocked(i) && !save.levelDone[i]);
  LEVELS.forEach((L, i) => {
    const unlocked = levelUnlocked(i);
    const done = !!save.levelDone[i];
    const card = document.createElement('button');
    card.type = 'button';                      // never a form submit
    card.className = 'lvlCard' + (unlocked ? '' : ' lvlLocked') + (i === nextUp ? ' lvlNext' : '');
    card.disabled = !unlocked;                 // locked rows: not clickable, not focusable
    card.setAttribute('aria-label', `${L.name}${unlocked ? '' : ' (locked)'}`);
    let sub;
    if (!L.build) sub = 'Being built — coming soon!';
    else if (!unlocked) sub = `Finish ${LEVELS[i - 1].name} to open this up`;
    else if (done) sub = `${L.blurb} · best ${fmtTime(save.levelBest[i]) || '—'}`;
    else sub = L.blurb;
    const reward = POWERUP_ORDER[i];
    const prize = (!done && unlocked && reward && !save.blueprints[reward])
      ? ` · win ${POWERUPS[reward].icon}` : '';
    card.innerHTML =
      `<span class="lvlIcon">${unlocked ? L.icon : '🔒'}</span>` +
      `<span class="lvlText"><span class="lvlName">${i + 1}. ${L.name}</span>` +
      `<span class="lvlSub">${sub}${prize}</span></span>` +
      `<span class="lvlBadge">${done ? '✓' : unlocked ? '▶' : ''}</span>`;
    if (unlocked) {
      let armed = false;
      const start = () => {
        if (ui.overlayLevels.classList.contains('hidden')) return;   // already going
        sfx.click();
        ui.overlayLevels.classList.add('hidden');
        beginAdventure(i);
      };
      // click covers mouse, keyboard (Enter/Space on a <button>) and most taps
      card.addEventListener('click', start);
      // …and a belt-and-braces pointer path, in case a press and release land
      // on different elements and the browser declines to synthesise a click
      card.addEventListener('pointerdown', () => { armed = true; });
      card.addEventListener('pointerup', () => { if (armed) { armed = false; start(); } });
      card.addEventListener('pointercancel', () => { armed = false; });
    }
    ui.levelList.appendChild(card);
  });
  ui.overlayLevels.classList.remove('hidden');
}

/* ------------------------------------- 12. TREEHOUSE HUB (walkable room) */
function enterTreehouse() {
  game.state = 'treehouse';
  mathContext = 'zap'; buildTarget = null;
  ['overlayTitle', 'overlayMath', 'overlayPause', 'overlayVictory', 'overlayGameOver', 'overlayLevels']
    .forEach(k => ui[k].classList.add('hidden'));
  ui.progress.classList.add('hidden');
  ui.overlaySettings.classList.add('hidden');
  ui.resetConfirm.classList.add('hidden');
  ui.resetBtn.classList.remove('hidden');
  // Dex walks in through the door on the right (or starts left on his first
  // visit). Line him up on the DOOR STATION, not the door graphic — otherwise
  // he lands nearer the last workbench and pressing E opens that instead.
  setPlayerBig(true);                 // always his full self back home
  const doorSt = TREEHOUSE.stations.find(s => s.type === 'door');
  player.x = save.completions > 0 ? doorSt.x - player.w / 2 : 56;
  player.y = TREEHOUSE.floor - player.h - 2;
  clearMovementState();               // he is not still on the sewer's slide
  player.grounded = true;
  player.support = null; player.face = save.completions > 0 ? -1 : 1;
  input.left = input.right = input.jump = input.jumpPressed = false;
  particles = []; rings = []; bolts = []; slowT = 0; shakeMag = 0; game.invuln = 0;
  fadeAlpha = 0.6;
  // rescued rats wander the floor (up to six visible)
  thRatsDeco = [];
  const n = Math.min(save.ratsRescued, 6);
  for (let i = 0; i < n; i++) {
    thRatsDeco.push({ x: 90 + i * 96 + Math.random() * 40, dir: Math.random() < 0.5 ? -1 : 1,
                      seed: Math.random() * 10 });
  }
  ambient = { motes: [], sparks: [], steam: [] };
  updateHud();
}
const onTouch = () => document.body.classList.contains('touch');
// "press E" / "tap the 🔧 button", for use mid-sentence
const actHint = (icon = '🔧') => onTouch() ? `tap the ${icon} button` : 'press E';
const ActHint = (icon = '🔧') => onTouch() ? `Tap the ${icon} button` : 'Press E';
// the short label on the floating tooltip above a station
const actKey = (icon = '🔧') => onTouch() ? icon : 'E';
function stationNear() {
  const pc = player.x + player.w / 2;
  let best = null, bd = 56;
  for (const st of TREEHOUSE.stations) {
    const d = Math.abs(pc - st.x);
    if (d < bd) { bd = d; best = st; }
  }
  return best;
}
function treehouseInteract() {
  if (game.state !== 'treehouse') return;
  const st = stationNear();
  if (!st) { toast('Walk up to a wall frame or the door!'); return; }
  if (st.type === 'door') { sfx.click(); openLevelPicker(); return; }
  const id = st.id, def = POWERUPS[id];
  if (save.built[id]) {
    if (save.equipped === id) {
      save.equipped = null;
      toast(`${def.icon} ${def.name} unequipped.`);
    } else {
      save.equipped = id;
      toast(`${def.icon} ${def.name} equipped!`);
    }
    sfx.click();
    persist();
  } else if (save.blueprints[id]) {
    sfx.click();
    showBuildMath(id);
  } else {
    toast('🔒 ' + def.lockedHint);
  }
  updateHud();
}
function updateTreehouse(dt) {
  roomT += dt;
  updatePlayerPhysics(dt, TREEHOUSE.solids, TREEHOUSE.width);
  for (const r of thRatsDeco) {
    if (Math.sin(roomT * 0.7 + r.seed) > -0.2) {       // wander, with little rests
      r.x += r.dir * (22 + (r.seed % 1) * 14) * dt;
      if (r.x < 50) { r.x = 50; r.dir = 1; }
      if (r.x > 650) { r.x = 650; r.dir = -1; }
    }
  }
  updateAmbient(dt);
  updateParticles(dt);
  shakeMag *= Math.exp(-6 * dt);
  updateHud();
}
// Five small ambient touches, all slow and low-contrast so they never compete
// with the interactive furniture for the child's attention.
function updateAmbient(dt) {
  const A = ambient, W = TREEHOUSE.window, D = TREEHOUSE.desk, gentle = save.settings.reducedFx;
  // 1. dust motes drifting in the shaft of window light
  if (!gentle && A.motes.length < 14 && Math.random() < dt * 6) {
    A.motes.push({ x: W.x + Math.random() * (W.w + 60), y: W.y + Math.random() * 60,
                   vy: 6 + Math.random() * 9, vx: 3 + Math.random() * 5,
                   r: 0.8 + Math.random() * 1.1, life: 5 + Math.random() * 4 });
  }
  for (const m of A.motes) { m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt; }
  A.motes = A.motes.filter(m => m.life > 0 && m.y < ROOM_FLOOR);
  // 2. steam curling from the mug on Nova's desk
  if (A.steam.length < 8 && Math.random() < dt * 3) {
    A.steam.push({ x: D.x + 116, y: D.y - 10, t: 0, life: 2.4, sway: Math.random() * 6 });
  }
  for (const s of A.steam) { s.t += dt; s.life -= dt; s.y -= 9 * dt; }
  A.steam = A.steam.filter(s => s.life > 0);
  // 3. Nova's half-built gadget still sparking away on the desk
  if (!gentle && Math.random() < dt * 0.9) {
    A.sparks.push({ x: D.x + 46 + Math.random() * 10, y: D.y - 14,
                    vx: (Math.random() - 0.5) * 26, vy: -18 - Math.random() * 16, life: 0.5 });
  }
  for (const s of A.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 60 * dt; s.life -= dt; }
  A.sparks = A.sparks.filter(s => s.life > 0);
  // (4) the hanging lamp sways and (5) the leaves outside the window drift —
  // both are pure functions of roomT, drawn directly in renderTreehouseRoom.
}
function drawFriendlyRatAt(x, yFeet, dir, t) {
  ctx.save();
  ctx.translate(x, yFeet);
  ctx.scale(dir, 1);
  const wob = Math.sin(t * 10) * 1.5;
  ctx.strokeStyle = '#e8a2b8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-14, -8);
  ctx.quadraticCurveTo(-24, -12 + wob, -27, -4 + wob); ctx.stroke();
  ctx.fillStyle = '#a58363';
  ctx.beginPath(); ctx.ellipse(0, -10, 15, 9, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(9, -16); ctx.lineTo(21, -8); ctx.lineTo(9, -4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8a6a4d';
  ctx.beginPath(); ctx.arc(6, -18, 4.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#f2b7c6';
  ctx.beginPath(); ctx.arc(6, -18, 2.2, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(10, -12); ctx.lineTo(12, -14); ctx.lineTo(14, -12); ctx.stroke();
  ctx.fillStyle = '#8a6a4d';
  ctx.beginPath(); ctx.ellipse(-6 + wob, -1.5, 4, 2.5, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6 - wob, -1.5, 4, 2.5, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function treehouseHint() {
  const anyUnlocked = POWERUP_ORDER.some(id => save.blueprints[id]);
  const unbuilt = POWERUP_ORDER.find(id => save.blueprints[id] && !save.built[id]);
  if (!anyUnlocked) return 'Head out of the door — reach the Star Portal to win your first power-up!';
  if (unbuilt) return `Your ${POWERUPS[unbuilt].name} is waiting — ${actHint('🔧')} at its bench to build it!`;
  if (!save.equipped) return `${ActHint('✋')} at a workbench to equip a power-up!`;
  return `Walk to the doorway and ${actHint('🚪')} to start an adventure!`;
}
// soft contact shadow, so furniture and characters sit ON the floor
function contactShadow(cx, cy, rx, alpha = 0.26) {
  ctx.fillStyle = `rgba(38,22,10,${alpha})`;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.26, 0, 0, 7); ctx.fill();
}
function renderTreehouseRoom() {
  const S = TREEHOUSE.scale;
  const W = TREEHOUSE.window, D = TREEHOUSE.desk, B = TREEHOUSE.board;
  const BEN = TREEHOUSE.bench, DOOR = TREEHOUSE.door;
  const F = TREEHOUSE.floor;
  const builtCount = POWERUP_ORDER.filter(id => save.built[id]).length;
  const lampSway = Math.sin(roomT * 0.8) * 0.06;

  ctx.save();
  ctx.scale(S, S);

  /* ---------- walls, planks, ceiling ---------- */
  const wall = ctx.createLinearGradient(0, 0, 0, F);
  wall.addColorStop(0, '#a97a50'); wall.addColorStop(1, '#7a5433');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, ROOM_W, F);
  for (let i = 0; i < 12; i++) {                 // per-plank colour variation
    const px = i * 66, shade = hash(i * 3.1);
    ctx.fillStyle = `rgba(${shade > 0.5 ? '255,235,205' : '60,38,20'},${(0.04 + shade * 0.05).toFixed(3)})`;
    ctx.fillRect(px, 20, 66, F - 20);
    ctx.strokeStyle = 'rgba(58,36,18,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, 20); ctx.lineTo(px, F); ctx.stroke();
    if (shade > 0.72) {                          // occasional knot in the wood
      ctx.fillStyle = 'rgba(74,46,22,0.5)';
      ctx.beginPath(); ctx.ellipse(px + 33, 90 + shade * 200, 5, 3.4, 0, 0, 7); ctx.fill();
    }
  }
  ctx.fillStyle = '#5a3e22'; ctx.fillRect(0, 0, ROOM_W, 22);       // ceiling beam
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 22, ROOM_W, 8);

  /* ---------- floor ---------- */
  ctx.fillStyle = '#7d5734'; ctx.fillRect(0, F, ROOM_W, ROOM_H - F);
  for (let i = 0; i < 9; i++) {
    const px = i * 92, shade = hash(i * 5.7);
    ctx.fillStyle = `rgba(${shade > 0.5 ? '255,230,196' : '46,28,12'},${(0.05 + shade * 0.05).toFixed(3)})`;
    ctx.fillRect(px, F, 92, ROOM_H - F);
    ctx.strokeStyle = 'rgba(40,24,10,0.45)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(px, F); ctx.lineTo(px - 24, ROOM_H); ctx.stroke();
  }
  ctx.fillStyle = '#4a3220'; ctx.fillRect(0, F - 3, ROOM_W, 5);    // skirting

  /* ---------- rug, once the crystal jar is filling up ---------- */
  if (save.crystalsBank >= 50) {
    ctx.fillStyle = '#8c4b53';
    ctx.beginPath(); ctx.ellipse(300, F + 22, 130, 20, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#a9646b';
    ctx.beginPath(); ctx.ellipse(300, F + 22, 100, 14, 0, 0, 7); ctx.fill();
  }

  /* ---------- window + the light it throws across the room ---------- */
  ctx.fillStyle = '#6e4c2c';
  roundRect(W.x - 8, W.y - 8, W.w + 16, W.h + 16, 10); ctx.fill();
  const skyG = ctx.createLinearGradient(0, W.y, 0, W.y + W.h);
  skyG.addColorStop(0, '#8fd3ff'); skyG.addColorStop(1, '#e8f9ff');
  ctx.fillStyle = skyG; roundRect(W.x, W.y, W.w, W.h, 6); ctx.fill();
  ctx.save();
  ctx.beginPath(); roundRect(W.x, W.y, W.w, W.h, 6); ctx.clip();
  ctx.fillStyle = '#94cd9e';
  ctx.beginPath(); ctx.ellipse(W.x + 30, W.y + W.h, 52, 30, 0, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W.x + 96, W.y + W.h, 44, 22, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = 'rgba(255,244,190,0.95)';
  ctx.beginPath(); ctx.arc(W.x + 86, W.y + 22, 11, 0, 7); ctx.fill();
  // (5) leaves drifting past the window
  ctx.fillStyle = 'rgba(86,150,92,0.85)';
  for (let i = 0; i < 3; i++) {
    const p = ((roomT * 0.09) + i / 3) % 1;
    const lx = W.x + p * (W.w + 20) - 10;
    const ly = W.y + 24 + Math.sin(roomT * 0.9 + i * 2) * 16 + p * 30;
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(roomT * 0.6 + i);
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.6, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle = '#6e4c2c'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(W.x + W.w / 2, W.y); ctx.lineTo(W.x + W.w / 2, W.y + W.h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W.x, W.y + W.h / 2); ctx.lineTo(W.x + W.w, W.y + W.h / 2); ctx.stroke();
  // shaft of daylight falling down and to the right
  const shaft = ctx.createLinearGradient(W.x, W.y, W.x + 150, F);
  shaft.addColorStop(0, 'rgba(255,240,190,0.30)');
  shaft.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(W.x, W.y); ctx.lineTo(W.x + W.w, W.y);
  ctx.lineTo(W.x + W.w + 130, F); ctx.lineTo(W.x + 40, F);
  ctx.closePath(); ctx.fill();
  // (1) dust motes turning in the shaft
  for (const m of ambient.motes) {
    ctx.fillStyle = `rgba(255,246,214,${(Math.min(1, m.life / 2) * 0.55).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.fill();
  }

  /* ---------- Nova's desk ---------- */
  contactShadow(D.x + D.w / 2, F + 3, D.w * 0.46, 0.24);
  ctx.fillStyle = '#5e4226';                                    // legs
  ctx.fillRect(D.x + 10, D.y + 8, 9, F - D.y - 8);
  ctx.fillRect(D.x + D.w - 20, D.y + 8, 9, F - D.y - 8);
  ctx.fillStyle = '#8a5f36';                                    // desktop
  roundRect(D.x, D.y, D.w, 10, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,235,200,0.25)'; ctx.fillRect(D.x, D.y, D.w, 3);
  // Nova's goggles, left behind
  ctx.strokeStyle = '#57d0c9'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(D.x + 12, D.y - 6); ctx.lineTo(D.x + 32, D.y - 6); ctx.stroke();
  ctx.fillStyle = '#ffb84d';
  ctx.beginPath(); ctx.arc(D.x + 12, D.y - 6, 5, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(D.x + 32, D.y - 6, 5, 0, 7); ctx.fill();
  // her half-finished invention, still sparking (3)
  ctx.fillStyle = '#7f8894';
  roundRect(D.x + 42, D.y - 18, 20, 18, 4); ctx.fill();
  ctx.fillStyle = '#57d0c9';
  ctx.beginPath(); ctx.arc(D.x + 52, D.y - 10, 4.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#c8cdd6'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(D.x + 62, D.y - 14); ctx.lineTo(D.x + 72, D.y - 20); ctx.stroke();
  for (const s of ambient.sparks) {
    ctx.fillStyle = `rgba(174,243,255,${Math.min(1, s.life * 2).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, 1.6, 0, 7); ctx.fill();
  }
  // a mug of something warm (2)
  ctx.fillStyle = '#e6e0d2';
  roundRect(D.x + 108, D.y - 16, 16, 16, 3); ctx.fill();
  ctx.strokeStyle = '#e6e0d2'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(D.x + 127, D.y - 8, 4, -1.2, 1.2); ctx.stroke();
  for (const s of ambient.steam) {
    ctx.strokeStyle = `rgba(255,255,255,${(Math.min(1, s.life) * 0.32).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(s.x + Math.sin(s.t * 3 + s.sway) * 6, s.y - 7, s.x, s.y - 13);
    ctx.stroke();
  }
  // flowers appear once Dex has rescued a few creatures
  if (save.ratsRescued >= 5) {
    ctx.fillStyle = '#8fc3d6';
    roundRect(D.x + 132, D.y - 14, 12, 14, 3); ctx.fill();
    ['#ff8fb0', '#ffd24d', '#c07dff'].forEach((c, i) => {
      ctx.fillStyle = c;
      const fx2 = D.x + 138 + (i - 1) * 6, fy2 = D.y - 20 - Math.abs(i - 1) * 3
                + Math.sin(roomT * 1.2 + i) * 1.2;
      ctx.beginPath(); ctx.arc(fx2, fy2, 3.4, 0, 7); ctx.fill();
    });
  }
  // Nova's empty chair
  const ch = TREEHOUSE.chair;
  contactShadow(ch.x + ch.w / 2, F + 2, 30, 0.2);
  ctx.fillStyle = '#8a5f36'; roundRect(ch.x, ch.y, ch.w, ch.h, 3); ctx.fill();
  ctx.fillStyle = '#5e4226';
  ctx.fillRect(ch.x + 4, ch.y + ch.h, 6, F - ch.y - ch.h);
  ctx.fillRect(ch.x + ch.w - 10, ch.y + ch.h, 6, F - ch.y - ch.h);
  roundRect(ch.x + ch.w - 8, ch.y - 26, 6, 28, 2); ctx.fill();

  /* ---------- mission board ---------- */
  ctx.fillStyle = '#6e4c2c';
  roundRect(B.x - 7, B.y - 7, B.w + 14, B.h + 14, 8); ctx.fill();
  ctx.fillStyle = '#c9a06a'; roundRect(B.x, B.y, B.w, B.h, 5); ctx.fill();
  ctx.fillStyle = 'rgba(120,86,48,0.35)';
  for (let i = 0; i < 26; i++) {                     // cork speckle
    ctx.beginPath();
    ctx.arc(B.x + 8 + hash(i) * (B.w - 16), B.y + 8 + hash(i + 9) * (B.h - 16), 1.6, 0, 7);
    ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5a3d00'; ctx.font = '900 12px "Segoe UI", sans-serif';
  ctx.fillText('OUR MISSION', B.x + B.w / 2, B.y + 18);
  const MISSIONS = [
    { t: 'Cure the rats', sub: `${save.ratsRescued} rescued`, done: save.ratsRescued > 0, locked: false },
    { t: 'Rescue Nova',   sub: 'Coming soon!', done: false, locked: true },
    { t: 'Stop the King', sub: 'Coming soon!', done: false, locked: true },
  ];
  MISSIONS.forEach((m, i) => {
    const cy2 = B.y + 30 + i * 44;
    ctx.fillStyle = m.locked ? '#e6ddcb' : '#fffaf0';
    roundRect(B.x + 8, cy2, B.w - 16, 38, 4); ctx.fill();
    ctx.fillStyle = '#c05a3a';                        // pin
    ctx.beginPath(); ctx.arc(B.x + B.w / 2, cy2 + 3, 3, 0, 7); ctx.fill();
    ctx.fillStyle = m.locked ? '#9a8f7c' : '#3b4a63';
    ctx.font = '900 11px "Segoe UI", sans-serif';
    ctx.fillText((m.locked ? '🔒 ' : m.done ? '✓ ' : '') + m.t, B.x + B.w / 2, cy2 + 18);
    ctx.fillStyle = m.locked ? '#a99e8b' : '#7d8fa8';
    ctx.font = '800 10px "Segoe UI", sans-serif';
    ctx.fillText(m.sub, B.x + B.w / 2, cy2 + 31);
  });

  /* ---------- the Power-up Workshop ---------- */
  const pegX = BEN.x - 4, pegY = TREEHOUSE.pegTop, pegW = BEN.w + 8, pegH = 128;
  ctx.fillStyle = '#7d6647'; roundRect(pegX, pegY, pegW, pegH, 6); ctx.fill();
  ctx.fillStyle = 'rgba(40,26,12,0.30)';                // pegboard holes
  for (let gx = pegX + 12; gx < pegX + pegW - 8; gx += 14) {
    for (let gy = pegY + 12; gy < pegY + pegH - 10; gy += 14) {
      ctx.beginPath(); ctx.arc(gx, gy, 1.5, 0, 7); ctx.fill();
    }
  }
  if (builtCount === 4) {                               // master inventor trim
    ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 3;
    roundRect(pegX, pegY, pegW, pegH, 6); ctx.stroke();
  }
  ctx.fillStyle = '#5a3d00'; ctx.font = '900 11px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("NOVA'S WORKSHOP", pegX + pegW / 2, pegY - 6);
  // hanging tools on the left of the pegboard
  ctx.strokeStyle = '#98a0b5'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(pegX + 10, pegY + 16); ctx.lineTo(pegX + 10, pegY + 34); ctx.stroke();
  ctx.fillStyle = '#c8cdd6';
  ctx.beginPath(); ctx.arc(pegX + 10, pegY + 14, 4, 0, 7); ctx.fill();
  // workbench surface
  contactShadow(BEN.x + BEN.w / 2, F + 3, BEN.w * 0.44, 0.24);
  ctx.fillStyle = '#5e4226';
  ctx.fillRect(BEN.x + 12, BEN.y + 12, 10, F - BEN.y - 12);
  ctx.fillRect(BEN.x + BEN.w - 22, BEN.y + 12, 10, F - BEN.y - 12);
  ctx.fillStyle = '#96683c'; roundRect(BEN.x, BEN.y, BEN.w, 14, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,235,200,0.28)'; ctx.fillRect(BEN.x, BEN.y, BEN.w, 4);

  for (const st of TREEHOUSE.stations) {
    if (st.type !== 'slot') continue;
    const def = POWERUPS[st.id];
    const built = save.built[st.id], hasBp = save.blueprints[st.id];
    const equipped = save.equipped === st.id;
    const sx = st.x, sy = pegY + 16, sw = 74, sh = 92;
    // the slot itself
    if (equipped) {
      ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 4;
      roundRect(sx - sw / 2 - 4, sy - 4, sw + 8, sh + 8, 10); ctx.stroke();
      ctx.fillStyle = 'rgba(255,210,77,0.16)';
      roundRect(sx - sw / 2 - 4, sy - 4, sw + 8, sh + 8, 10); ctx.fill();
    }
    ctx.fillStyle = built ? '#fdf3d9' : hasBp ? '#6b5f4e' : '#4a4238';
    roundRect(sx - sw / 2, sy, sw, sh, 8); ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = built ? '#d9b56a' : hasBp ? '#b8a26a' : '#39332b';
    ctx.setLineDash(!built && hasBp ? [6, 5] : []);
    roundRect(sx - sw / 2, sy, sw, sh, 8); ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'center';
    if (built) {
      ctx.fillStyle = 'rgba(255,226,150,0.5)';        // finished gadgets glow
      ctx.beginPath(); ctx.arc(sx, sy + 40, 24 + Math.sin(roomT * 2 + sx) * 2, 0, 7); ctx.fill();
      ctx.font = '34px "Segoe UI Emoji", "Segoe UI", sans-serif';
      ctx.fillText(def.icon, sx, sy + 52);
      if (equipped) {
        ctx.fillStyle = '#2c7a3e'; ctx.font = '900 10px "Segoe UI", sans-serif';
        ctx.fillText('EQUIPPED', sx, sy + 80);
      }
    } else if (hasBp) {
      // the unlocked power-up's plan, pinned up and waiting to be built
      ctx.fillStyle = '#5b7fb0'; roundRect(sx - 26, sy + 14, 52, 42, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4;
      ctx.strokeRect(sx - 18, sy + 22, 36, 26);
      ctx.beginPath(); ctx.moveTo(sx - 18, sy + 34); ctx.lineTo(sx + 18, sy + 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, sy + 22); ctx.lineTo(sx, sy + 48); ctx.stroke();
      ctx.globalAlpha = 0.3 + Math.abs(Math.sin(roomT * 2.2)) * 0.2;
      ctx.font = '22px "Segoe UI Emoji", "Segoe UI", sans-serif';
      ctx.fillText(def.icon, sx, sy + 42);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe9b8'; ctx.font = '900 10px "Segoe UI", sans-serif';
      ctx.fillText('🔨 BUILD ME', sx, sy + 72);
    } else {
      ctx.fillStyle = '#6e675f'; ctx.font = '900 34px "Segoe UI", sans-serif';
      ctx.fillText('?', sx, sy + 56);
    }
    // vice + name plate on the bench below each slot
    ctx.fillStyle = '#7f8894';
    roundRect(sx - 12, BEN.y - 8, 24, 9, 2); ctx.fill();
    ctx.fillStyle = '#5e4226';
    roundRect(sx - 36, sh + sy + 6, 72, 18, 5); ctx.fill();
    ctx.fillStyle = '#ffefd0'; ctx.font = '800 10px "Segoe UI", sans-serif';
    ctx.fillText(built || hasBp ? def.name : '???', sx, sh + sy + 19);
  }

  /* ---------- the way out: an open doorway onto Greenhaven ---------- */
  ctx.fillStyle = '#4a3220';
  roundRect(DOOR.x - 8, DOOR.y - 8, DOOR.w + 16, DOOR.h + 8, 8); ctx.fill();
  const outG = ctx.createLinearGradient(0, DOOR.y, 0, F);
  outG.addColorStop(0, '#9ad8ff'); outG.addColorStop(0.7, '#dff3ff');
  ctx.fillStyle = outG; ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
  ctx.save();
  ctx.beginPath(); ctx.rect(DOOR.x, DOOR.y, DOOR.w, DOOR.h); ctx.clip();
  ctx.fillStyle = '#8cc79a';
  ctx.beginPath(); ctx.ellipse(DOOR.x + 20, F - 6, 60, 34, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#6fb37f';
  ctx.beginPath(); ctx.ellipse(DOOR.x + 82, F - 2, 52, 26, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#5abf4a'; ctx.fillRect(DOOR.x, F - 14, DOOR.w, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';        // a cloud drifting past outside
  const cxo = DOOR.x + ((roomT * 3) % (DOOR.w + 50)) - 25;
  ctx.beginPath(); ctx.arc(cxo, DOOR.y + 30, 11, 0, 7);
  ctx.arc(cxo + 12, DOOR.y + 33, 8, 0, 7); ctx.fill();
  if (save.completions > 0) {                      // Dex knows the way now
    ctx.strokeStyle = `rgba(125,227,255,${(0.35 + Math.sin(roomT * 2) * 0.15).toFixed(3)})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.ellipse(DOOR.x + DOOR.w / 2, DOOR.y + DOOR.h / 2, 22 + i * 12, 46 + i * 16, 0, 0, 7);
      ctx.stroke();
    }
  }
  ctx.restore();
  // daylight spilling in across the floorboards
  const spill = ctx.createLinearGradient(DOOR.x, F, DOOR.x - 70, ROOM_H);
  spill.addColorStop(0, 'rgba(255,248,214,0.34)');
  spill.addColorStop(1, 'rgba(255,248,214,0)');
  ctx.fillStyle = spill;
  ctx.beginPath();
  ctx.moveTo(DOOR.x, F); ctx.lineTo(DOOR.x + DOOR.w, F);
  ctx.lineTo(DOOR.x + DOOR.w + 10, ROOM_H); ctx.lineTo(DOOR.x - 70, ROOM_H);
  ctx.closePath(); ctx.fill();
  // door frame + sign
  ctx.strokeStyle = '#5e4226'; ctx.lineWidth = 7;
  ctx.strokeRect(DOOR.x - 3, DOOR.y - 3, DOOR.w + 6, DOOR.h + 3);
  ctx.fillStyle = '#5e4226'; roundRect(DOOR.x - 6, DOOR.y - 30, DOOR.w + 12, 24, 6); ctx.fill();
  ctx.fillStyle = '#ffefd0'; ctx.font = '900 12px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ADVENTURE →', DOOR.x + DOOR.w / 2, DOOR.y - 13);
  // a bright NEW! flag whenever there's an adventure waiting that Dex has
  // never finished — so an unlocked level can never go unnoticed
  if (LEVELS.some((L, i) => levelUnlocked(i) && !save.levelDone[i])) {
    const bob = Math.sin(roomT * 3) * 2;
    ctx.save();
    ctx.translate(DOOR.x + DOOR.w / 2, DOOR.y - 96 + bob);
    ctx.rotate(-0.1);
    ctx.fillStyle = '#ff5f6d';
    roundRect(-26, -13, 52, 24, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '900 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEW!', 0, 5);
    ctx.restore();
  }

  /* ---------- trophy shelf above the door ---------- */
  ctx.fillStyle = '#5e4226'; ctx.fillRect(DOOR.x - 10, DOOR.y - 62, DOOR.w + 20, 7);
  ctx.font = '17px "Segoe UI Emoji", "Segoe UI", sans-serif';
  const tr = Math.min(save.completions, 4);
  for (let i = 0; i < tr; i++) ctx.fillText('🏆', DOOR.x + 6 + i * 24, DOOR.y - 66);
  if (save.crystalsBank >= 80) ctx.fillText('🪴', DOOR.x + DOOR.w - 4, DOOR.y - 66);

  /* ---------- hanging lamp (4) ---------- */
  ctx.save();
  ctx.translate(358, 26);
  ctx.rotate(lampSway);
  ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 40); ctx.stroke();
  ctx.fillStyle = '#c9603f';
  ctx.beginPath(); ctx.moveTo(-20, 62); ctx.lineTo(20, 62); ctx.lineTo(11, 40); ctx.lineTo(-11, 40);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,232,160,0.95)';
  ctx.beginPath(); ctx.ellipse(0, 62, 12, 5, 0, 0, 7); ctx.fill();
  ctx.restore();
  const lampG = ctx.createRadialGradient(358, 96, 8, 358, 96, 210);
  lampG.addColorStop(0, 'rgba(255,226,150,0.24)');
  lampG.addColorStop(1, 'rgba(255,226,150,0)');
  ctx.fillStyle = lampG; ctx.fillRect(148, 20, 420, 330);

  /* ---------- string lights, earned with crystals ---------- */
  if (save.crystalsBank >= 30) {
    ctx.strokeStyle = 'rgba(60,40,20,0.6)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 34);
    ctx.quadraticCurveTo(ROOM_W / 2, 58, ROOM_W, 34);
    ctx.stroke();
    for (let i = 0; i < 11; i++) {
      const p = i / 10, lx = p * ROOM_W;
      const ly = 34 + Math.sin(p * Math.PI) * 22;
      ctx.fillStyle = ['#ffd24d', '#7de3ff', '#ff8fb0', '#a5f2a0'][i % 4];
      ctx.globalAlpha = 0.75 + Math.sin(roomT * 1.6 + i) * 0.25;
      ctx.beginPath(); ctx.arc(lx, ly + 5, 3.4, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- crystal jar ---------- */
  const jx = 246, jy = F - 40;
  contactShadow(jx + 16, F + 2, 20, 0.2);
  ctx.fillStyle = 'rgba(206,232,255,0.45)'; roundRect(jx, jy, 32, 40, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,210,77,0.85)';
  const fillH = Math.min(28, 4 + save.crystalsBank * 0.3);
  roundRect(jx + 3, jy + 40 - fillH - 3, 26, fillH, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
  roundRect(jx, jy, 32, 40, 7); ctx.stroke();
  ctx.fillStyle = '#5a3d00'; ctx.font = '900 11px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`⭐${save.crystalsBank}`, jx + 16, jy + 54);
  if (save.ratsRescued >= 12) {
    ctx.font = '16px "Segoe UI Emoji", "Segoe UI", sans-serif';
    ctx.fillText('🧀', 210, F + 14);
  }

  /* ---------- rescued rats, then Dex ---------- */
  for (const r of thRatsDeco) {
    contactShadow(r.x, F + 2, 15, 0.22);
    drawFriendlyRatAt(r.x, F, r.dir, roomT + r.seed);
  }
  contactShadow(player.x + player.w / 2, F + 2, 20, 0.3);
  drawPlayer();
  drawParticles();

  /* ---------- gentle vignette to settle the whole room ---------- */
  const vig = ctx.createRadialGradient(ROOM_W / 2, ROOM_H / 2 - 20, 260, ROOM_W / 2, ROOM_H / 2 - 20, 520);
  vig.addColorStop(0, 'rgba(20,10,4,0)');
  vig.addColorStop(1, 'rgba(20,10,4,0.26)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, ROOM_W, ROOM_H);
  ctx.restore();

  /* ---------- screen-space text: title, hint, interaction prompt ---------- */
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(52,34,16,0.85)';
  roundRect(VIEW_W / 2 - 150, 34, 300, 32, 12); ctx.fill();
  ctx.fillStyle = '#ffefd0';
  ctx.font = '900 17px "Segoe UI", sans-serif';
  ctx.fillText("🌳 Dex & Nova's Treehouse", VIEW_W / 2, 56);
  const hint = treehouseHint();
  ctx.font = '700 14px "Segoe UI", sans-serif';
  const hw = ctx.measureText(hint).width + 30;
  ctx.fillStyle = 'rgba(52,34,16,0.72)';
  roundRect(VIEW_W / 2 - hw / 2, 72, hw, 26, 10); ctx.fill();
  ctx.fillStyle = '#ffe9b8';
  ctx.fillText(hint, VIEW_W / 2, 90);
  const near = stationNear();
  if (near) {
    let label;
    if (near.type === 'door') label = `${actKey('🚪')} — Adventure!`;
    else if (save.built[near.id]) label = save.equipped === near.id
      ? `${actKey('✋')} — Put away` : `${actKey('✋')} — Equip`;
    else if (save.blueprints[near.id]) label = `${actKey('🔧')} — Build it (maths!)`;
    else label = '🔒 Not found yet';
    ctx.font = '900 15px "Segoe UI", sans-serif';
    const lw = ctx.measureText(label).width + 26;
    const lx = near.x * S, ly = (near.type === 'door' ? DOOR.y - 44 : TREEHOUSE.pegTop - 42) * S;
    ctx.fillStyle = 'rgba(255,239,208,0.96)';
    roundRect(lx - lw / 2, ly - 20, lw, 28, 10); ctx.fill();
    ctx.fillStyle = '#5a3d00';
    ctx.fillText(label, lx, ly);
  }
}

/* --------------------------------------------- 13. VICTORY & PROGRESSION */
function win() {
  if (game.state !== 'playing') return;
  game.state = 'victory';
  sfx.victory();
  addShake(4);
  burst(LEVEL.portal.x + 35, LEVEL.portal.y + 50, '#7de3ff', 30, 300);

  // bank the run. Finishing a level for the FIRST time hands over that level's
  // power-up — one clear, named reward per new adventure conquered.
  const firstClear = !save.levelDone[levelIndex];
  save.crystalsBank += game.crystals;
  save.completions++;
  save.levelDone[levelIndex] = true;
  if (save.levelBest[levelIndex] == null || game.time < save.levelBest[levelIndex]) {
    save.levelBest[levelIndex] = game.time;
  }
  const reward = POWERUP_ORDER[levelIndex];
  const earned = (firstClear && reward && !save.blueprints[reward]) ? reward : null;
  if (earned) { save.blueprints[earned] = true; sfx.unlock(); }
  persist();

  const mins = Math.floor(game.time / 60), secs = Math.floor(game.time % 60);
  ui.statTime.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
  ui.statCrystals.textContent = `${game.crystals} / ${game.totalCrystals} ⭐`;
  ui.statCures.textContent = `${game.cures} 💛`;
  ui.statSecrets.textContent = `${game.secrets} / ${LEVEL.caches.length} 🗺`;
  const q = game.stats.questions;
  ui.statQuestions.textContent = `${q}`;
  ui.statAccuracy.textContent = q === 0
    ? 'No questions needed!'
    : `${Math.round(game.stats.firstTry / q * 100)}% first try`;
  const finale = !!LEVEL.boss;
  // where the green button goes. win() has already marked this level done, so
  // the next one is unlocked by the time anybody can read this card.
  const nextIdx = levelIndex + 1;
  victoryNextIndex = (!finale && nextIdx < LEVELS.length &&
                      LEVELS[nextIdx].build && levelUnlocked(nextIdx)) ? nextIdx : null;
  if (victoryNextIndex === null) {
    ui.replayBtn.classList.add('hidden');       // nothing after this one
  } else {
    ui.replayBtn.classList.remove('hidden');
    ui.replayBtn.textContent = `▶ Continue to ${LEVELS[victoryNextIndex].name}`;
  }
  // the card's default wording is per-level; put it back for ordinary levels
  const setCard = (title, blurb) => {
    if (ui.victoryTitle) ui.victoryTitle.textContent = title;
    if (ui.victoryBlurb) ui.victoryBlurb.textContent = blurb;
  };
  setCard('🎉 You reached the Star Portal! 🎉',
          'Brilliant work, Dex — Nova would be proud! Greenhaven feels brighter already.');
  if (finale) {
    // The last level hands over no power-up — there are only four and they
    // belong to levels one to four. Its reward is the ending.
    setCard('💛 Nova is home. 💛',
            'You solved every puzzle, cured every creature and brought her back. ' +
            'That was all you.');
    // the whole adventure, not just this level — the numbers she built up over
    // five worlds are the part worth showing her at the end
    ui.unlockBanner.innerHTML =
      '<span class="ubTop">💛 Greenhaven is safe!</span>' +
      '<span class="ubHow">The crown is broken, King Ratthew is cured, ' +
      'and every rat went back to being an ordinary rat.</span>' +
      '<span class="ubHow">Across the whole adventure: ' +
      `${save.crystalsBank} crystals gathered ⭐ · ` +
      `${save.ratsRescued} creatures cured 💛 · ` +
      `${save.completions} adventures finished 🗺</span>` +
      '<span class="ubHow">Thank you for playing, Dex.</span>';
    ui.unlockBanner.classList.remove('hidden');
  } else if (earned) {
    // one reward, named, with what it actually does
    const def = POWERUPS[earned];
    ui.unlockBanner.innerHTML =
      `<span class="ubTop">🎁 New power-up: ${def.icon} ${def.name}!</span>` +
      `<span class="ubHow">${def.desc.replace('{ACT}', ActHint(def.icon))}</span>` +
      `<span class="ubHow">Build it in your treehouse workshop →</span>`;
    ui.unlockBanner.classList.remove('hidden');
  } else {
    ui.unlockBanner.classList.add('hidden');
  }
  // The last level earns the ending. Everything above has already been banked
  // and persisted, so the story can take its time without risking the run:
  // the victory card is waiting behind it and finishOutro() reveals it.
  if (finale) { startOutro(); return; }
  ui.overlayVictory.classList.remove('hidden');
}

/* ------------------------------------------- 13b. OPENING CINEMATIC ------
   A data-driven, in-engine storybook intro. Scenes, captions, durations and
   sound cues live in INTRO_SCENES; renderIntro/updateIntro only interpret it.
   Everything is drawn with the game's own art helpers so the story matches
   what the player actually meets in the level.                             */

// `scenes` and `onDone` are what make this engine play the ending as well as
// the opening: everything else here is shared by both.
const intro = { scene: 0, t: 0, paused: false, waiting: false,
                fired: new Set(), musicT: 0, musicIdx: 0,
                scenes: null, onDone: null };
const cinemaScene = () => intro.scenes[intro.scene];

const INTRO_PATTERNS = {
  peace: { notes: [523, 659, 784, 659, 880, 784, 659, 587], type: 'triangle', vol: 0.04, beat: 0.46 },
  doom:  { notes: [123, 0, 98, 0, 131, 0, 98, 117],         type: 'sine',     vol: 0.06, beat: 0.5 },
  tense: { notes: [196, 233, 196, 175, 196, 233, 262, 233], type: 'triangle', vol: 0.045, beat: 0.4 },
  march: { notes: [147, 147, 0, 147, 175, 147, 0, 131],     type: 'square',   vol: 0.028, beat: 0.36 },
  hero:  { notes: [392, 494, 587, 494, 659, 587, 784, 659], type: 'triangle', vol: 0.045, beat: 0.4 },
};
const introSfx = {
  boom()   { AudioSys.tone(70, 0.7, { type: 'sine', vol: 0.12, slide: -30 });
             AudioSys.tone(150, 0.5, { type: 'sawtooth', vol: 0.045, slide: -90 }); },
  riser()  { AudioSys.tone(180, 1.2, { type: 'sawtooth', vol: 0.035, slide: 700 }); },
  laugh()  { [392, 330, 294, 262].forEach((f, i) =>
               AudioSys.tone(f, 0.16, { type: 'square', vol: 0.055, delay: i * 0.15 })); },
  whoosh() { [0, 0.12, 0.24].forEach(d =>
               AudioSys.tone(300, 0.3, { type: 'sine', vol: 0.05, slide: 500, delay: d })); },
};

/* ---- shared cinematic art helpers (match the in-game look) ---- */
function introSky(top, bot) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
function drawDexActor(x, yFeet, opts = {}) {
  const { face = 1, expr = 'happy', run = false, reach = false, aura = false, lean = 0 } = opts;
  ctx.save();
  ctx.translate(x, yFeet);
  if (lean) ctx.rotate(lean);
  ctx.scale(face, 1);
  const ph = Math.sin(game.time * 10);
  ctx.strokeStyle = '#d67f22'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, -12);
  ctx.quadraticCurveTo(-26, -18 + Math.sin(game.time * 6) * 5, -24, -32 + Math.sin(game.time * 6) * 4);
  ctx.stroke();
  ctx.fillStyle = '#e8912f';
  if (run) {
    ctx.beginPath(); ctx.ellipse(-6 + ph * 4, -4, 5, 4, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7 - ph * 4, -4, 5, 4, 0, 0, 7); ctx.fill();
  } else {
    ctx.beginPath(); ctx.ellipse(-6, -4, 5, 4, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -4, 5, 4, 0, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#f5a144';
  ctx.beginPath(); ctx.ellipse(0, -17, 13, 13, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe9c9';
  ctx.beginPath(); ctx.ellipse(2, -14, 7, 8, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#d67f22'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-10, -22); ctx.lineTo(-4, -24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-11, -16); ctx.lineTo(-5, -18); ctx.stroke();
  ctx.fillStyle = '#e2571f';
  ctx.beginPath(); ctx.ellipse(2, -27, 9, 4, 0, 0, 7); ctx.fill();
  if (reach) {                                   // front paw stretched out
    ctx.strokeStyle = '#f5a144'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(8, -22); ctx.lineTo(22, -36); ctx.stroke();
    ctx.fillStyle = '#ffe9c9';
    ctx.beginPath(); ctx.arc(23, -37, 4, 0, 7); ctx.fill();
  }
  const hy = -34 + Math.sin(game.time * 3);
  ctx.fillStyle = '#f5a144';
  ctx.beginPath(); ctx.ellipse(3, hy, 11, 10, 0, 0, 7); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6, hy - 5); ctx.lineTo(-4, hy - 16); ctx.lineTo(1, hy - 8); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, hy - 7); ctx.lineTo(10, hy - 16); ctx.lineTo(12, hy - 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2b7c6';
  ctx.beginPath();
  ctx.moveTo(-4.6, hy - 7); ctx.lineTo(-4, hy - 13); ctx.lineTo(-1, hy - 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffe9c9';
  ctx.beginPath(); ctx.ellipse(8, hy + 3, 5.5, 4.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a3550';
  ctx.beginPath(); ctx.arc(6, hy - 2, 2.1, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(12, hy - 2, 2.1, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 2;
  if (expr === 'determined') {
    ctx.beginPath(); ctx.moveTo(3, hy - 6.5); ctx.lineTo(8, hy - 4.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(15, hy - 4.5); ctx.lineTo(10, hy - 6.5); ctx.stroke();
  } else if (expr === 'worried') {
    ctx.beginPath(); ctx.arc(6, hy - 6, 3, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(12, hy - 6, 3, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(9.5, hy + 4, 1.8, 0, 7); ctx.stroke();
  }
  ctx.fillStyle = '#e2846f';
  ctx.beginPath(); ctx.arc(9.5, hy + 2.4, 1.6, 0, 7); ctx.fill();
  ctx.restore();
  if (aura) {
    ctx.strokeStyle = 'rgba(159,220,255,0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, yFeet - 22, 30 + Math.sin(game.time * 4) * 2, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(159,220,255,0.10)'; ctx.fill();
  }
}
function drawNovaActor(x, yFeet, opts = {}) {
  const { face = 1, arm = 'idle' } = opts;
  ctx.save();
  ctx.translate(x, yFeet);
  ctx.scale(face, 1);
  ctx.strokeStyle = '#b9a7e0'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, -12);
  ctx.quadraticCurveTo(-25, -20 + Math.sin(game.time * 5) * 4, -22, -33);
  ctx.stroke();
  ctx.fillStyle = '#d9d2ee';
  ctx.beginPath(); ctx.ellipse(-6, -4, 5, 4, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7, -4, 5, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ece6f7';                      // fur
  ctx.beginPath(); ctx.ellipse(0, -17, 13, 13, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#8a6a4d';                      // inventor's tool belt
  ctx.fillRect(-11, -14, 22, 6);
  ctx.fillStyle = '#c8cdd6';                      // tiny spanner on the belt
  ctx.fillRect(-3, -16, 3, 9);
  ctx.beginPath(); ctx.arc(-1.5, -17, 2.6, 0, 7); ctx.fill();
  if (arm === 'press') {                          // slamming the launch button
    ctx.strokeStyle = '#ece6f7'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(8, -20); ctx.lineTo(20, -6); ctx.stroke();
  } else if (arm === 'wave') {
    ctx.strokeStyle = '#ece6f7'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(8, -22); ctx.lineTo(19, -38); ctx.stroke();
  }
  const hy = -34 + Math.sin(game.time * 3 + 1);
  ctx.fillStyle = '#ece6f7';
  ctx.beginPath(); ctx.ellipse(3, hy, 11, 10, 0, 0, 7); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6, hy - 5); ctx.lineTo(-4, hy - 16); ctx.lineTo(1, hy - 8); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, hy - 7); ctx.lineTo(10, hy - 16); ctx.lineTo(12, hy - 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#57d0c9';
  ctx.beginPath();
  ctx.moveTo(-4.6, hy - 7); ctx.lineTo(-4, hy - 13); ctx.lineTo(-1, hy - 8); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#57d0c9'; ctx.lineWidth = 3;  // goggles band
  ctx.beginPath(); ctx.moveTo(-7, hy - 7); ctx.lineTo(13, hy - 9); ctx.stroke();
  ctx.fillStyle = '#ffb84d';                       // goggle lenses, pushed up
  ctx.beginPath(); ctx.arc(1, hy - 10, 3.4, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(9, hy - 11, 3.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a3550';
  ctx.beginPath(); ctx.arc(6, hy - 1, 2.1, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(12, hy - 1, 2.1, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 1.6; // smile
  ctx.beginPath(); ctx.arc(9, hy + 3, 3, 0.2, Math.PI - 0.6); ctx.stroke();
  ctx.restore();
}
function drawRatthew(x, yFeet, s, t, face = 1, opts = {}) {
  const cured = !!opts.cured;
  const crown = opts.crown !== false;               // the Gamma Crown, or a plain one
  // cured, he wears the same browns as every other creature Dex has healed
  const fur    = cured ? '#8a6242' : '#6b5a9e';
  const furLit = cured ? '#a67a52' : '#8d7cc0';
  const furDim = cured ? '#6f4e39' : '#574a85';
  const feet   = cured ? '#5f4330' : '#5a4d8a';
  ctx.save();
  ctx.translate(x, yFeet);
  ctx.scale(s * face, s);
  if (!cured) {
    ctx.fillStyle = 'rgba(140,255,120,0.14)';      // radioactive aura
    ctx.beginPath(); ctx.arc(0, -14, 30, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = '#e8a2b8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-15, -6);
  ctx.quadraticCurveTo(-26, -12 + Math.sin(t * 3) * 2, -29, -3); ctx.stroke();
  ctx.fillStyle = '#8c2f3f';                       // royal cape
  ctx.beginPath();
  ctx.moveTo(-6, -24);
  ctx.quadraticCurveTo(-24, -14 + Math.sin(t * 2.6) * 3, -19, 0);
  ctx.lineTo(-4, -6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = fur;                             // plump royal body
  ctx.beginPath(); ctx.ellipse(0, -11, 16, 12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = furLit;
  ctx.beginPath(); ctx.ellipse(3, -9, 9, 8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = feet;                            // feet
  ctx.beginPath(); ctx.ellipse(-6, -1.5, 4.5, 2.5, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, -1.5, 4.5, 2.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = fur;                             // head + snout
  ctx.beginPath(); ctx.arc(8, -24, 8, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(12, -28); ctx.lineTo(23, -21); ctx.lineTo(12, -17); ctx.closePath(); ctx.fill();
  ctx.fillStyle = furDim;                          // ear
  ctx.beginPath(); ctx.arc(4, -31, 4.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#f2b7c6';
  ctx.beginPath(); ctx.arc(4, -31, 2.2, 0, 7); ctx.fill();
  if (cured) {                                     // an ordinary rat's eye
    ctx.fillStyle = '#2a1c10';
    ctx.beginPath(); ctx.arc(12, -25, 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(12.9, -25.9, 0.9, 0, 7); ctx.fill();
    ctx.strokeStyle = '#5c3f2a'; ctx.lineWidth = 1.5;   // a small, sheepish smile
    ctx.beginPath(); ctx.arc(15, -20.5, 3.6, 0.45, Math.PI - 0.75); ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(140,255,120,0.45)';      // huge glowing eye
    ctx.beginPath(); ctx.arc(12, -25, 4.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#c6ffb8';
    ctx.beginPath(); ctx.arc(12, -25, 2.2, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2a1f45'; ctx.lineWidth = 1.6;   // gleeful grin
    ctx.beginPath(); ctx.arc(14, -19.5, 4.5, 0.3, Math.PI - 0.9); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(13, -19, 2, 2.4); ctx.fillRect(16, -18.4, 2, 2.2);
  }
  if (crown) {
    if (cured) {                                   // a plain little crown
      ctx.fillStyle = '#e8bf4a';
      ctx.beginPath();
      ctx.moveTo(2, -33); ctx.lineTo(4, -38); ctx.lineTo(8, -34); ctx.lineTo(12, -38);
      ctx.lineTo(14, -33); ctx.closePath(); ctx.fill();
      ctx.fillRect(2, -33.5, 12, 2);
    } else {
      ctx.fillStyle = '#ffd24d';                   // the Gamma Crown
      ctx.beginPath();
      ctx.moveTo(1, -35); ctx.lineTo(3, -42); ctx.lineTo(6, -36); ctx.lineTo(9, -43);
      ctx.lineTo(12, -36); ctx.lineTo(14, -41); ctx.lineTo(15, -34); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8443f';
      ctx.beginPath(); ctx.arc(8, -37, 1.6, 0, 7); ctx.fill();
    }
  }
  if (!cured && Math.sin(t * 7) > 0.2) {           // radioactive sparks
    ctx.strokeStyle = 'rgba(140,255,120,0.85)'; ctx.lineWidth = 1.6;
    const sx = Math.sin(t * 13) * 8;
    ctx.beginPath();
    ctx.moveTo(-6 + sx, -30); ctx.lineTo(-3 + sx, -35); ctx.lineTo(0 + sx, -31);
    ctx.stroke();
  }
  ctx.restore();
}
function drawGuardRat(x, yFeet, glitch, flicker) {
  ctx.save();
  if (flicker) ctx.globalAlpha = 0.45 + Math.abs(Math.sin(game.time * 18)) * 0.55;
  const fake = { x1: x, cured: !glitch, warn: 0, dir: 1 };
  drawRat(fake, { x: x - 18, y: yFeet - 24, w: 36, h: 24 });
  ctx.restore();
}
function drawScrollFx(x, y, tint) {
  ctx.fillStyle = tint === 'cyan' ? 'rgba(125,227,255,0.3)' : 'rgba(192,125,255,0.3)';
  ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill();
  ctx.fillStyle = '#f4e9c8';
  roundRect(x - 11, y - 8, 22, 16, 4); ctx.fill();
  ctx.fillStyle = '#d9c79a';
  ctx.beginPath(); ctx.arc(x - 11, y, 4, 0, 7); ctx.arc(x + 11, y, 4, 0, 7); ctx.fill();
}
function drawTreehouseExt(x, gy) {
  ctx.fillStyle = '#4e9e5f';
  ctx.beginPath();
  ctx.arc(x - 30, gy - 168, 34, 0, 7);
  ctx.arc(x + 34, gy - 172, 38, 0, 7);
  ctx.arc(x + 2, gy - 196, 36, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#7c5a3a';
  ctx.fillRect(x - 14, gy - 150, 28, 150);
  ctx.fillStyle = '#8a5f36';
  roundRect(x - 52, gy - 152, 104, 62, 8); ctx.fill();
  ctx.fillStyle = '#6b4226';
  ctx.beginPath();
  ctx.moveTo(x - 60, gy - 150); ctx.lineTo(x, gy - 182); ctx.lineTo(x + 60, gy - 150);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffe9a0';
  ctx.beginPath(); ctx.arc(x + 22, gy - 122, 12, 0, 7); ctx.fill();
  ctx.strokeStyle = '#6b4226'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 30, gy); ctx.lineTo(x - 30, gy - 88); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 20, gy); ctx.lineTo(x - 20, gy - 88); ctx.stroke();
  for (let i = 1; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(x - 31, gy - i * 18); ctx.lineTo(x - 19, gy - i * 18); ctx.stroke();
  }
}
function drawCastleSil(x, baseY, glow) {
  ctx.fillStyle = '#3a2f55';
  ctx.fillRect(x - 54, baseY - 60, 30, 60);
  ctx.fillRect(x + 24, baseY - 60, 30, 60);
  ctx.fillRect(x - 30, baseY - 90, 60, 90);
  ctx.beginPath(); ctx.moveTo(x - 54, baseY - 60); ctx.lineTo(x - 39, baseY - 82); ctx.lineTo(x - 24, baseY - 60); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 24, baseY - 60); ctx.lineTo(x + 39, baseY - 82); ctx.lineTo(x + 54, baseY - 60); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 30, baseY - 90); ctx.lineTo(x, baseY - 118); ctx.lineTo(x + 30, baseY - 90); ctx.closePath(); ctx.fill();
  if (glow) {
    ctx.fillStyle = 'rgba(140,255,120,0.8)';
    ctx.beginPath(); ctx.arc(x - 39, baseY - 40, 3, 0, 7); ctx.arc(x + 39, baseY - 40, 3, 0, 7);
    ctx.arc(x, baseY - 60, 4, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#ffd24d';
  ctx.beginPath();
  ctx.moveTo(x - 7, baseY - 118); ctx.lineTo(x - 4, baseY - 127); ctx.lineTo(x, baseY - 119);
  ctx.lineTo(x + 4, baseY - 127); ctx.lineTo(x + 7, baseY - 118); ctx.closePath(); ctx.fill();
}
const easeOut = p => 1 - (1 - p) * (1 - p);

/* ---- the five scenes ---- */
function introScene1(t) {
  camX = 40 + t * 26;
  introSky('#8fd3ff', '#eafaff');
  drawSun(); drawClouds();
  drawHills(0.22, 340, '#94cd9e', 46, 0.0042, 60, 0.0013);
  drawHills(0.42, 400, '#60b074', 34, 0.006, 44, 0.0021);
  drawTrees();
  ctx.fillStyle = '#5abf4a'; ctx.fillRect(0, 430, VIEW_W, 14);
  ctx.fillStyle = '#8a5a3b'; ctx.fillRect(0, 444, VIEW_W, VIEW_H - 444);
  drawTreehouseExt(660, 430);
  // wildlife: a happy mosquito and a pottering rat (the world before the glitch)
  drawMozzie({ x: 200 + Math.sin(game.time * 1.4) * 26, y: 270 + Math.sin(game.time * 2.2) * 14,
             cy: 0, cured: true });
  drawFriendlyRatAt(320 + Math.sin(game.time * 0.8) * 40, 430, Math.cos(game.time * 0.8) > 0 ? 1 : -1, game.time);
  // Dex & Nova building a power-up together
  drawDexActor(492, 430, { face: 1 });
  drawNovaActor(568, 430, { face: -1, arm: 'press' });
  const gy = 375 + Math.sin(game.time * 3) * 4;
  ctx.fillStyle = 'rgba(159,220,255,0.30)';
  ctx.beginPath(); ctx.arc(530, gy, 17 + Math.sin(game.time * 5) * 3, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(159,220,255,0.9)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(530, gy, 12, 0, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(526, gy - 4, 3, 0, 7); ctx.fill();
  // transition: an eerie green glow rises from underground
  const glow = clamp((t - 3.4) / 1.2, 0, 1);
  if (glow > 0) {
    const g = ctx.createLinearGradient(0, VIEW_H, 0, VIEW_H - 260);
    g.addColorStop(0, `rgba(110,230,90,${(glow * 0.55).toFixed(3)})`);
    g.addColorStop(1, 'rgba(110,230,90,0)');
    ctx.fillStyle = g; ctx.fillRect(0, VIEW_H - 260, VIEW_W, 260);
  }
}
function introScene2(t) {
  camX = 0;
  introSky('#241d38', '#0e0a1c');
  ctx.fillStyle = '#191330';
  for (let i = 0; i < 9; i++) {                    // stalactites
    const sx = 40 + i * 115 + hash(i) * 50, h = 40 + hash(i + 5) * 60;
    ctx.beginPath(); ctx.moveTo(sx - 22, 0); ctx.lineTo(sx, h); ctx.lineTo(sx + 22, 0); ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 5; i++) {                    // glowing crystals
    const cx2 = 80 + i * 200, cy2 = 438;
    ctx.fillStyle = 'rgba(140,255,120,0.5)';
    ctx.beginPath(); ctx.moveTo(cx2 - 12, cy2); ctx.lineTo(cx2, cy2 - 34 - hash(i) * 20); ctx.lineTo(cx2 + 12, cy2); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#231a3e'; ctx.fillRect(0, 440, VIEW_W, VIEW_H - 440);
  ctx.fillStyle = '#332855';                       // throne
  roundRect(400, 268, 160, 172, 14); ctx.fill();
  roundRect(420, 240, 120, 40, 10); ctx.fill();
  // the transformation
  const s = t < 1.2 ? 1.1 : 1.1 + easeOut(clamp((t - 1.2) / 1.4, 0, 1)) * 4.4;
  if (t >= 1.2 && t < 2.9) {                       // energy rings
    for (let i = 0; i < 3; i++) {
      const p = ((t * 1.4 + i / 3) % 1);
      ctx.strokeStyle = i % 2 ? `rgba(140,255,120,${(1 - p) * 0.7})` : `rgba(192,125,255,${(1 - p) * 0.7})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(480, 360, 20 + p * 260, 0, 7); ctx.stroke();
    }
  }
  drawRatthew(480, 438, s, game.time);
  if (t < 1.2) {                                   // crown floating down
    const cy2 = 378 - (1 - t / 1.2) * 60;
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath();
    ctx.moveTo(462, cy2); ctx.lineTo(467, cy2 - 16) ; ctx.lineTo(474, cy2 - 2);
    ctx.lineTo(481, cy2 - 17); ctx.lineTo(488, cy2 - 2); ctx.lineTo(493, cy2 - 14);
    ctx.lineTo(496, cy2); ctx.closePath(); ctx.fill();
  }
  if (t >= 1.2 && t < 1.6) {                       // gentle flash, never strobing
    const a = (1 - (t - 1.2) / 0.4) * (save.settings.reducedFx ? 0.12 : 0.25);
    ctx.fillStyle = `rgba(230,255,220,${a.toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (t >= 2.7) {                                  // the 50× badge
    const pop = Math.min(1, (t - 2.7) * 4);
    ctx.save();
    ctx.translate(756, 170);
    ctx.rotate(-0.12);
    ctx.scale(pop, pop);
    ctx.fillStyle = '#ffd24d';
    ctx.font = '900 54px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#5a3d00'; ctx.lineWidth = 7;
    ctx.strokeText('50×', 0, 0);
    ctx.fillText('50×', 0, 0);
    ctx.font = '900 17px "Segoe UI", sans-serif';
    ctx.strokeText('BIGGER!', 0, 28); ctx.fillText('BIGGER!', 0, 28);
    ctx.restore();
  }
  // royal guards become Glitch Rats
  [130, 220, 310].forEach((gx, i) => {
    const flip = 3.0 + i * 0.4;
    drawGuardRat(gx, 438, t >= flip, Math.abs(t - flip) < 0.3);
  });
}
function introScene3(t) {
  camX = 260;
  introSky('#7fbde8', '#dff2f7');
  drawClouds();
  drawHills(0.22, 340, '#8cbd94', 46, 0.0042, 60, 0.0013);
  drawHills(0.42, 400, '#5aa46c', 34, 0.006, 44, 0.0021);
  ctx.fillStyle = '#5abf4a'; ctx.fillRect(0, 430, VIEW_W, 14);
  ctx.fillStyle = '#8a5a3b'; ctx.fillRect(0, 444, VIEW_W, VIEW_H - 444);
  drawTreehouseExt(300, 430);
  // Ratthew looms in from the right, then retreats with Nova
  const rx = t < 1.2 ? 1080 - easeOut(t / 1.2) * 290 : t < 3.2 ? 790 : 790 + easeOut((t - 3.2) / 2.3) * 320;
  drawRatthew(rx, 430, 4.4, game.time, -1);   // always facing Dex, in and out
  // Nova's secret launch button
  const pressed = t >= 1.3 && t < 1.8;
  ctx.fillStyle = '#6e4c2c'; roundRect(430, 412, 44, 18, 5); ctx.fill();
  ctx.fillStyle = pressed ? '#a83232' : '#e8443f';
  ctx.beginPath(); ctx.ellipse(452, pressed ? 412 : 408, 16, 9, 0, Math.PI, 0); ctx.fill();
  // Nova's power-up plans launch in arcs across Greenhaven
  const L = [ { dx: -290, tint: 'cyan' }, { dx: 240, tint: 'violet' },
              { dx: 150, tint: 'cyan' }, { dx: -180, tint: 'violet' } ];
  L.forEach((sc2, i) => {
    const t0 = 1.6 + i * 0.16;
    const p = clamp((t - t0) / 1.5, 0, 1);
    if (p <= 0 || t < t0) return;
    const x = 452 + sc2.dx * p;
    const y = 400 - Math.sin(p * Math.PI) * 180 + (p === 1 ? 12 : 0);
    drawScrollFx(x, Math.min(y, 412), sc2.tint);
  });
  // Nova: pressing, then carried up and away — still calling the plan
  let nx = 380, ny = 430, arm = pressed ? 'press' : 'wave';
  if (t >= 3.2) {
    const p = easeOut(clamp((t - 3.2) / 1.6, 0, 1));
    nx = 380 + (rx - 120 - 380) * p;
    ny = 430 - 140 * p + Math.sin(game.time * 3) * 4;
    arm = 'wave';
  }
  drawNovaActor(nx, ny, { face: t >= 3.2 ? -1 : 1, arm });
  drawDexActor(150, 430, { face: 1, expr: 'worried', reach: t >= 3.0 });
}
function introScene4(t) {
  camX = 0;
  introSky('#41639e', '#5a86c9');
  // the map of Greenhaven
  ctx.fillStyle = '#79c06e';
  ctx.beginPath();
  ctx.moveTo(90, 420);
  ctx.bezierCurveTo(40, 250, 180, 90, 420, 110);
  ctx.bezierCurveTo(680, 60, 900, 160, 880, 320);
  ctx.bezierCurveTo(870, 440, 620, 490, 400, 470);
  ctx.bezierCurveTo(240, 490, 120, 470, 90, 420);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#4d8a56'; ctx.lineWidth = 5; ctx.stroke();
  // river: healthy blue turning radioactive green from the castle outward
  const RIV = [[840, 260], [700, 300], [560, 260], [420, 330], [280, 300], [150, 380]];
  ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.strokeStyle = '#7fd3ff';
  ctx.beginPath(); ctx.moveTo(RIV[0][0], RIV[0][1]);
  for (const [px, py] of RIV.slice(1)) ctx.lineTo(px, py);
  ctx.stroke();
  const segs = clamp(Math.floor(t / 0.7), 0, RIV.length - 1);
  if (segs > 0) {
    ctx.strokeStyle = 'rgba(140,255,120,0.9)';
    ctx.beginPath(); ctx.moveTo(RIV[0][0], RIV[0][1]);
    for (let i = 1; i <= segs; i++) ctx.lineTo(RIV[i][0], RIV[i][1]);
    ctx.stroke();
  }
  // trees fade near the spreading corruption
  const corruptR = 60 + t * 150;
  for (let i = 0; i < 14; i++) {
    const tx = 150 + hash(i) * 640, ty = 170 + hash(i + 31) * 240;
    const d = Math.hypot(tx - 790, ty - 210);
    ctx.fillStyle = d < corruptR ? '#8a8577' : '#3f7d49';
    ctx.beginPath(); ctx.arc(tx, ty, 9, 0, 7); ctx.fill();
  }
  // corruption haze
  const cg = ctx.createRadialGradient(790, 210, 10, 790, 210, corruptR + 80);
  cg.addColorStop(0, 'rgba(140,255,120,0.30)');
  cg.addColorStop(0.6, 'rgba(192,125,255,0.18)');
  cg.addColorStop(1, 'rgba(192,125,255,0)');
  ctx.fillStyle = cg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Ratthew's castle rises
  drawCastleSil(790, 210 - Math.min(1, t / 1.4) * 0 + (1 - easeOut(clamp(t / 1.4, 0, 1))) * 70, t > 1.2);
  // Glitch Rats march outward across the map
  for (let i = 0; i < 4; i++) {
    const mx = 720 - ((t * 46 + i * 78) % 480);
    if (mx < 150) continue;
    ctx.save();
    ctx.translate(mx, 330 + Math.sin(i * 2.1) * 40);
    ctx.scale(0.62, 0.62);
    drawGuardRat(0, 12, true, false);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(12,18,48,0.75)';
  roundRect(VIEW_W / 2 - 120, 20, 240, 32, 12); ctx.fill();
  ctx.fillStyle = '#ffe9b8';
  ctx.font = '900 17px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🗺 Greenhaven', VIEW_W / 2, 42);
}
function introScene5(t) {
  camX = 0;
  const wall = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  wall.addColorStop(0, '#9c7048'); wall.addColorStop(1, '#7c5636');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.strokeStyle = 'rgba(60,38,20,0.35)'; ctx.lineWidth = 3;
  for (let px = 80; px < VIEW_W; px += 88) {
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, 430); ctx.stroke();
  }
  ctx.fillStyle = '#6b4a2b'; ctx.fillRect(0, 430, VIEW_W, VIEW_H - 430);
  // Nova's workshop frame, waiting on the wall
  ctx.fillStyle = '#fdf3d9'; roundRect(200, 180, 110, 104, 10); ctx.fill();
  ctx.strokeStyle = '#d9b56a'; ctx.lineWidth = 4; roundRect(200, 180, 110, 104, 10); ctx.stroke();
  ctx.font = '42px "Segoe UI Emoji", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🫧', 255, 242);
  // one of Nova's power-up plans floats up to Dex
  if (t < 1.4) {
    const p = easeOut(clamp(t / 1.2, 0, 1));
    drawScrollFx(430 + p * 20, 412 - p * 60, 'cyan');
  }
  const determined = t >= 1.3;
  const dashing = t >= 3.2 && t < 3.8;
  const dx2 = dashing ? 480 + (t - 3.2) * 260 : 480;
  if (dashing) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(dx2 - 60 - i * 22, 390 + i * 12);
      ctx.lineTo(dx2 - 24 - i * 22, 390 + i * 12);
      ctx.stroke();
    }
  }
  if (t < 3.8) {
    drawDexActor(dx2, 430, { face: 1, expr: determined ? 'determined' : 'worried',
                             aura: t >= 1.7, run: dashing, lean: dashing ? -0.14 : 0 });
  }
  // a Glitch Rat is cured before your eyes — exactly like in the game
  if (t >= 2.0 && t < 2.7) drawGuardRat(730, 428, true, t > 2.5);
  else if (t >= 2.7 && t < 3.8) {
    drawFriendlyRatAt(730 + (t - 2.7) * 150, 430, 1, game.time);
  }
  // final statements + title card
  if (t >= 3.7) {
    ctx.fillStyle = `rgba(10,14,35,${Math.min(0.8, (t - 3.7) * 2).toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const STS = [
      { txt: 'CURE THE RATS.', col: '#7de3ff' },
      { txt: 'RESCUE NOVA.', col: '#57d0c9' },
      { txt: 'STOP THE KING.', col: '#ffd24d' },
    ];
    STS.forEach((s2, i) => {
      const t0 = 3.9 + i * 0.5;
      if (t < t0) return;
      const pop = Math.min(1, (t - t0) * 5);
      ctx.save();
      ctx.translate(VIEW_W / 2, 150 + i * 66);
      ctx.scale(0.7 + pop * 0.3, 0.7 + pop * 0.3);
      ctx.globalAlpha = pop;
      ctx.font = '900 40px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 6;
      ctx.strokeText(s2.txt, 0, 0);
      ctx.fillStyle = s2.col;
      ctx.fillText(s2.txt, 0, 0);
      ctx.restore();
    });
  }
  if (intro.waiting) {
    ctx.textAlign = 'center';
    ctx.font = '900 52px "Segoe UI", sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 7;
    ctx.strokeText('🐱 CatQuest', VIEW_W / 2, 408);
    ctx.fillStyle = '#ffce54';
    ctx.fillText('🐱 CatQuest', VIEW_W / 2, 408);
    if (Math.sin(game.time * 4) > -0.3) {
      ctx.font = '900 24px "Segoe UI", sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('Press Start ▶  (tap or Enter)', VIEW_W / 2, 458);
    }
  }
}

const INTRO_SCENES = [
  { dur: 4.8, music: 'peace', draw: introScene1, events: [
      { at: 3.5, fn: () => introSfx.riser() } ],
    caps: [ { at: 0.3, dur: 4.4, sp: 'narr',
              text: 'Greenhaven was peaceful… until King Ratthew the Third discovered the Gamma Crown.' } ] },
  { dur: 5.8, music: 'doom', draw: introScene2, events: [
      { at: 1.2, fn: () => { introSfx.boom(); addShake(2.5); } },
      { at: 3.6, fn: () => introSfx.laugh() } ],
    caps: [ { at: 0.2, dur: 3.2, sp: 'narr',
              text: 'It made Ratthew fifty times bigger — and turned his followers into an army of radioactive rats!' },
            { at: 3.6, dur: 2.1, sp: 'ratthew', text: 'At last! A kingdom worthy of ME!' } ] },
  { dur: 5.8, music: 'tense', draw: introScene3, events: [
      { at: 1.35, fn: () => sfx.click() },
      { at: 1.6, fn: () => introSfx.whoosh() } ],
    caps: [ { at: 0.2, dur: 2.7, sp: 'narr',
              text: 'He kidnapped Nova — the brilliant inventor who knew how to reverse the corruption.' },
            { at: 3.1, dur: 2.5, sp: 'nova', text: 'Dex! Find my power-ups!' } ] },
  { dur: 4.8, music: 'march', draw: introScene4, events: [],
    caps: [ { at: 0.2, dur: 2.5, sp: 'narr',
              text: 'Now Ratthew plans to drain Greenhaven\'s power and build a barren Rat Empire.' },
            { at: 2.8, dur: 1.9, sp: 'ratthew', text: 'Soon, everything will belong to the rats!' } ] },
  { dur: 5.9, music: 'hero', draw: introScene5, events: [
      { at: 1.7, fn: () => sfx.pop() },
      { at: 2.7, fn: () => { sfx.cure(); burst(730, 405, '#c07dff', 16, 200); } },
      { at: 3.9, fn: () => sfx.collect() },
      { at: 4.4, fn: () => sfx.collect() },
      { at: 4.9, fn: () => sfx.checkpoint() } ],
    caps: [ { at: 0.2, dur: 2.8, sp: 'narr',
              text: 'But Nova left Dex everything he needs to fight back.' } ] },
];

/* ------------------------------------------- 13c. CLOSING CINEMATIC ------
   The ending, built from the same parts as the opening and deliberately
   answering it thread for thread: the crown, the fifty-times-bigger king, the
   army of glitched rats, the drained land, and Nova. The opening asked five
   questions; this answers all five, in order, and then stops.

   Two rules held throughout, both Sean's: the King is CURED, never beaten —
   so the ending has to give him somewhere to go, not a punishment — and
   nothing a child reads ever says died or killed.                          */

// a soft warm wash used by several ending scenes as the colour comes back
function outroGlow(a, col) {
  if (a <= 0) return;
  const g = ctx.createRadialGradient(VIEW_W / 2, 300, 40, VIEW_W / 2, 300, 640);
  g.addColorStop(0, col.replace('ALPHA', (a * 0.5).toFixed(3)));
  g.addColorStop(1, col.replace('ALPHA', '0'));
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

/* 1. The cage opens. Answers: 'He kidnapped Nova.'
   This is the shot the whole game has been walking towards, so the cage is
   built as a solid object standing on the floor with a door on a hinge —
   an early version drew it as two stroked rectangles and read as a wireframe
   floating in the dark, which is no way to end a rescue. */
function outroScene1(t) {
  camX = 0;
  introSky('#37305a', '#1a1430');
  ctx.fillStyle = '#221b3d';
  for (let i = 0; i < 7; i++) {                     // sewer pipe mouths behind
    const px = 30 + i * 140;
    ctx.beginPath(); ctx.arc(px, 240, 34 + hash(i) * 10, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#2a2247'; ctx.fillRect(0, 440, VIEW_W, VIEW_H - 440);
  ctx.fillStyle = '#342a56'; ctx.fillRect(0, 440, VIEW_W, 7);

  const open = easeOut(clamp(t / 1.5, 0, 1));
  const walk = easeOut(clamp((t - 1.3) / 2.0, 0, 1));
  const CX = 250, CY = 250, CW = 200, CH = 190;      // the cage, stood on the floor

  // warm light pouring out of it as the door goes
  if (open > 0.15) {
    const g = ctx.createRadialGradient(CX + CW, CY + CH * 0.6, 10,
                                       CX + CW, CY + CH * 0.6, 420);
    g.addColorStop(0, 'rgba(255,236,180,' + (open * 0.30).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,236,180,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  ctx.fillStyle = 'rgba(10,8,20,0.45)';              // the dark inside
  ctx.fillRect(CX, CY, CW, CH);
  ctx.fillStyle = '#6f6790';                         // frame: floor, roof, back post
  ctx.fillRect(CX - 8, CY + CH, CW + 16, 10);
  ctx.fillRect(CX - 8, CY - 10, CW + 16, 12);
  ctx.fillRect(CX - 8, CY, 9, CH);
  ctx.fillStyle = '#8f86b4';                         // fixed bars
  for (let i = 1; i <= 4; i++) ctx.fillRect(CX + i * 34, CY, 7, CH);

  ctx.save();                                        // the door, on its hinge
  ctx.translate(CX + CW, CY);
  ctx.rotate(-open * 1.15);
  ctx.fillStyle = '#a79fc4';
  ctx.fillRect(-4, -8, 8, CH + 16);
  ctx.fillRect(-72, -8, 76, 10);
  ctx.fillRect(-72, CH - 2, 76, 10);
  for (let i = 0; i < 3; i++) ctx.fillRect(-18 - i * 24, 0, 6, CH);
  ctx.fillStyle = '#ffd24d';                         // the broken lock
  ctx.beginPath(); ctx.arc(-40, CH * 0.5, 9, 0, 7); ctx.fill();
  ctx.restore();

  // Nova walks out; Dex is waiting for her
  drawNovaActor(CX + 90 + walk * 250, 440, { face: 1, arm: walk > 0.6 ? 'press' : 'idle' });
  drawDexActor(700, 440, { face: -1, expr: 'happy', reach: walk > 0.5 });
  if (t > 2.4) {
    for (let i = 0; i < 6; i++) {
      const a = game.time * 1.6 + i * 1.05;
      ctx.fillStyle = 'rgba(190,255,245,0.75)';
      ctx.beginPath();
      ctx.arc(640 + Math.cos(a) * 74, 330 + Math.sin(a * 1.3) * 46, 3, 0, 7);
      ctx.fill();
    }
  }
}
/* 2. Ratthew, ordinary size. Answers: 'It made him fifty times bigger.' */
function outroScene2(t) {
  camX = 0;
  introSky('#524879', '#2b2348');                   // lighter: the gloom is lifting
  ctx.fillStyle = '#332a52'; ctx.fillRect(0, 440, VIEW_W, VIEW_H - 440);
  ctx.fillStyle = '#3f3266';                        // the throne, far too big for him now
  roundRect(660, 268, 160, 172, 14); ctx.fill();
  roundRect(680, 240, 120, 40, 10); ctx.fill();
  // the crown, in pieces on the floor, no longer glowing
  ctx.fillStyle = '#c8a33c';
  [[300, 6], [332, 4], [356, 5], [386, 4]].forEach(([px, r], i) => {
    ctx.beginPath(); ctx.arc(px, 436 - r, r, 0, 7); ctx.fill();
  });
  outroGlow(clamp((t - 0.6) / 1.6, 0, 1), 'rgba(255,214,130,ALPHA)');
  // him: one times bigger, sitting, small and sorry
  drawRatthew(430, 440, 1.0, game.time, 1, { cured: true, crown: false });
  drawDexActor(560, 440, { face: -1, expr: 'happy' });
  drawNovaActor(626, 440, { face: -1 });
  if (t > 2.6) {                                    // the 50x badge, undone
    const k = Math.min(1, (t - 2.6) * 1.6);
    ctx.save();
    ctx.translate(190, 150); ctx.rotate(-0.12 + k * 0.5);
    ctx.globalAlpha = 1 - k;
    ctx.scale(1 + k * 0.6, 1 + k * 0.6);
    ctx.fillStyle = '#ffd24d'; ctx.textAlign = 'center';
    ctx.font = '900 54px "Segoe UI", sans-serif';
    ctx.strokeStyle = '#5a3d00'; ctx.lineWidth = 7;
    ctx.strokeText('50x', 0, 0); ctx.fillText('50x', 0, 0);
    ctx.restore();
  }
}

/* 3. The army turns back into rats. Answers: 'an army of radioactive rats'. */
function outroScene3(t) {
  camX = 0;
  introSky('#5f8fbe', '#cfe8f2');
  drawClouds();
  drawHills(0.22, 340, '#8cbd94', 46, 0.0042, 60, 0.0013);
  drawHills(0.42, 400, '#5aa46c', 34, 0.006, 44, 0.0021);
  ctx.fillStyle = '#5abf4a'; ctx.fillRect(0, 430, VIEW_W, 14);
  ctx.fillStyle = '#8a5a3b'; ctx.fillRect(0, 444, VIEW_W, VIEW_H - 444);
  // one by one, left to right, each one stops glitching
  const cures = [0.5, 1.0, 1.5, 2.1, 2.7, 3.2];
  cures.forEach((when, i) => {
    const gx = 90 + i * 145;
    const done = t >= when;
    if (done) drawFriendlyRatAt(gx + Math.sin((game.time + i) * 0.9) * 26, 430,
                                Math.cos((game.time + i) * 0.9) > 0 ? 1 : -1, game.time + i);
    else drawGuardRat(gx, 430, true, Math.abs(t - when) < 0.25);
    if (Math.abs(t - when) < 0.35) {                // a puff of cured sparkle
      const k = 1 - Math.abs(t - when) / 0.35;
      ctx.fillStyle = 'rgba(255,236,150,' + (k * 0.8).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(gx, 400, 10 + (1 - k) * 40, 0, 7); ctx.fill();
    }
  });
  outroGlow(clamp((t - 0.4) / 2.4, 0, 1), 'rgba(255,244,190,ALPHA)');
}

/* 4. Greenhaven comes back. Answers: 'drain Greenhaven's power'. */
function outroScene4(t) {
  camX = 40 + t * 18;
  const k = easeOut(clamp(t / 3.4, 0, 1));           // grey to green
  const mix = (a, b) => lerpColor(a, b, k);
  introSky(mix([106, 116, 128], [143, 211, 255]), mix([196, 200, 202], [234, 250, 255]));
  drawSun(); drawClouds();
  drawHills(0.22, 340, mix([140, 145, 138], [148, 205, 158]), 46, 0.0042, 60, 0.0013);
  drawHills(0.42, 400, mix([116, 122, 116], [96, 176, 116]), 34, 0.006, 44, 0.0021);
  drawTrees();
  ctx.fillStyle = mix([124, 130, 122], [90, 191, 74]); ctx.fillRect(0, 430, VIEW_W, 14);
  ctx.fillStyle = '#8a5a3b'; ctx.fillRect(0, 444, VIEW_W, VIEW_H - 444);
  // the crystals she gathered, going home into the ground
  for (let i = 0; i < 9; i++) {
    const cx2 = 60 + i * 105 + hash(i) * 30;
    const fall = ((game.time * 0.5 + i * 0.31) % 1);
    ctx.globalAlpha = (1 - fall) * 0.9 * k;
    ctx.fillStyle = '#ffd24d';
    const cy2 = 120 + fall * 300, r = 7;
    ctx.beginPath();
    ctx.moveTo(cx2, cy2 - r); ctx.lineTo(cx2 + r, cy2);
    ctx.lineTo(cx2, cy2 + r); ctx.lineTo(cx2 - r, cy2);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  drawMozzie({ x: 220 + Math.sin(game.time * 1.4) * 26,
               y: 250 + Math.sin(game.time * 2.2) * 14, cy: 0, cured: true });
  drawFriendlyRatAt(760 + Math.sin(game.time * 0.8) * 34, 430,
                    Math.cos(game.time * 0.8) > 0 ? 1 : -1, game.time);
  // the two of them watching it happen — it is their moment, not a postcard
  drawDexActor(300, 430, { face: 1, expr: 'happy' });
  drawNovaActor(374, 430, { face: 1, arm: 'press' });
  outroGlow(k, 'rgba(180,255,190,ALPHA)');
}

/* 5. Home, and THE END. Answers: 'Nova left Dex everything he needs.' */
function outroScene5(t) {
  camX = 40;
  introSky('#ffb877', '#ffeccb');                   // a warm, bright sunset
  drawSun(); drawClouds();
  drawHills(0.22, 340, '#9ecb98', 46, 0.0042, 60, 0.0013);
  drawHills(0.42, 400, '#6cae74', 34, 0.006, 44, 0.0021);
  drawTrees();
  ctx.fillStyle = '#4fa845'; ctx.fillRect(0, 430, VIEW_W, 14);
  ctx.fillStyle = '#7d5136'; ctx.fillRect(0, 444, VIEW_W, VIEW_H - 444);
  drawTreehouseExt(660, 430);
  // everyone home, the King included: he was cured, not defeated
  drawDexActor(300, 430, { face: 1, expr: 'happy' });
  drawNovaActor(372, 430, { face: -1, arm: 'press' });
  drawRatthew(470, 430, 0.9, game.time, -1, { cured: true });
  drawFriendlyRatAt(540 + Math.sin(game.time * 0.7) * 22, 430,
                    Math.cos(game.time * 0.7) > 0 ? 1 : -1, game.time);
  drawMozzie({ x: 200 + Math.sin(game.time * 1.2) * 30,
               y: 250 + Math.sin(game.time * 2) * 12, cy: 0, cured: true });
  if (t > 3.2) {                                     // THE END
    const k = Math.min(1, (t - 3.2) / 0.8);
    ctx.save();
    ctx.globalAlpha = k * 0.5;
    ctx.fillStyle = '#1b1030'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = k;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe6a8';
    ctx.font = '900 ' + Math.round(50 + (1 - k) * 24) + 'px "Segoe UI", sans-serif';
    ctx.strokeStyle = 'rgba(60,30,10,0.7)'; ctx.lineWidth = 8;
    ctx.strokeText('THE END', VIEW_W / 2, 250);
    ctx.fillText('THE END', VIEW_W / 2, 250);
    ctx.fillStyle = '#fff';
    ctx.font = '900 22px "Segoe UI", sans-serif';
    ctx.fillText('Thank you for saving Greenhaven, Dex.', VIEW_W / 2, 300);
    ctx.restore();
  }
}

const OUTRO_SCENES = [
  { dur: 5.4, music: 'hero', draw: outroScene1, events: [
      { at: 0.3, fn: () => sfx.unlock() },
      { at: 1.5, fn: () => sfx.checkpoint() },
      { at: 2.6, fn: () => { sfx.cure(); burst(620, 340, '#7de3ff', 18, 200); } } ],
    caps: [ { at: 0.3, dur: 2.2, sp: 'narr', text: 'Click. The lock came undone.' },
            { at: 2.7, dur: 2.5, sp: 'nova',
              text: 'You found every single power-up, Dex. I knew you would.' } ] },

  { dur: 6.0, music: 'peace', draw: outroScene2, events: [
      { at: 0.6, fn: () => sfx.pop() },
      { at: 2.7, fn: () => sfx.shrink() } ],
    caps: [ { at: 0.3, dur: 2.4, sp: 'narr',
              text: 'The Gamma Crown lay in four quiet pieces, and King Ratthew was his own size again.' },
            { at: 2.9, dur: 2.9, sp: 'ratthew',
              text: 'I am sorry. Being fifty times bigger was only fifty times lonelier.' } ] },

  { dur: 5.4, music: 'peace', draw: outroScene3, events: [
      { at: 0.5, fn: () => sfx.cure() },
      { at: 1.5, fn: () => sfx.cure() },
      { at: 2.7, fn: () => sfx.cure() },
      { at: 3.2, fn: () => sfx.collect() } ],
    caps: [ { at: 0.3, dur: 3.0, sp: 'narr',
              text: 'One by one the glitch faded away. Underneath it they were only rats, and they had been very frightened.' },
            { at: 3.5, dur: 1.7, sp: 'narr', text: 'Every single one went home.' } ] },

  { dur: 5.8, music: 'hero', draw: outroScene4, events: [
      { at: 1.0, fn: () => sfx.collect() },
      { at: 2.2, fn: () => sfx.collect() },
      { at: 3.4, fn: () => sfx.victory() } ],
    caps: [ { at: 0.3, dur: 3.0, sp: 'narr',
              text: 'And Greenhaven came back. Every crystal Dex had gathered sank into the earth and the green returned.' },
            { at: 3.5, dur: 2.1, sp: 'narr',
              text: 'Brighter, the mosquitoes said, than it had ever been before.' } ] },

  { dur: 8.2, music: 'peace', draw: outroScene5, events: [
      { at: 3.2, fn: () => sfx.victory() } ],
    caps: [ { at: 0.3, dur: 2.6, sp: 'nova',
              text: 'Thank you, Dex. You were braver than all of my inventions put together.' },
            { at: 3.0, dur: 0.1, sp: 'narr', text: '' } ] },
];

/* ---- intro control flow ---- */
function startCinema(scenes, onDone) {
  game.state = 'intro';
  intro.scenes = scenes; intro.onDone = onDone;
  intro.scene = 0; intro.t = 0; intro.paused = false; intro.waiting = false;
  intro.fired = new Set(); intro.musicT = 0; intro.musicIdx = 0;
  input.left = input.right = input.jump = input.jumpPressed = false;
  clearMovementState();
  particles = []; rings = []; fadeAlpha = 0; shakeMag = 0;
  ['overlayTitle', 'overlayMath', 'overlayPause', 'overlayVictory', 'overlayGameOver']
    .forEach(k => ui[k].classList.add('hidden'));
  ui.overlaySettings.classList.add('hidden');
  document.body.classList.add('in-intro');
  ui.introUI.classList.remove('hidden');
}
function startIntro() { startCinema(INTRO_SCENES, finishIntro); }
/* The ending. Dex has freed Nova, the run is already banked, and this plays
   before the victory card so the story lands before the statistics do. */
function startOutro() { startCinema(OUTRO_SCENES, finishOutro); }
function finishOutro() {
  if (game.state !== 'intro') return;
  document.body.classList.remove('in-intro');
  ui.introUI.classList.add('hidden');
  particles = []; shakeMag = 0;
  game.state = 'victory';
  ui.overlayVictory.classList.remove('hidden');
}
function finishIntro() {
  if (game.state !== 'intro') return;
  save.introSeen = true;
  persist();                       // records introSeen; touches nothing else
  document.body.classList.remove('in-intro');
  ui.introUI.classList.add('hidden');
  particles = []; shakeMag = 0;
  enterTreehouse();
}
function skipIntro() { if (game.state === 'intro') intro.onDone(); }
function advanceIntro() {
  if (game.state !== 'intro') return;
  if (intro.waiting) { intro.onDone(); return; }
  const sc = cinemaScene();
  const next = sc.caps.find(c => c.at > intro.t + 0.05);
  const newT = next ? next.at : sc.dur;
  for (const ev of sc.events) {          // don't machine-gun skipped sound cues
    if (ev.at <= newT) intro.fired.add(ev.at);
  }
  intro.t = newT;
}
function updateIntro(dt) {
  if (intro.paused) return;
  game.time += dt;                        // drives ambient animation
  updateParticles(dt);
  shakeMag *= Math.exp(-6 * dt);
  const sc = cinemaScene();
  if (!intro.waiting) {
    intro.t += dt;
    for (const ev of sc.events) {
      if (intro.t >= ev.at && !intro.fired.has(ev.at)) { intro.fired.add(ev.at); ev.fn(); }
    }
    if (intro.t >= sc.dur) {
      if (intro.scene >= intro.scenes.length - 1) {
        intro.waiting = true; intro.t = sc.dur;
      } else {
        intro.scene++; intro.t = 0;
        intro.fired = new Set(); intro.musicIdx = 0;
      }
    }
  }
  const pat = INTRO_PATTERNS[cinemaScene().music];
  intro.musicT += dt;
  if (intro.musicT >= pat.beat) {
    intro.musicT -= pat.beat;
    const f = pat.notes[intro.musicIdx++ % pat.notes.length];
    if (f) AudioSys.tone(f, pat.beat * 0.92, { type: pat.type, vol: pat.vol });
  }
}
function wrapLines(text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const attempt = cur ? cur + ' ' + w : w;
    if (ctx.measureText(attempt).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = attempt;
  }
  if (cur) lines.push(cur);
  return lines;
}
const INTRO_SPEAKERS = {
  narr:    { border: '#ffce54', name: null },
  ratthew: { border: '#c07dff', name: '👑 King Ratthew III' },
  nova:    { border: '#57d0c9', name: '🔧 Nova' },
};
function drawIntroCaption(cap) {
  const st = INTRO_SPEAKERS[cap.sp];
  ctx.font = '900 23px "Segoe UI", sans-serif';
  const lines = wrapLines(cap.text, 700);
  const lh = 30;
  const w = Math.min(830, Math.max(...lines.map(l => ctx.measureText(l).width), 200) + 56);
  const h = lines.length * lh + 26 + (st.name ? 24 : 0);
  const x = VIEW_W / 2 - w / 2, y = VIEW_H - h - 16;
  ctx.fillStyle = 'rgba(12,18,48,0.9)';
  roundRect(x, y, w, h, 16); ctx.fill();
  ctx.strokeStyle = st.border; ctx.lineWidth = 3;
  roundRect(x, y, w, h, 16); ctx.stroke();
  ctx.textAlign = 'center';
  let ty = y + 26;
  if (st.name) {
    ctx.fillStyle = st.border;
    ctx.font = '900 16px "Segoe UI", sans-serif';
    ctx.fillText(st.name, VIEW_W / 2, ty - 4);
    ty += 24;
  }
  ctx.fillStyle = '#fff';
  ctx.font = '900 23px "Segoe UI", sans-serif';
  for (const l of lines) { ctx.fillText(l, VIEW_W / 2, ty); ty += lh; }
}
function renderIntro() {
  const sc = cinemaScene();
  const t = intro.t;
  ctx.save();
  const shx = (Math.random() * 2 - 1) * shakeMag, shy = (Math.random() * 2 - 1) * shakeMag;
  ctx.translate(shx, shy);
  sc.draw(t);
  drawParticles();
  ctx.restore();
  if (!intro.waiting) {
    const cap = sc.caps.find(c => t >= c.at && t < c.at + c.dur);
    if (cap) drawIntroCaption(cap);
  }
  let fade = 0;                            // soft wipes between scenes
  if (t < 0.35) fade = 1 - t / 0.35;
  else if (!intro.waiting && t > sc.dur - 0.35) fade = (t - (sc.dur - 0.35)) / 0.35;
  if (fade > 0) {
    ctx.fillStyle = `rgba(8,10,26,${(fade * 0.96).toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (intro.paused) {
    ctx.fillStyle = 'rgba(8,10,26,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#fff';
    ctx.font = '900 26px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ Story paused — come back to continue!', VIEW_W / 2, VIEW_H / 2);
  }
}

/* --------------------------------------------- 14. UI, DEBUG, MAIN LOOP */
function togglePause() {
  if (game.state === 'playing') {
    game.pausedFrom = 'playing';
    game.state = 'paused';
    ui.overlayPause.classList.remove('hidden');
  } else if (game.state === 'paused') {
    game.state = game.pausedFrom;
    ui.overlayPause.classList.add('hidden');
  }
}
function updateMuteIcons() {
  const icon = AudioSys.muted ? '🔇' : '🔊';
  ui.muteBtn.textContent = icon;
  ui.pauseMuteBtn.textContent = icon + ' Sound on/off';
}
// which level the victory card's green button starts. null means there is
// nothing after this one and the button is hidden.
let victoryNextIndex = null;
let toastTimer = null;
function toast(msg, secs) {
  ui.toast.textContent = msg;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), (secs || 2.6) * 1000);
}
function updateHud() {
  // lives are world state, so they show everywhere Dex is actually in the world
  if (ui.livesChip) {
    ui.livesChip.textContent = `🐱 × ${save.lives}`;
    ui.livesChip.classList.toggle('lowLives', save.lives <= 2);
    ui.livesChip.classList.toggle('hidden', game.state === 'title' || game.state === 'intro');
  }
  if (game.state === 'treehouse' || (game.state === 'math' && mathContext === 'build')) {
    ui.crystalChip.textContent = `⭐ ${save.crystalsBank}`;
    ui.zapChip.textContent = `🐀 ${save.ratsRescued}`;
    const eq = save.equipped && save.built[save.equipped] ? POWERUPS[save.equipped] : null;
    ui.powerChip.textContent = eq ? `${eq.icon} ${eq.name}` : '🔧 no power-up yet';
    const st = stationNear();
    ui.btnPower.classList.remove('hidden');
    ui.btnPower.classList.remove('drained');
    // ring it only when pressing it would actually do something
    ui.btnPower.classList.toggle('callout', !!st &&
      (st.type === 'door' || save.built[st.id] || save.blueprints[st.id]));
    ui.btnPower.textContent = !st ? '❔'
      : st.type === 'door' ? '🚪'
      : save.built[st.id] ? '✋'
      : save.blueprints[st.id] ? '🔧' : '🔒';
    ui.settingsBtn.classList.remove('hidden');   // settings only from home
    ui.pauseBtn.classList.add('hidden');
    ui.healthChip.classList.add('hidden');
    return;
  }
  ui.settingsBtn.classList.add('hidden');
  ui.pauseBtn.classList.remove('hidden');
  ui.btnPower.classList.remove('callout');
  ui.healthChip.classList.remove('hidden');
  ui.healthChip.textContent = player.big === false ? '🤍 small!' : '❤️';
  ui.crystalChip.textContent = `⭐ ${game.crystals}`;
  ui.zapChip.textContent = `⚡ ${game.deaths}`;
  const def = power.id ? POWERUPS[power.id] : null;
  if (def) {
    let s = `${def.icon} ` + '●'.repeat(power.charges) + '○'.repeat(def.max - power.charges);
    if (power.id === 'time' && slowT > 0) s = `⏳ ${Math.ceil(slowT)}s`;
    ui.powerChip.textContent = s;
  } else {
    ui.powerChip.textContent = '—';
  }
  const pct = clamp(game.maxX / LEVEL.portal.x, 0, 1) * 100;
  ui.progressFill.style.width = pct + '%';
  ui.progressCat.style.left = pct + '%';
  // touch power button: reflect equipped power-up + availability
  if (def && !def.passive) {
    ui.btnPower.classList.remove('hidden');
    ui.btnPower.textContent = def.icon;
    ui.btnPower.classList.toggle('drained', power.charges <= 0);
  } else {
    ui.btnPower.classList.add('hidden');
  }
}

function showTitle() {
  game.state = 'title';
  clearMovementState();
  document.body.classList.remove('in-intro');
  ['overlayMath', 'overlayPause', 'overlayVictory', 'overlayGameOver', 'overlaySettings', 'introUI']
    .forEach(k => ui[k].classList.add('hidden'));
  ui.progress.classList.add('hidden');
  ui.overlayTitle.classList.remove('hidden');
  particles = []; rings = []; fadeAlpha = 0; shakeMag = 0;
  input.left = input.right = input.jump = input.jumpPressed = false;
  updateHud();
}
function startFromTitle() {
  AudioSys.ensure();
  sfx.click();
  if (!save.introSeen) startIntro();      // first-time players meet the story
  else enterTreehouse();
}
ui.playBtn.addEventListener('click', startFromTitle);
ui.replayStoryBtn.addEventListener('click', () => {
  AudioSys.ensure(); sfx.click(); startIntro();
});
ui.skipBtn.addEventListener('click', () => { AudioSys.ensure(); skipIntro(); });

/* ---- TEMPORARY: jump-to-level buttons on the title screen -----------------
   Lets a level be tested without playing the ones before it. Remove this block
   and the #testJump markup in index.html when the game ships.               */
LEVELS.forEach((L, i) => {
  if (!L.build) return;
  const b = document.createElement('button');
  b.textContent = `${L.icon} ${i + 1}`;
  b.title = L.name;
  b.addEventListener('click', () => {
    AudioSys.ensure();
    sfx.click();
    save.introSeen = true;      // don't sit through the story when testing
    persist();
    beginAdventure(i);
    toast(`🧪 Test: ${L.name}`);
  });
  ui.tjButtons.appendChild(b);
});
ui.replayBtn.addEventListener('click', () => {
  if (victoryNextIndex === null) return;        // it is hidden, but never trust that alone
  AudioSys.ensure(); sfx.click();
  beginAdventure(victoryNextIndex);
});
// guarded: a stale cached page would otherwise throw here and silently strip
// every listener below this line (mute, pause, resume)
if (ui.gameOverRetryBtn) ui.gameOverRetryBtn.addEventListener('click', () => { AudioSys.ensure(); sfx.click(); restartAdventure(); });
if (ui.gameOverTreehouseBtn) ui.gameOverTreehouseBtn.addEventListener('click', () => { sfx.click(); enterTreehouse(); });
ui.pauseRestartBtn.addEventListener('click', () => { sfx.click(); beginAdventure(); });
ui.victoryTreehouseBtn.addEventListener('click', () => { sfx.click(); enterTreehouse(); });
ui.pauseTreehouseBtn.addEventListener('click', () => { sfx.click(); enterTreehouse(); });
ui.resumeBtn.addEventListener('click', () => { sfx.click(); togglePause(); });
[ui.muteBtn, ui.pauseMuteBtn].forEach(b => b.addEventListener('click', () => {
  AudioSys.ensure();
  save.settings.muted = !AudioSys.muted;
  persist();
  AudioSys.setMuted(save.settings.muted);
  updateMuteIcons();
  ui.muteToggle.checked = save.settings.muted;
}));
ui.muteToggle.addEventListener('change', () => {
  AudioSys.ensure();
  save.settings.muted = ui.muteToggle.checked;
  persist();
  AudioSys.setMuted(save.settings.muted);
  updateMuteIcons();
});
ui.fxToggle.addEventListener('change', () => {
  save.settings.reducedFx = ui.fxToggle.checked;
  persist();
});
ui.pauseBtn.addEventListener('click', () => {
  if (game.state === 'playing' || game.state === 'paused') togglePause();
});
ui.answers.forEach((b, i) => b.addEventListener('click', () => pressAnswer(i)));
// settings live behind their own button, well away from the room
ui.settingsBtn.addEventListener('click', () => {
  AudioSys.ensure(); sfx.click();
  ui.resetConfirm.classList.add('hidden');
  ui.resetBtn.classList.remove('hidden');
  ui.overlaySettings.classList.remove('hidden');
});
ui.settingsCloseBtn.addEventListener('click', () => {
  sfx.click();
  ui.overlaySettings.classList.add('hidden');
});
ui.levelsCloseBtn.addEventListener('click', () => {
  sfx.click();
  ui.overlayLevels.classList.add('hidden');
});
ui.storyBtn.addEventListener('click', () => {
  AudioSys.ensure(); sfx.click();
  ui.overlaySettings.classList.add('hidden');
  startIntro();
});
// reset progress: two-step confirmation
ui.resetBtn.addEventListener('click', () => {
  ui.resetBtn.classList.add('hidden');
  ui.resetConfirm.classList.remove('hidden');
});
ui.resetNo.addEventListener('click', () => {
  ui.resetConfirm.classList.add('hidden');
  ui.resetBtn.classList.remove('hidden');
});
ui.resetYes.addEventListener('click', () => {
  resetSave();
  ui.overlaySettings.classList.add('hidden');
  toast('Progress reset — a fresh adventure awaits!');
  showTitle();          // a wiped save is a brand-new player: back to the very start
});

/* ---- debug helpers ---- */
function forceDeath() { if (game.state === 'playing') die('debug'); }
function debugCheckpoint(dir) {
  if (game.state !== 'playing') return;
  game.checkpoint = clamp(game.checkpoint + dir, 0, LEVEL.checkpoints.length - 1);
  placeAtCheckpoint();
  game.maxX = Math.max(game.maxX, player.x);
  game.invuln = 1;
}
function quizTest(n = 300) { return MathQuiz.selftest(n); }

let dbgStats = null;
if (DEBUG_MODE) {
  ui.debugPanel.classList.remove('hidden');
  ui.debugPanel.innerHTML = '<div id="dbgStats"></div>';
  dbgStats = $('dbgStats');
  const mkBtn = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', fn);
    ui.debugPanel.appendChild(b);
  };
  mkBtn('force zap (T)', forceDeath);
  mkBtn('◀ checkpoint ([)', () => debugCheckpoint(-1));
  mkBtn('checkpoint ▶ (])', () => debugCheckpoint(1));
  mkBtn('+charge', () => { if (power.id) { power.charges = POWERUPS[power.id].max; updateHud(); } });
  mkBtn('unlock all', () => {
    for (const id of POWERUP_ORDER) { save.blueprints[id] = true; save.built[id] = true; }
    persist(); toast('All power-ups built (debug)');
  });
  mkBtn('quiz selftest', () => {
    const r = quizTest(300);
    toast(r.issues.length ? `quiz issues: ${r.issues.length}` : 'quiz selftest: 300 OK ✔');
    if (r.issues.length) console.warn('Quiz issues', r.issues);
  });
  mkBtn('check levels', () => {
    const r = checkLevels();
    toast(r.length ? `⚠ ${r.length} level problem(s) — see console` : 'levels OK ✔');
    if (r.length) console.warn('Level problems', r); else console.log('Level check: all clear');
  });
}
// Catches authoring mistakes in level data: creatures walking on thin air, and
// jumps wider than Dex can clear. Worth running after adding or editing a level.
// How far the least-committed catapult arc travels over flat ground. Derived
// from the tuning rather than written down, so retuning the arc cannot leave a
// stale number behind in the validator.
function catapultSpan() {
  const T = TUNING.player;
  let x = 0, y = 0, vx = T.catapultVx, vy = -T.catapultVy;
  const dt = 1 / 120;
  for (let t = 0; t < 8; t += dt) {
    vx = clamp(vx - T.catapultSteer * dt, T.catapultVxMin, T.catapultVxMax);
    vy += T.catapultGravity * dt;
    x += vx * dt; y += vy * dt;
    if (y >= 0 && vy > 0) break;
  }
  return Math.round(x);
}
function checkLevels() {
  const problems = [];
  LEVELS.forEach((entry, li) => {
    if (!entry.build) return;
    const L = entry.build();
    for (const e of L.enemies) {
      const S = CREATURES[e.species];
      if (S.move === 'fly') continue;               // flyers belong in the air
      if (S.move === 'swing') {
        // a swinger must hang clear of solid ground through its whole arc
        const A = TUNING.enemies.monkeySwingArc;
        for (let k = -1; k <= 1; k += 0.25) {
          const ang = A * k;
          const cx = e.ax + Math.sin(ang) * e.len, cy = e.ay + Math.cos(ang) * e.len;
          const box = { x: cx - e.w / 2, y: cy - e.h / 2, w: e.w, h: e.h };
          if (L.solids.concat(L.crumblers).some(s => overlap(box, s))) {
            problems.push(`${entry.name}: ${e.species} on the vine at ${e.ax} swings through a platform`);
            break;
          }
        }
        continue;
      }
      const surfaces = L.solids.concat(L.crumblers).filter(s => Math.abs(s.y - e.y) < 1);
      const covered = x => surfaces.some(s => x >= s.x - 1 && x <= s.x + s.w + 1);
      if (!covered(e.x1) || !covered(e.x2)) {
        problems.push(`${entry.name}: ${e.species} at ${e.x1}–${e.x2} (y ${e.y}) has no ground under it`);
      }
    }
    const iv = [];
    L.solids.forEach(s => iv.push([s.x, s.x + s.w]));
    L.crumblers.forEach(c => iv.push([c.x, c.x + c.w]));
    L.movers.forEach(m => iv.push([m.cx - m.rangeX - m.w / 2, m.cx + m.rangeX + m.w / 2]));
    if (L.helper) iv.push([L.helper.x, L.helper.x + L.helper.w]);
    (L.vines || []).forEach(v => {
      const reach = Math.sin(TUNING.player.vineMaxAngle) * v.len;
      iv.push([v.ax - reach, v.ax + reach]);
    });
    (L.chutes || []).forEach(c => iv.push([c.x1, c.x2]));
    // A catapult carries Dex over open canyon, so the void behind a geode is
    // covered ground as far as the SHORTEST arc it can produce. Shortest, not
    // average: the arc rule above has already proved every lean lands safely,
    // and this must not paper over a void the least-committed flight drops
    // into.
    (L.pads || []).forEach(pad => iv.push([pad.x, pad.x + catapultSpan()]));
    iv.sort((a, b) => a[0] - b[0]);
    let cover = iv[0][1];
    for (const [a, b] of iv.slice(1)) {
      if (a > cover + 150) problems.push(`${entry.name}: gap too wide at ${Math.round(cover)}–${Math.round(a)}`);
      cover = Math.max(cover, b);
    }
    L.checkpoints.forEach(cp => {
      if (cp.slide) {                            // partway down a chute
        const c = (L.chutes || []).find(ch => cp.x >= ch.x1 && cp.x <= ch.x2);
        if (!c) problems.push(`${entry.name}: slide checkpoint at ${cp.x} isn't on a chute`);
        else if (c.gaps.some(([a, b]) => cp.x > a - 60 && cp.x < b + 60))
          problems.push(`${entry.name}: slide checkpoint at ${cp.x} lands in a hole`);
        else if (c.obs.some(o => Math.abs(o.x - cp.x) < 90))
          problems.push(`${entry.name}: slide checkpoint at ${cp.x} restarts you on top of an obstacle`);
        return;
      }
      const onSolid = L.solids.concat(L.crumblers)
        .some(s => Math.abs(s.y - cp.y) < 1 && cp.x >= s.x - 2 && cp.x + 30 <= s.x + s.w + 2);
      if (!onSolid) problems.push(`${entry.name}: checkpoint at ${cp.x} isn't on solid footing`);
      // ranged attackers must not be able to reach a checkpoint
      L.enemies.forEach(e => {
        const S = CREATURES[e.species];
        if (!S) return;
        if (S.spits) {
          const reach = TUNING.enemies.fireballRangePx + 60;
          if (cp.x + 30 > e.x1 - reach && cp.x < e.x2 + reach) {
            problems.push(`${entry.name}: checkpoint at ${cp.x} is in fireball range of the ${S.label} at ${e.x1}`);
          }
        }
        if (S.throws) {
          const sweep = Math.sin(TUNING.enemies.monkeySwingArc) * e.len;
          const reach = TUNING.enemies.bananaRangePx;
          if (cp.x + 30 > e.ax - sweep - reach && cp.x < e.ax + sweep + reach) {
            problems.push(`${entry.name}: checkpoint at ${cp.x} is in banana range of the ${S.label} at ${e.ax}`);
          }
        }
      });
      // a checkpoint must never sit inside a lava hazard
      (L.geysers || []).forEach(g => {
        if (Math.abs(g.x - (cp.x + 15)) < 40) {
          problems.push(`${entry.name}: checkpoint at ${cp.x} sits on the geyser at ${g.x}`);
        }
      });
      (L.falls || []).forEach(f => {
        if (Math.abs(f.x - (cp.x + 15)) < TUNING.enemies.fallWidth / 2 + 30) {
          problems.push(`${entry.name}: checkpoint at ${cp.x} sits under the lava fall at ${f.x}`);
        }
      });
      // …nor in a slime pool, nor anywhere the rising slime can reach
      (L.slimes || []).forEach(sl => {
        if (cp.x + 30 > sl.x - 40 && cp.x < sl.x + sl.w + 40) {
          problems.push(`${entry.name}: checkpoint at ${cp.x} sits in the slime pool at ${sl.x}`);
        }
      });
      (L.floods || []).forEach(fl => {
        if (cp.x + 30 > fl.x1 - 60 && cp.x < fl.x2 + 60) {
          problems.push(`${entry.name}: checkpoint at ${cp.x} is inside the rising-slime zone ${fl.x1}–${fl.x2}`);
        }
      });
    });
    // geysers need solid ground to erupt from; falls need a lip above their floor
    (L.geysers || []).forEach(g => {
      const onSolid = L.solids.some(s => Math.abs(s.y - g.y) < 1 &&
                                    g.x >= s.x - 2 && g.x <= s.x + s.w + 2);
      if (!onSolid) problems.push(`${entry.name}: geyser at ${g.x} has no ground under it`);
    });
    (L.falls || []).forEach(f => {
      if (f.bottom <= f.top) problems.push(`${entry.name}: lava fall at ${f.x} has no height`);
    });
    // a rising-slime zone must be escapable: it has to actually rise, and a
    // platform above the high-water mark must carry you out past the far edge
    (L.floods || []).forEach(fl => {
      if (fl.topY >= fl.startY) {
        problems.push(`${entry.name}: rising slime at ${fl.x1} never rises`);
      }
      const dry = L.solids.filter(so => so.y <= fl.topY - 12 &&
                                  so.x < fl.x2 && so.x + so.w > fl.x1);
      if (!dry.length) {
        problems.push(`${entry.name}: rising slime at ${fl.x1} has nothing above the high-water mark`);
      } else if (!dry.some(so => so.x + so.w >= fl.x2)) {
        problems.push(`${entry.name}: rising slime at ${fl.x1} has no dry way out past ${fl.x2}`);
      }
    });
    // HEAD ROOM. Dex's jump is jumpVel^2 / (2 * gravity) tall. If something
    // solid hangs lower than that over the stretch he has to take off from,
    // he bonks his head, gets a fraction of his jump, and the gap becomes
    // unmakeable for no visible reason. Only the right-hand edge of a surface
    // matters — that's where you jump from heading right — and only when
    // there is a genuine gap beyond it rather than more floor.
    const PH = TUNING.player.height;
    const JUMP = TUNING.player.jumpVel ** 2 / (2 * TUNING.player.gravity);
    const surfaces = L.solids.concat(L.crumblers);
    surfaces.forEach(S => {
      if (S.w < 40) return;
      const edge = S.x + S.w;
      const continues = surfaces.some(o => o !== S && Math.abs(o.y - S.y) < 6 &&
                                      o.x <= edge + 40 && o.x + o.w > edge + 2);
      if (continues) return;                       // not a ledge, no jump needed
      const ahead = surfaces.filter(o => o !== S && o.x > edge - 10 && o.x < edge + 220)
        .concat(L.movers.filter(m => m.cx + m.rangeX + m.w / 2 > edge - 10 &&
                                     m.cx - m.rangeX - m.w / 2 < edge + 220)
                        .map(m => ({ y: m.cy })));
      if (!ahead.some(o => o.y <= S.y + 4)) return;  // everything ahead is lower: walk off
      const head = S.y - PH;
      let worst = null;
      for (let x = Math.max(S.x, edge - 80); x <= edge; x += 10) {
        const ceiling = surfaces.filter(o => o !== S && o.y + o.h <= head + 1 &&
                                        x + 15 > o.x && x - 15 < o.x + o.w)
                                .reduce((lo, o) => Math.max(lo, o.y + o.h), -Infinity);
        if (ceiling === -Infinity) continue;
        const room = head - ceiling;
        if (room < JUMP - 6 && (!worst || room < worst.room)) worst = { x, room, ceiling };
      }
      if (worst) {
        problems.push(`${entry.name}: only ${Math.round(worst.room)}px of head room ` +
                      `(needs ${Math.round(JUMP)}) jumping off the ledge at ` +
                      `x${Math.round(edge)} y${S.y} — ceiling at y${worst.ceiling}`);
      }
    });
    // CATAPULT ARCS. A geode throws Dex on a three-second ballistic arc he
    // cannot cancel, so every arc it can produce has to be a fair one. This
    // flies each geode exactly as the game does — same gravity, same speeds —
    // at full left lean, no lean, and full right lean, and demands that all
    // three clear whatever is in the way and finish on solid ground.
    //
    // This is the rule that lets a catapult be the ONLY way across a canyon.
    // Without it, "she can steer" quietly means "she can steer into a pit".
    (L.pads || []).forEach(pad => {
      const T = TUNING.player;
      const blockers = L.solids.concat(L.crumblers);
      const LEAN = [[-1, "leaning back"], [0, "flying straight"], [1, "leaning forward"]];
      for (const [lean, how] of LEAN) {
        let x = pad.x + pad.w / 2 - T.width / 2;
        let y = pad.baseY - T.height;
        let vx = T.catapultVx, vy = -T.catapultVy;
        const dt = 1 / 120;
        let landed = false, hitCeiling = false, t = 0;
        while (t < 8) {
          t += dt;
          vx = clamp(vx + lean * T.catapultSteer * dt, T.catapultVxMin, T.catapultVxMax);
          vy = Math.min(vy + T.catapultGravity * dt, T.maxFall);
          const nx = x + vx * dt, ny = y + vy * dt;
          const box = { x: nx, y: ny, w: T.width, h: T.height };
          const hit = blockers.find(o => overlap(box, o));
          if (hit) {
            // landing on top of something is the good ending; anything else
            // means the arc slams into scenery mid-flight
            if (vy > 0 && y + T.height <= hit.y + 6) landed = true;
            else hitCeiling = true;
            break;
          }
          if (ny > VIEW_H + 40) break;            // fell out of the world
          x = nx; y = ny;
        }
        const where = Math.round(pad.x) + " (" + how + ")";
        if (hitCeiling) {
          problems.push(entry.name + ": catapult at " + where +
                        " smashes into scenery at x" + Math.round(x));
        } else if (!landed) {
          problems.push(entry.name + ": catapult at " + where +
                        " has nowhere to land — falls out of the world at x" + Math.round(x));
        } else {
          // and the landing itself must not be onto a hazard
          const foot = { x, y: y + T.height - 4, w: T.width, h: 8 };
          if (L.spikes.some(sp => overlap(foot, sp))) {
            problems.push(entry.name + ": catapult at " + where +
                          " lands on spikes at x" + Math.round(x));
          }
        }
      }
    });

    // REACHABLE ROUTE. A platform you cannot avoid must be one Dex can actually
    // get onto. Anything the level would fall apart without — remove it and a
    // gap opens wider than he can jump — has to sit within his 131px jump of
    // something to its left. Reward ledges are exempt by construction: take
    // one away and the route is still there. This is the check that was
    // missing when Glow City's only way into section 4 was a 130px climb.
    const spans = () => {
      const iv = surfaces.map(o => [o.x, o.x + o.w])
        .concat(L.movers.map(m => [m.cx - m.rangeX - m.w / 2, m.cx + m.rangeX + m.w / 2]));
      if (L.helper) iv.push([L.helper.x, L.helper.x + L.helper.w]);
      return iv;
    };
    const widestGap = iv => {
      const a = iv.slice().sort((u, v) => u[0] - v[0]);
      let cover = a[0][1], worst = 0;
      for (const [x1, x2] of a.slice(1)) {
        worst = Math.max(worst, x1 - cover);
        cover = Math.max(cover, x2);
      }
      return worst;
    };
    surfaces.forEach(S => {
      if (S.kind === 'ground') return;
      const without = spans().filter(([x1, x2]) => !(x1 === S.x && x2 === S.x + S.w));
      if (without.length < 2 || widestGap(without) <= 150) return;   // optional, skip
      // Anything level with S or above it is free — you step across or drop
      // onto S. Only a take-off strictly below counts as a climb.
      const from = surfaces.concat(L.movers.map(m => ({ x: m.cx - m.rangeX - m.w / 2,
                                                        w: m.rangeX * 2 + m.w, y: m.cy })))
        .filter(o => o !== S && o.x + o.w >= S.x - 200 && o.x <= S.x + S.w + 40);
      const best = from.reduce((lo, o) => Math.min(lo, Math.max(0, o.y - S.y)), Infinity);
      if (best > JUMP - 12) {
        problems.push(`${entry.name}: the platform at x${S.x} y${S.y} is on the only ` +
                      `route through, but the nearest thing to jump from is ${
                        best === Infinity ? 'nowhere' : Math.round(best) + 'px'} below ` +
                      `(Dex jumps ${Math.round(JUMP)})`);
      }
    });
    // VINES. Simulated end to end, because a swing is three things in a row
    // and getting any of them wrong makes the gap a guess: the jump off the
    // ledge has to bring Dex within grabbing distance of the vine's end; the
    // swing has to carry him; and the throw when he lets go has to land him.
    // The pendulum and the release here are the same maths the game runs.
    (L.vines || []).forEach(v => {
      const T = TUNING.player;
      const tip = { x: v.ax, y: v.ay + v.len };
      const landing = surfaces.filter(o => o.x > v.ax && o.x < v.ax + 1200)
                              .sort((a, b) => a.x - b.x)[0];
      if (!landing) { problems.push(`${entry.name}: the vine at x${v.ax} swings out over nothing`); return; }
      const ledges = surfaces.filter(o => o.x + o.w <= v.ax + 10 && o.x + o.w > v.ax - 460)
                             .sort((a, b) => (b.x + b.w) - (a.x + a.w));
      if (!ledges.length) { problems.push(`${entry.name}: the vine at x${v.ax} has no ledge to jump from`); return; }
      let bestMiss = 1e9, reachedX = -1e9, ok = false;
      for (const ledge of ledges) {
        const ex = ledge.x + ledge.w;
        // 1. the jump off the ledge
        let grab = null;
        for (let t = 0; t < 1.6; t += 1 / 120) {
          const cx = ex + T.runSpeed * t;
          const cy = (ledge.y - PH / 2) - (T.jumpVel * t - 0.5 * T.gravity * t * t);
          const miss = Math.max(Math.abs(cx - tip.x), Math.abs(cy - tip.y));
          bestMiss = Math.min(bestMiss, miss);
          if (miss < T.vineGrabRadius) {
            grab = { cx, cy, vx: T.runSpeed, vy: -T.jumpVel + T.gravity * t };
            break;
          }
        }
        if (!grab) continue;
        // 2. the swing
        let th = clamp(Math.atan2(grab.cx - v.ax, Math.max(1, grab.cy - v.ay)),
                       -T.vineMaxAngle, T.vineMaxAngle);
        let om = (grab.vx * Math.cos(th) - grab.vy * Math.sin(th)) / v.len + T.vineGrabBoost;
        const step = 1 / 120;
        for (let k = 0; k < 240 && !ok; k++) {
          om += -(T.vineGravity / v.len) * Math.sin(th) * step;
          th += om * step;
          if (Math.abs(th) > T.vineMaxAngle) { th = Math.sign(th) * T.vineMaxAngle; om = 0; }
          if (th < 0.15 || om < 0) continue;               // only forward releases count
          // 3. the throw
          const sp = om * v.len;
          let px = v.ax + Math.sin(th) * v.len;
          let py = v.ay + Math.cos(th) * v.len;
          let vx = clamp(sp * Math.cos(th), -520, 520);
          let vy = clamp(-sp * Math.sin(th) - T.vineReleaseBoost, -820, 620);
          for (let j = 0; j < 240; j++) {
            vy = Math.min(vy + T.gravity * step, T.maxFall);
            px += vx * step; py += vy * step;
            if (py > landing.y + 4) break;
            if (vy > 0 && py >= landing.y - PH / 2 - 4 &&
                px > landing.x + 12 && px < landing.x + landing.w) { ok = true; break; }
          }
          reachedX = Math.max(reachedX, px);
        }
        if (ok) break;
      }
      if (bestMiss >= T.vineGrabRadius) {
        problems.push(`${entry.name}: the vine at x${v.ax} can't be caught — the best jump off ` +
                      `any ledge misses its end by ${Math.round(bestMiss)}px (needs ${T.vineGrabRadius})`);
      } else if (!ok) {
        problems.push(`${entry.name}: the vine at x${v.ax} can be caught but no release lands on ` +
                      `the far side at x${landing.x} — the best throw reaches x${Math.round(reachedX)}`);
      }
      // nothing may hang over the swing: a knock mid-arc is an unavoidable fall
      const gapFrom = ledges[0].x + ledges[0].w, gapTo = landing.x;
      L.enemies.forEach(e => {
        const S = CREATURES[e.species];
        if (!S || S.move !== 'swing') return;
        const sweep = Math.sin(TUNING.enemies.monkeySwingArc) * e.len;
        if (e.ax + sweep > gapFrom && e.ax - sweep < gapTo) {
          problems.push(`${entry.name}: the ${S.label} at x${e.ax} swings over the vine gap ` +
                        `(${Math.round(gapFrom)}–${gapTo})`);
        }
      });
    });
    // MOVER CLEARANCE. A moving platform that sweeps through a spot where Dex
    // can stand will shove him off it, which feels like the game cheating.
    L.movers.forEach(m => {
      const swept = { x: m.cx - m.rangeX - m.w / 2, y: m.cy - m.rangeY,
                      w: m.rangeX * 2 + m.w, h: m.rangeY * 2 + m.h };
      surfaces.forEach(S => {
        const stand = { x: S.x, y: S.y - PH, w: S.w, h: PH };
        const gap = 2;
        if (swept.x < stand.x + stand.w - gap && swept.x + swept.w > stand.x + gap &&
            swept.y < stand.y + stand.h - gap && swept.y + swept.h > stand.y + gap) {
          problems.push(`${entry.name}: the mover at x${m.cx} sweeps through where ` +
                        `Dex stands on the surface at x${S.x} y${S.y}`);
        }
      });
    });
    // nothing may threaten the run-in to the Star Portal
    const P = L.portal.x;
    (L.geysers || []).forEach(g => {
      if (g.x > P - 60) problems.push(`${entry.name}: geyser at ${g.x} is on the portal`);
    });
    (L.falls || []).forEach(f => {
      if (f.x > P - 60) problems.push(`${entry.name}: lava fall at ${f.x} is on the portal`);
    });
    (L.slimes || []).forEach(sl => {
      if (sl.x + sl.w > P - 60) problems.push(`${entry.name}: slime at ${sl.x} is on the portal run-in`);
    });
    (L.floods || []).forEach(fl => {
      if (fl.x2 > P - 60) problems.push(`${entry.name}: rising slime reaches the portal run-in`);
    });
  });
  return problems;
}
function renderDebugPanel() {
  if (!dbgStats) return;
  const q = game.stats.questions;
  dbgStats.textContent =
    `state       ${game.state}\n` +
    `pos         ${player.x.toFixed(0)}, ${player.y.toFixed(0)}  vx ${player.vx.toFixed(0)} vy ${player.vy.toFixed(0)}\n` +
    `checkpoint  ${game.checkpoint} / ${LEVEL.checkpoints.length - 1}\n` +
    `zaps        ${game.deaths}  by section [${game.sectionDeaths.join(', ')}]\n` +
    `assist      L${game.assistLevel}` +
    (game.localZone ? `  local zone @${game.localZone.x.toFixed(0)}` : '') + `\n` +
    `power       ${power.id || 'none'} ${power.charges}/${power.id ? POWERUPS[power.id].max : 0}` +
    (slowT > 0 ? `  slow ${slowT.toFixed(1)}s` : '') + `\n` +
    `questions   ${q} shown, ${game.stats.firstTry} first-try, ` +
    `${game.stats.wrongAttempts} wrong attempts\n` +
    `run         ⭐${game.crystals}/${game.totalCrystals}  cures ${game.cures}  secrets ${game.secrets}  invuln ${Math.max(0, game.invuln).toFixed(1)}s\n` +
    `save        bank ${save.crystalsBank}  rescued ${save.ratsRescued}  wins ${save.completions}\n` +
    `            blueprints [${POWERUP_ORDER.filter(i => save.blueprints[i]).join(',')}]  built [${POWERUP_ORDER.filter(i => save.built[i]).join(',')}]`;
}

// Diagnostics handle (also used by automated tests): window.NQ
window.NQ = { game, player, TUNING, TREEHOUSE, POWERUPS, CREATURES, LEVELS, THEMES,
              get LEVEL() { return LEVEL; }, get levelIndex() { return levelIndex; },
              get camY() { return camY; }, get boss() { return boss; },
              loadLevel, levelUnlocked, openLevelPicker, checkLevels,
              input, MathQuiz, quizTest,
              forceDeath, debugCheckpoint, activatePower, treehouseInteract, power,
              get save() { return save; }, get camX() { return camX; },
              get bolts() { return bolts; },
              intro, startIntro, skipIntro, advanceIntro,
              persist, resetSave, beginAdventure, enterTreehouse, startOutro, OUTRO_SCENES,
  LIVES, awardCrystals, gameOver, restartAdventure };

/* ---- main loop ---- */
rebuildProgressTicks();
applySettings();

// Test shortcut: index.html?level=2 drops you straight into that level,
// skipping the title, story and treehouse. Handy for trying a new level
// without replaying everything before it. ?level=2&debug=1 adds the dev panel.
// Add &cp=3 to start from a checkpoint (1 = the level start) instead of the
// very beginning — a set piece two thirds of the way in is otherwise a long
// walk every time you want to look at it.
(() => {
  const m = /[?&]level=(\d+)/.exec(location.search);
  if (!m) return;
  const i = clamp(parseInt(m[1], 10) - 1, 0, LEVELS.length - 1);
  if (!LEVELS[i].build) { toast(`Level ${i + 1} isn't built yet!`); return; }
  save.introSeen = true;
  AudioSys.ensure();
  beginAdventure(i);
  const c = /[?&]cp=(\d+)/.exec(location.search);
  if (c) {
    game.checkpoint = clamp(parseInt(c[1], 10) - 1, 0, LEVEL.checkpoints.length - 1);
    placeAtCheckpoint();
    game.maxX = Math.max(game.maxX, player.x);
    updateHud();
    toast(`🧪 Test mode: ${LEVELS[i].name} — checkpoint ${game.checkpoint + 1}`);
  } else {
    toast(`🧪 Test mode: ${LEVELS[i].name}`);
  }
})();

let last = performance.now();
// An exception anywhere in here used to escape the function, so the
// requestAnimationFrame at the bottom never ran and the game locked solid --
// which is exactly how a missing sfx.stomp() presented: "seems like it froze".
// A child playing alone cannot recover from that, so the loop now always
// re-arms itself. The first few failures are logged so the bug is still
// findable; after that it stays quiet rather than flooding the console.
// Anything thrown outside the frame loop — a setTimeout, an event handler —
// would otherwise disappear without trace. The ending is built on a timeout,
// and a silent failure there is a child staring at a frozen screen.
let looseErrors = 0;
window.addEventListener('error', e => {
  if (++looseErrors <= 5) console.error('uncaught #' + looseErrors, e.error || e.message);
});
window.addEventListener('unhandledrejection', e => {
  if (++looseErrors <= 5) console.error('unhandled promise #' + looseErrors, e.reason);
});
let frameErrors = 0;
function frame(now) {
  try {
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    // dev-only: ?debug=1. A level-skip bar is the first thing a child presses.
    ui.testJump.classList.toggle('hidden', !DEBUG_MODE || game.state !== 'title');
    if (game.state === 'playing') update(dt);
    else if (game.state === 'dying') { game.time += dt; updateDying(dt); }
    else if (game.state === 'treehouse') updateTreehouse(dt);
    else if (game.state === 'intro') updateIntro(dt);
    if (fadeAlpha > 0 && game.state !== 'dying') fadeAlpha = Math.max(0, fadeAlpha - dt * 2.2);
    // The screen shake decays inside the per-state updaters, and states like
    // victory, paused, gameover and math have no updater at all. addShake(4)
    // in win() therefore stuck at 4 for as long as the card was up, and
    // render() kept jittering a frozen world by a random +-4px every frame.
    // Behind an overlay nothing is moving, so a shake is never anything but
    // noise: clear it outright rather than decaying it.
    if (game.state !== 'playing' && game.state !== 'dying' &&
        game.state !== 'treehouse' && game.state !== 'intro') shakeMag = 0;
    render();
    if (DEBUG_MODE) renderDebugPanel();
  } catch (err) {
    if (++frameErrors <= 5) console.error('frame error #' + frameErrors, err);
  }
  requestAnimationFrame(frame);
}
updateMuteIcons();
updateHud();
requestAnimationFrame(frame);
