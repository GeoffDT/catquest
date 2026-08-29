# DexQuest — Dex the Cat and the Star Portal

> **Continuing work on this?** Read **`HANDOVER.md`** first — it holds the
> decisions, design rules and already-fixed bugs that this file doesn't.

An original 2D platformer for ~8-year-olds. Unlimited lives, one
friendly maths question (UK Year 3 level) after every zap — plus a walkable
Treehouse hub, curable Glitch Rats, power-ups built with maths, and an animated
opening story.

**Glitch Rat variants** (14 rats in the level — every ground enemy is a rat):
normal rats (bounce to cure), **Ember Rats** that puff up then breathe a short
cone of glitch-fire (wait for calm, then bounce — the flame zaps but their backs
stay safe), and **Spike Rats** with crystal spikes that can never be bounced —
dodge them or cure them with the Cure Pulse. Two gentle normal rats sit in the
opening stretch with their own signs, to teach bouncing before it matters.
**Glitch Mosquitoes** buzz overhead as the only non-rat corrupted creature —
bounce them to cure them too.
Tuning knobs in `TUNING.enemies` (`emberCycleS`, `emberWarmupS`, `emberBreathS`,
`emberRangePx`, `spikeSpeedMult`).

## The story (opening cinematic)

Deep under peaceful **Greenhaven**, vain **King Ratthew the Third** discovered
the Gamma Crown — it made him **50× bigger**, turned his followers into
radioactive **Glitch Rats**, and began corrupting the land. He kidnapped
**Nova**, Dex's girlfriend and the brilliant inventor whose power-ups can
reverse the corruption — but as she was grabbed she launched her power-up plans
across Greenhaven for **Dex** to find. Cure the rats. Rescue Nova. Stop the King.

The ~25-second in-engine cinematic plays automatically the first time a player
presses Start (recorded as `introSeen` in the save). It can be skipped at any
moment (Skip button or Esc), advanced beat-by-beat (tap / Enter / Space), pauses
when the tab loses focus, respects mute and Gentle-effects settings, and can be
rewatched any time — **📖 Replay the story** on the title screen, or **📖 Watch
the story again** in the ⚙ settings panel from inside the treehouse — without
touching any saved progress. Resetting progress returns you to the title screen,
so the next Start replays the story exactly as a brand-new player would see it.
Scenes, captions and sound cues are defined in the `INTRO_SCENES` config in
`game.js`.

## Playing on an iPad

DexQuest is built to be played on a tablet, not merely to survive on one:

- **Landscape 16:9**, filling the screen. Held upright it asks for a turn
  rather than serving a squashed strip.
- **Touch pads** bottom-left and bottom-right, big enough for small thumbs.
  They are multi-touch: hold *right* and tap *jump* at the same time, which is
  most of the game.
- **Safe-area insets**, so nothing sits under the home indicator or the
  rounded screen corners.
- **Retina rendering** — the canvas buffer matches the device pixel ratio (up
  to 2.5x) while all game code keeps drawing in plain 960x540 coordinates.
- **No bounce, no zoom, no text selection.** A thumb sliding off a control
  mid-jump cannot scroll or select the page.

### The icon

`icon-180.png` is generated, not hand-made — run `node tools/make-icon.js` to
rebuild it. It draws Dex on a Greenhaven hill using only Node’s built-in zlib,
so there is nothing to install and the icon has an actual source. Edit the
shapes in that script rather than the PNG.

### Add it to her Home Screen

This is the step worth doing. In Safari: **Share → Add to Home Screen**.
DexQuest then launches **full screen with no Safari chrome** and its own Dex
icon — it behaves like an app rather than a web page. That needs HTTPS, which
GitHub Pages provides.

## Publishing it (GitHub Pages)

> The game is **DexQuest**; the repository and the github.io URL are still
> `catquest`, from before the rename. That is deliberate — they are addresses,
> not names, and changing them would break the link that is already out there.
> The custom domain `dexquest.co.uk` is what people will actually see.

The folder is a self-contained static site — no build step, no dependencies.
It is already a git repository with one commit and **no remote**; it is
entirely standalone and shares nothing with any other project.

Create an empty repo on GitHub called `catquest` (no README, no .gitignore),
then:

```bash
git -C "C:/Projects/NumberQuest" remote add origin https://github.com/YOURNAME/catquest.git
git -C "C:/Projects/NumberQuest" branch -M main
git -C "C:/Projects/NumberQuest" push -u origin main
```

Then on GitHub: **Settings → Pages → Source: Deploy from a branch →
`main` / `(root)`**. A minute later it is live at
`https://YOURNAME.github.io/catquest/`.

To publish later changes:

```bash
git -C "C:/Projects/NumberQuest" add -A && git -C "C:/Projects/NumberQuest" commit -m "what changed" && git -C "C:/Projects/NumberQuest" push
```

Every path in the page is relative, so it works from a subfolder URL. `game.js`
is loaded with a `?v=` cache-buster, so a republished game is never served
stale — at the cost of re-downloading it each visit, which is the right trade
for a small file on home wifi.

## Running it

No build, no dependencies. Two options:

1. **Just open `index.html`** in any modern browser.
2. Or serve the folder: `python -m http.server 8471 --directory C:/Projects/NumberQuest`
   then open <http://localhost:8471>.

Progress (power-ups, rescued rats, crystals, settings, best time) is saved in
the browser's localStorage only — no accounts, no personal data.

## Controls

| Action | Keys | Touch |
|---|---|---|
| Run | ← → or A / D | ◀ ▶ buttons |
| Jump (hold = higher) | Space, W or ↑ | JUMP button |
| Use power-up | E or X | power button (shows its icon) |
| Pause | P or Esc | ⏸ button |
| Answer maths | click, or keys 1–4 | tap |

## Game loop

The treehouse is a **walkable room**, drawn in its own coordinate space
(768×432) and scaled up 1.25× so Dex and the furniture read big and cosy. It
holds **Nova's workshop** (a pegboard and workbench with four build slots),
**Nova's desk** (her goggles, a half-finished invention still sparking, a mug),
a **mission board** (Cure the rats / Rescue Nova / Stop the King — the last two
clearly marked as story goals, not playable yet), a window with a shaft of
daylight, a hanging lamp, and an **open doorway onto Greenhaven** as the way
out. Rescued rats potter about the floor. Walk to a bench or the doorway and
press **E**. Only the floor is solid, so furniture can never block the walk —
spawn to doorway is about 2 seconds.

Settings (sound, gentle effects, reset progress) live behind the **⚙ button**,
which only appears in the treehouse — reset is two-step and well away from a
child's reach mid-play.

The room visibly earns its decoration: string lights at 30 banked crystals, a
rug at 50, a plant at 80, flowers on Nova's desk at 5 rescues, cheese at 12,
a trophy per completion above the door, a gold trim on the pegboard once all
four power-ups are built, and a shimmer in the doorway once Dex has reached the
Star Portal at least once.

Adventure → cure Glitch Rats (bounce on top) → get zapped → answer one maths
question → respawn (and recharge your power-up) → reach the Star Portal to win
**one new power-up** → back in the treehouse, stand at its bench and **answer a
maths question to build it** → equip it → next adventure.

**Dex can take one hit.** The first hit shrinks him — no maths question, no
death, he just gets visibly smaller and the HUD shows 🤍 — and the *next* hit
zaps him into the maths screen. Once small he **stays** small: checkpoints do
not restore his size, so the only fresh start at full size is respawning after a
zap. Tuned by `TUNING.player.smallScale` and `shrinkInvulnMs`.

## Adding levels, scenery and creatures

The game is built around three registries near the top of `game.js`, so new
content is data, not engine work:

- **`LEVELS`** — one entry per adventure (`name`, `icon`, `blurb`, `build`).
  Test shortcut: `index.html?level=4` drops straight into a level, and `&cp=3`
starts from that checkpoint (1 = the level start) — handy for a set piece that
sits well into a level, like Glow City's rising slime at 61%.

A `null` build shows as "coming soon" in the picker. A level opens once the
  one before it is finished, and its **first** clear hands over
  `POWERUP_ORDER[index]`.
- **`THEMES`** — everything that makes a level *look* like somewhere: four
  colour moods it drifts through, a `backdrop()` function, and ground/platform
  colours. `canyon` and `sewer` are built. A level names one in its `theme`.
- **`CREATURES`** — one entry per species (`move: 'walk' | 'fly' | 'swing'`, `stompable`,
  size, speed, `shoots`). Levels spawn them with `CREATURE('monkey', x1, x2, y)`,
  so each level can have its own cast. Adding a species means adding an entry
  and a draw function.

### The levels

| # | Level | Setting | Cast |
|---|---|---|---|
| 1 | Crystal Canyon | Meadows and crystal cliffs | Glitch Rats, Ember Rats, Spike Rats, Mosquitoes |
| 2 | Tangle Jungle | Canopy, vines, shafts of green light | Vine-swinging Glitch Monkeys throwing bananas, mixed with rats — plus two gaps only a vine swing will cross |
| 3 | Ember Volcano | Ash, basalt, a lava river below | Blaze / Ember / Magma Rats, Spike Rat, Mosquitoes + lava geysers & big lava waterfalls |
| 4 | Glow City | Tower blocks, neon, green haze at street level | Glow Rats (two bounces each), Glitch Rats, Mosquitoes + slime pools and **two** streets that flood |
| 5 | The Rat King's Sewer | Brick tunnels, pipes, murky water | Sewer Rats, Bloat Rats, Mosquitoes — and King Ratthew III |

**Lava geysers** (`GEYSER(x, y, phase)`) rest, bubble for `geyserWarnS` as a
clear warning, then erupt upward for `geyserEruptS`. Safe roughly 70% of the
time. **Lava waterfalls** (`FALL(x, top, bottom, phase)`) pour from a lip and
ease off between surges, swelling visibly at the lip before each one — a
horizontal dash to time, where geysers are a vertical one to stand clear of.
**Blaze Rats** run hot and fast with flames streaming off their backs; their
heads stay clear, so bouncing on one puts the fire out and cures it. **Magma
Rats** prowl, rear up with a glowing mouth, then spit an arcing fireball — jump
the fire, then bounce the rat. Fourteen fire-rats in all.

**Glitch Monkeys** hang from vines in the canopy and swing to and fro like
pendulums. When Dex comes near, one winds up for `monkeyWarmupS` — banana
cocked back in a raised paw — and lobs it in an arc. Bananas are affected by
gravity, so they're easy to read and easy to duck under, and they splat on
anything solid. Bounce a monkey as it swings low and it's cured: it lets go of
the vine, drops to the ground and scampers off.

They only wake when Dex is genuinely near, so nothing is ever thrown at you
from off-screen, and arriving always gives you a full cycle to spot them.
Tuning: `monkeySwingOmega`, `monkeySwingArc`, `monkeyCycleS`, `monkeyWarmupS`,
`bananaSpeedPx`, `bananaLobPx`, `bananaGravity`, `bananaRangePx`.

Placed with `MONKEY(anchorX, anchorY, vineLength, phase)`. The **check levels**
validator confirms a swinging monkey's whole arc stays clear of platforms.

**Dex's own vines** (`VINE(anchorX, anchorY, length)`) hang in the jungle over
gaps far too wide to jump. **Jump catches the vine, jump lets go** — one button,
because the controls are only ever left, right and jump. He swings as a real
pendulum: the speed he arrives with becomes swing speed, and letting go throws
him along the tangent, so releasing near the top of the forward swing sends him
furthest. Let go too early or too late and he lands in the gap.

**Glow Rats** are the big ones: half again the size of a Glitch Rat, slow, and
they take **two** bounces. The first knocks the glow out of them — they shrink,
flash white and the halo dims — and the second cures them. **Toxic slime**
(`SLIME(x, w, y)`) is a permanent bubbling pool: green always means jump.

**Rising slime** (`FLOOD(x1, x2, startY, topY)`) is Glow City's set piece and
the one thing no other level does. There are **two** of them, back to back,
making up the middle of the level: the first at 21% of the way in, the second
at 40%, with a dry rooftop and a checkpoint between them. It sits out of sight in the gutter until Dex
steps into the zone, then climbs at `floodRisePx` while he is inside it and
drains back down twice as fast the moment he is clear — so a retry always starts
from the bottom, and `placeAtCheckpoint()` resets it outright. The street simply
ends there: the only way on is up a fire escape, and the steps are deliberately
sized by one rule: a landing step is at least `166 - gap + 40` wide, so a
full-power jump from the previous edge always lands. Gaps widen and steps
narrow as you climb — harder to look at, but every jump is the same jump, so
the challenge stays *pace* rather than guessing how hard to press. It tapers back to its resting level over the last 130px at each
end, so it never ends in a sheer wall of green — and the hazard test follows the
same tapered surface, so what you see is exactly what can hurt you.

**The slide** opens Level 5: one continuous 2,450px descent down the storm
drain, with the camera following Dex down — the only place in the game where it
moves vertically. Space sets him off, space jumps, and that one button means
two opposite things: jump **over** the rats and the holes, and **don't** jump
under the mosquito swarms. Land on a rat's head and it's cured. His speed comes
entirely from the gradient, so the chute's steeper and gentler stretches are
its pacing. Authored with `chuteFromGrades(x, y, [[length, gradient], …])`,
then `.rat(x)`, `.swarm(x)`, `.gap(a, b)` and `.exitTo(x, y)`.

**King Ratthew** takes five hits to his crown, and the fight is one loop: he
blasts the ceiling, rock rains down — every piece shadowed on the floor before
and while it falls — you dodge through it, climb one of the two ledges either
side of the arena, and jump on his head. Landing on his crown always counts,
whatever he happens to be doing, and he shrinks with every jewel you knock
loose.

He fights back with green beams from his eyes — always a dashed sighting line
and a charging eye first — and every so often he throws his head back and
fires at the ceiling instead, bringing rocks down on you. Nova calls every step
of it from her cage, and throws Dex her Spring Boots on the way in. He shrinks
with every hit.
He ends up **cured**, not beaten — and Nova's cage is locked with the only
two-step maths question in the game.

Levels are authored with `levelKit()`, which provides `G` (ground), `F`
(platform), `CR` (crumbling), `MV` (moving), `SP` (spikes), `RAT`, `MOZZIE`,
`CREATURE`, `C` (crystal), `CACHE`, `SIGN`, `SH` (corruption shard),
`EMIT` (particle emitter), `GEYSER`, `FALL`, `SLIME`, `FLOOD`, `VINE` and
`CHUTE`, then
`finish({ theme, width, sections, checkpoints, portal, helper })`.

## The ending

Freeing Nova plays a five-scene closing cinematic (~31s, skippable with the
Skip button or Esc, tap or Enter to move on), then the victory card.

It runs on the **same engine as the opening**: `startCinema(scenes, onDone)`
drives either script, so `OUTRO_SCENES` gets the scene timing, captions,
speaker frames, music patterns, soft wipes, pause and skip for free. The only
difference between the two is what starts them and what happens after.

The five scenes deliberately answer the five the opening asked:

| Opening | Ending |
| --- | --- |
| He kidnapped Nova | The cage opens and she walks out |
| The crown made him fifty times bigger | The crown is in pieces; he is his own size |
| An army of radioactive rats | The glitch fades; they were only ever rats |
| He will drain Greenhaven | The green comes back, brighter |
| Nova left Dex everything he needs | Home, at sunset — THE END |

**If you add a scene, close something the opening opened.** That is what makes
it feel finished rather than just long.

Two rules the ending must keep: **King Ratthew is cured, not beaten** — so he
is at the treehouse in the final scene, invited, not punished — and no text a
child reads ever says died or killed.

`win()` banks and persists the run *before* handing over to the cinematic, so
wandering off during the ending never costs the completion.

## Crystal geodes — the catapults of Crystal Canyon

Level 1 is a **flying** level. It is 18,400px of five islands separated by open
canyon, and the only way from one island to the next is a crystal geode: touch
it and Dex is thrown up and out on a long arc.

| | |
| --- | --- |
| Time in the air | **3.0 seconds** |
| Height of the arc | 336px above the launch |
| Distance | 1,477px (leaning back) → 2,243px (leaning forward) |

Lean `◀ ▶` in the air to stretch or shorten the throw — she cannot turn round
or stop, only choose where along the island she comes down. A trail of five
crystals follows the *unleaned* line of each arc, so flying straight and true
is the rewarded shot and leaning is a real choice.

Author one with `PAD(x)`, or `PAD(x, surfaceY)` to stand it on a platform.

Three things about them are deliberate:

- **They are a touch volume, not a platform** (`LEVEL.pads`, not
  `LEVEL.solids`). An earlier version was solid and running into the side of
  one just stopped Dex dead — a shiny crystal that blocks you reads as a wall.
  Any contact now launches, and a geode can never block or trap.
- **The trigger column is 130px tall against 30px of visible crystal.** A
  geode is the only way across the canyon behind it, so a 131px jump must not
  be able to clear it and drop her in the void.
- **Flight has its own gravity** (`catapultGravity: 300` against the normal
  2200). Three seconds of hang time under normal gravity would need a 2,475px
  apex — four screens up, with Dex off the top of the screen for most of it.
  The low gravity *is* the flying feeling.

`checkLevels()` flies every geode three ways — full back lean, no lean, full
forward lean — and rejects any arc that clips scenery, lands on spikes or
falls out of the world. **Retuning the arc means re-running the validator:**
each landing island is sized to the 766px window between the shortest and
longest flight.
## Spare lives

Dex starts with **nine** spare lives, shown in the HUD as `🐱 × 9`. They are
*world* state, not level state: they carry from level to level, through the
treehouse, and across a page reload. (The `❤️` next to them is something
else — it shows whether Dex is full-size or has been shrunk by a hit.)

| Event | Effect |
| --- | --- |
| Zapped | −1 life, then respawn at the last checkpoint (crystals and time kept) |
| Finishing a level | costs nothing |
| Every 25 crystals collected | +1 spare life |
| Reaching 0 | Game Over screen; "Try again" restores all nine |

Lives can never go negative and never exceed `LIVES.max`. Everything is tuned
in the `LIVES` block at the top of `game.js`:

```js
const LIVES = {
  start: 9,
  crystalsPerExtra: 25,
  max: 99,
  restartLevelOnDeath: false,  // true → restart the whole level instead (do not)
};
```

Every crystal pickup in the game routes through `awardCrystals(n)`, so the
"one life per 25" rule has a single home and cannot drift out of step with the
counter. Lives are spent in `spendLife()` and nowhere else.

## Power-ups & how they're earned (deterministic, no randomness)

Dex starts with **nothing**. Clearing a level for the first time unlocks exactly
**one** new power-up — the one matched to that level — so the reward is always a
single clear, named thing, and replaying never muddles it. It then has to be **built in the workshop by answering one
maths question** at its bench:

| Power-up | How it works | Unlocked by |
|---|---|---|
| 🫧 Bubble Shield | Passively absorbs one enemy/hazard hit | First clear of Level 1 |
| 🥾 Spring Boots | A double jump — press jump again in mid-air for exactly twice a normal jump height. Refreshes the moment he lands, so it is always there | First clear of Level 2 |
| ⏳ Time Bubble | Freezes everything except Dex for 5 seconds | First clear of Level 3 |
| 💜 Cure Pulse | Cures one nearby Glitch creature (E/X) | First clear of Level 4 |

The two hidden spots in the level (the optional high platform in section 2 and
the secret area above section 3's steps) now hold **crystal caches** worth
`TUNING.powerups.cacheCrystals` each, so exploring still pays without muddling
the power-up reward.

Max one charge each; a correct maths answer after a zap restores it (or gives 3
bonus crystals if full / none equipped). The level is fully completable with no
power-up — the first run is always bare-pawed.

## Testing a level without playing the ones before it

- **The 🧪 TEST bar on the title screen** — one button per built level; click it
  to drop straight into that level. This is the easy one, and it's marked
  TEMPORARY: delete the `#testJump` block in `index.html` and the matching
  wiring in `game.js` when the game ships.
- **`index.html?level=2`** — the same jump, from a URL. Any level number works;
  a level that isn't built yet just says so.
- **`index.html?debug=1`** — unlocks every built level in the treehouse picker,
  so you can pick any of them in any order, and adds the developer panel.
- The two URL forms combine: **`index.html?level=2&debug=1`**.

None of these grant progress — jumping into a level leaves saved completions
and power-ups exactly as they were.

`game.js` is loaded with a cache-busting timestamp, so an edited file is never
served stale during development.

## Developer / debug mode

Two switches, deliberately separate:

| URL | What you get |
| --- | --- |
| plain address | the game, nothing else — this is what a child gets |
| `?test=1` | the 🧪 TEST level-skip bar and every level unlocked |
| `?debug=1` | all of the above **plus** the diagnostics panel, hitbox outlines and debug keys |

Use `?test=1` to jump straight to a level without the black panel in the corner.


Open `index.html?debug=1` (or set `DEBUG_MODE = true` in `game.js`). Shows
position, checkpoint, zaps per section, assist level, power/charges, questions
and first-try stats, save summary, collision boxes; buttons/keys for force zap
(T), checkpoint teleport ([ / ]), +charge, unlock-all, and a 300-question
maths-generator self-test.

## Tuning after real child play-testing

Everything lives in the `TUNING` object at the top of `game.js`:

- **Too many zaps** → lower `enemies.ratSpeed` / `mozzieOmega`, raise `player.coyoteMs`,
  lengthen `enemies.warnMs` (the Glitch Rat "!" telegraph).
- **Too few zaps (target 3–5)** → raise enemy speeds, shorten `platforms.crumbleShakeMs`,
  or reduce `powerups.timeDurationS` / `timeSlowFactor`'s strength (raise toward 1).
- **Assist timing** → `assist.level1Deaths` / `level2Deaths` and the `SpeedMult`s;
  `assist.localDeaths` / `localRadius` control the same-obstacle helper.
- **Power-up strength** → `powerups.bootsJumpVel`, `pulseRadius`, `shieldInvulnMs`,
  `fullChargeBonusCrystals`.
- **Spawn safety** → `player.spawnProtectionMs`, `assist.level2SpawnProtectionMs`.

**Checkpoints** live in each level's `checkpoints` array — 4 per level (a start
plus 3 flags, at roughly 25%, 55% and 80%). Each carries an `x` and the `y` of
the surface it stands on, so a checkpoint can sit on a ledge as well as on the
ground. The progress bar's tick marks are generated from this array, so adding
or moving a checkpoint updates the bar automatically. Any new one must be on
solid footing and clear of enemy patrols, Ember flames and Monkey bolt range.

**Validate a level after editing it** with the debug panel's **check levels**
button (or `NQ.checkLevels()` in the console). It reports creatures walking on
thin air, jumps wider than Dex can clear, and checkpoints that aren't on solid
footing — the exact class of mistake that put a monkey in mid-air in the jungle.
It also checks that no checkpoint sits in a lava fall, a geyser, a slime pool, a
rising-slime zone or any ranged attacker's reach; that nothing threatens the
run-in to the Star Portal; and that every rising-slime zone actually rises and
has a platform above the high-water mark that carries you out past its far edge.
Three more rules cover the feel of a jump rather than its possibility: nothing
solid may hang within Dex's 131px jump height over the run-up to a ledge (unless
everything ahead is lower, in which case he can walk off and drop); no moving
platform may sweep through a space where he can stand; and any platform the
route would fall apart without must sit within a jump of something below it.

The debug panel's per-section zap counts are the data to watch while a child
plays: intended curve is 0–1 in sections 1–2, 1–2 in section 3, 2–3 in section 4.

*The 3–5 zap average is a design target supported by this tuning, the telegraphs
and the adaptive assistance — it has not been validated with real child
play-testing yet.*

`v1_backup/` holds the pre-improvement version.
