# CatQuest — working handover

**Purpose of this file.** Code survives a context reset; *intent* doesn't. This
is the continuation brief: decisions Sean has made, rules that came out of
play-testing, bugs already paid for, and what's next. Read this first, then
`README.md` (how the game works), then the code.

**Convention: update this file whenever a decision is made or a bug is fixed** —
in the same edit as the code change, not later. Sections 3, 6 and 8 are the ones
that actually matter after a reset.

---

## 1. Orientation

| | |
|---|---|
| Location | `C:\Projects\NumberQuest` — deliberately NOT inside the Geoff repo |
| Run | double-click `index.html`, or `python -m http.server 8471 --directory C:/Projects/NumberQuest` |
| Files | `index.html` (overlays, CSS), `game.js` (everything else), `README.md`, this file |
| Backups | `v1_backup/`, `v3_backup/` |
| Audience | Sean's daughter, ~8 years old, UK Year 3 maths |

**Sean plays in his own browser, never the Claude preview pane** — the pane has a
click-offset bug and steals keyboard focus. Always hand him a plain URL, never
one with `?debug=1`.

---

## 2. Cast and story (locked — do not rename)

- **Dex** — the player, a cat. Was "Pip"; fully renamed. No "Pip" should exist.
- **Nova** — Dex's girlfriend, brilliant inventor, creator of the power-ups,
  kidnapped. Must always read as *active and clever*, never a passive prize.
- **King Ratthew the Third** — vain, theatrical, funny cartoon villain. Found the
  Gamma Crown, grew 50x, corrupted the animals into Glitch creatures.
- **Greenhaven** — the world.

**Language rule:** never "died", "killed" or "death" in anything a child sees.
It is "**zapped**". The internal `game.deaths` counter keeps its name for
analytics — that's deliberate and fine.

---

## 3. Sean's decisions (most easily lost — respect these)

**The ending (27 Aug 2026).** Sean: *"after dex saves nova we need some kind of
ending story/graphics which brings satisfaction."* There is now a five-scene
closing cinematic, about 31 seconds, skippable, that plays after the cage opens
and before the victory card.

It is built to answer the opening thread for thread — the crown, the fifty-
times-bigger king, the army of glitched rats, the drained land, and Nova — and
then stop. **If you add a scene, it should close something the opening opened.**
That constraint is the whole reason the ending feels finished rather than
merely long.

Two of Sean's standing rules shape it and must survive any rewrite: the King is
**cured, never beaten**, so the ending has to give him somewhere to go (he is
at the treehouse in the last scene, invited); and nothing a child reads ever
says died or killed.

**Order matters: the run is banked BEFORE the cinematic plays.** `win()` does
all its persisting, then hands to `startOutro()` and returns; `finishOutro()`
reveals the victory card. A child who wanders off during a 31-second ending
still keeps her completion.

**Crystal Canyon is a flying level (27 Aug 2026).** Sean asked whether level 1
was boring; it was, because it was the only level with no mechanic of its own.
It now has one, and the level is built entirely around it: **18,400px of five
islands separated by open canyon, and the only way between them is a crystal
geode that throws Dex on a three-second arc.**

The arc, all of it from `TUNING.player`: **3.0s aloft, 336px apex, and
1,477–2,243px of distance** depending on how she leans. Flight has its own
gravity (300, against the normal 2200) and that is not a fudge — three seconds
of hang time at 2200 would need a 2,475px apex, four screens above the canyon,
with Dex invisible for most of it.

**Do not retune the arc without re-running `checkLevels()`.** Every landing
island is sized to the 766px window between the shortest and longest arc.
Change `catapultVx`, `catapultSteer` or the lean limits and the islands are
the wrong size — silently, until a child lands in a canyon.

**Crystal Canyon's toy is the geode (added 27 Aug 2026).** Sean asked whether
level 1 was boring. It was — not because it was easy, but because it was the
only level with no mechanic of its own, and its tutorial ran for a quarter of
its length (seven signs in the first 2,400px). Fixed by giving it crystal
geodes — land on or touch one and it throws Dex ~285px, a bit over twice his
own 131px jump — and cutting section 1 from seven signs to three.

**No geode gates the route.** In the level that teaches the game, the new toy
is a reward for spotting it, never a toll on getting past. That is why the
reachability validator needed no changes: every platform is still reachable
on a normal jump.

**Spare lives (added 27 Aug 2026).** Nine to start, shared across the whole
world rather than reset per level, one spent per zap, a Game Over at zero that
restores nine, and one spare earned per 25 crystals collected. All of it is in
`save`, tuned by the `LIVES` block at the top of `game.js`.

**Checkpoints are untouchable — they behave exactly as they always have.** The
lives brief said "restart the current level after losing a life", which was
built literally for about an hour. It voids every checkpoint in the level, and
Sean hit it in Crystal Canyon immediately: *"the check points are not working
correctly — i am being sent back to the start each time"*, then *"checkpoints
should stay how they are meant to be"*. A zap now costs a life AND respawns at
the last flag, keeping crystals and level time. `LIVES.restartLevelOnDeath` is
`false` and should stay that way.

- **Sean picks the level settings and creature mixes.** Do not invent themes.
- **One power-up per level**, awarded on *first clear*, named clearly on the
  victory screen along with what it does. Never a pile of unlabelled icons —
  that was a real complaint.
- Call them **power-ups**, never "blueprints".
- **Dex takes one hit**: the first shrinks him — **no maths question, no death
  counted** — and the second zaps him into the maths screen.
- **Checkpoints do NOT restore his size.** Only a fresh start after a zap does.
- **4 checkpoints per level.** History: 4 → daughter asked for more → 8 → Sean
  said too many → back to 4. If it comes up again, 5–6 is the compromise.
- **Spike Rats keep getting cut, and that is a pattern not a coincidence.**
  They are the one creature you cannot bounce, so they are pure avoidance in
  a game whose whole answer to danger is "jump on it". Sean has now removed
  them from the Canyon portal run-in, the Jungle portal run-in, and the
  stretch after the first vine swing ("makes things too difficult"). Do not
  place another one without asking him first.
- **Every ground enemy is a rat**, or a themed creature Sean chose. The old
  spikeshell slug was deleted as "not a rat". Moths became **mosquitoes**
  ("everyone hates mosquitoes").
- **Nothing may threaten the run-in to the Star Portal.** Sean asked for the
  final rat before the portal to go; both levels had an *unbounceable spike
  rat* parked there (50px clear in Canyon, 120px in Jungle). Removed from
  both, along with a Jungle monkey whose arc swung straight over the portal
  and another whose bananas could still reach it. Keep the last stretch
  clean when editing levels — verify nothing's reach extends to `portal.x`.
- **Dex swings on vines** (Sean's call, after we agreed Level 2 was the level
  with no identity of its own). **Jump grabs, jump lets go** — his choice, and
  the right one: the controls are only ever left, right and jump, so a grab
  button would have been a fourth thing to learn and a fifth touch control.
  The same press can't do both — a grab clears the jump buffer and starts a
  0.14s minimum hold, and letting go starts a 0.3s cooldown.
  He also asked for the gaps to be **relatively punishing**: they are 470px and
  510px, against a 180px jump, so there is no way across but the vine, and both
  a missed grab and a badly-timed release are a fall. See section 8 for the
  measured release windows.
- **Monkeys swing on vines and throw bananas** — not electricity, not walking.
  Sean asked to triple both, then cut the count back 30% when it played too
  hard. Level 2 now has **10** monkeys (2/3/2/3 across the four sections, so
  the opening is gentlest) and `monkeyCycleS` is **1.15s** (was 3.4s). The
  wind-up telegraph shrank to **0.42s** to leave any swing time — **that is
  the next dial to loosen** if it's still too hard, since raising
  `monkeyWarmupS` lengthens the warning without changing the throw rate.

  Measuring difficulty: the auto-runner's death count is **noise** (it jumps on
  a fixed timer, so it dies to gaps, not enemies — 17 deaths both before and
  after a 33% monkey cut). Use the **banana-pressure sweep** instead: walk Dex
  the length of the level invulnerable and count bananas within 300px. At 10
  monkeys that reads **0.38 average, 2 at once, max 2 monkeys awake**.
- **No camera look-ahead.** He disliked the background drifting after Dex stops;
  the camera now settles hard when close to target. Don't reintroduce easing tails.
- **The debug panel must never appear by default.** He asked twice. `?debug=1` only.
- **DO NOT clear his save at the end of a session.** This was in the test
  procedure for months as a courtesy — "so Sean gets a clean start" — and it
  was quietly wiping every power-up he had built. Combined with the TEST bar
  jumping straight into a level and skipping the treehouse, it meant he played
  all the way to the final boss having **never used a single power-up**, which
  is how he put it. Clear the save only when he asks. To get power-ups into a
  test run, set them directly rather than resetting anything:
  `NQ.save.built.boots = true; NQ.save.equipped = 'boots'; NQ.persist()`.
- **The 🧪 TEST bar** is TEMPORARY — marked in both files, delete before
  shipping. It sits *outside* the title panel (pinned to the bottom of the
  game frame, `z-index: 40`) precisely so a panel that doesn't fit can never
  hide it again.
  `index.html?level=4` jumps straight into a level, and **`&cp=3` starts from a
  checkpoint** (1 = the level start). Glow City's rising slime is 61% of the way
  in, so `?level=4&cp=3` is the difference between looking at it and walking to
  it. Sean asked "i dont see rising slime like we discussed?" after playing the
  opening of the level — a set piece he cannot reach in the first minute is a
  set piece he will assume is missing. **Always hand him a URL that lands on
  the thing being discussed.**

---

## 4. Design rules from play-testing

- Every hazard is **telegraphed** before it can hurt you.
- **Ranged enemies only wake when Dex is genuinely near and roughly level with
  them.** Nothing may hit the player from off-screen, and arriving must always
  give a full attack cycle to react.
- **No checkpoint may be reachable by any attack.** Test: respawn there with
  invulnerability at 0 and stand still for 8 seconds.
- No gap wider than ~150px between standable surfaces (Dex's jump reaches ~180px).
- **Head room.** Dex's jump is 131px tall (`jumpVel²/2·gravity`). Nothing solid
  may hang lower than that over the last 80px before a ledge. A platform there
  costs him most of his jump and the gap becomes unmakeable with no visible
  reason — it just feels like the game is broken.
- **Moving platforms must not sweep through anywhere Dex can stand.** He is
  42px tall, so a mover next to ground at y480 needs its top at y≤420, and a
  mover must not pass through the standing space on a ledge it serves. If it
  does, it shoves him off, which reads as the game cheating.
- **A vine crossing is three things in a row, and all three are checked.** The
  jump off the ledge must bring Dex within `vineGrabRadius` of the vine's end;
  the swing must carry him; and the throw when he lets go must land him on the
  far side. `checkLevels()` simulates all three with the same maths the game
  runs — an earlier version only checked the pendulum's reach and wrongly
  failed both vines, because most of the distance comes from the throw.
- **Nothing may swing over a vine gap.** Same rule as the flood staircase: a
  knock mid-arc is a fall you cannot avoid. A monkey had to move for this, and
  another was deleted — a monkey on a vine next to a vine you can grab also
  reads as "which one is mine?".
- **Every platform on the only route must be reachable.** Sean hit a mandatory
  climb of 130px against a 131px jump — technically possible, in practice a
  wall. `checkLevels()` now identifies platforms the route would fall apart
  without (remove it and a >150px gap opens) and requires something within
  `jump - 12` below them. Reward ledges are exempt for free: take one away and
  the route is still there, so they are allowed to be a stretch.
- **Every mover crossing wants room at both ends**: ~25px of clear gap from the
  take-off ledge to the platform's nearest extent, and ~35px of overlap with
  the far ground so you walk off instead of needing a last-frame hop. All four
  levels are now tuned to exactly that.
- Curable creatures must be *reachable to bounce on* from somewhere sensible —
  check against Dex's ~131px jump height from the nearest surface.
- **A cured creature must visibly ESCAPE, not fade out.** Cured mosquitoes used
  to drift up slowly and fade, which Sean read as "it falls/dies — no saving
  it". They now accelerate away off the top of the screen. Mechanically they
  were always being cured; it was purely a readability failure.
- Maths: one question per zap, the *same* question after a wrong answer, hint
  after two wrong, no timer, unlimited tries, correct answer recharges the
  equipped power-up (or gives bonus crystals if full / none equipped).

---

## 5. Architecture map (`game.js`)

Numbered section banners run through the file. The registries near the top are
where new content goes — adding content should not need engine changes.

- **`TUNING`** — every difficulty and game-feel number. All balancing lives here.
- **`POWERUPS`** + `POWERUP_ORDER` — the four power-ups; index N maps to level N.
- **`CREATURES`** — one entry per species: `move: 'walk' | 'fly' | 'swing'`,
  `stompable`, size, speed, `throws`. `spawn()` is generated from the entry.
- **`THEMES`** — a level's entire look: four colour moods, a `backdrop()`, and
  ground/platform colours. Built: `canyon`, `jungle`, `sewer`.
- **`levelKit()`** — authoring vocabulary: `G F CR MV SP RAT MOZZIE MONKEY
  CREATURE C CACHE SIGN SH EMIT`, then
  `finish({ theme, width, sections, checkpoints, portal, helper })`.
- **`LEVELS`** — the registry. `build: null` shows as "coming soon" in the picker.
- Save: key `numberquest_save_v2` (the old name, and it MUST stay — it is the
  address of the only copy of her progress), schema `v: 5`, migrates from v2/v3/v4. Per-level
  `levelDone[]` and `levelBest[]`.

Game states: `title | intro | treehouse | playing | dying | math | paused | victory`.
`window.NQ` is the diagnostics handle used by every test below.

---

## 6. Gotchas already paid for (do not reintroduce)

1. **Sprite draw functions must balance `ctx.save()`/`ctx.restore()`.**
   `drawMozzie` translated without restoring, shoving Dex, Nova and everything
   drawn after it off-screen in the intro's opening scene. Went unnoticed for a
   long time because the scene still "looked fine".
2. **Treehouse furniture must not be solid.** A hop-on chair silently walled off
   the room so Dex could not reach the door. Only the floor is solid now.
3. **Spawn on the door *station* x, not the door graphic.** Landing at the
   graphic's edge made the locked Cure Pulse bench the nearest station, so
   pressing E did nothing useful and level 2 appeared unreachable.
4. **Hidden scrollbars mean overflow clips invisibly.** Panels carry
   `scrollbar-width: none` at Sean's request, so always verify
   `panel.scrollHeight <= panel.clientHeight` after adding content to one.
   This bit twice: it hid the Start button, and then hid the TEST bar so Sean
   couldn't find how to reach level 2. **All UI sizes are now expressed in
   `--gvmin`** — 1% of the *game frame's* smaller side, set by `syncUiScale()`
   in `game.js` on load and resize — rather than viewport units. A tall narrow
   window used to give a short canvas but full-size text. Keep new UI in
   `calc(N * var(--gvmin))`, never `vmin` or fixed px, and keep clamp floors low
   or they cancel the scaling out.
5. **Swinging creatures can clip through platforms.** `checkLevels()` now traces
   the whole arc.
6. **`game.js` is cache-busted** via a timestamp query in `index.html`. Before
   that, edits appeared not to take effect and produced phantom stale state
   (a maths screen and crystals on a "fresh" level).
7. **Navigating to an identical URL may not reload the page.** Vary a query
   param when testing.
8. **The preview pane loses keyboard focus**, which looks exactly like the game
   freezing. There is now an on-canvas "Click the game to start playing!" prompt
   when no input has ever arrived.
9. **Never seed a `hash()` from a screen coordinate.** Glow City's windows were
   lit with `hash(wx * 0.31 + wy * 0.17)`, where `wx` is `sx + …` and `sx` is a
   *screen* x that slides every frame as the camera follows Dex. The hash
   re-rolled continuously and the whole skyline strobed the moment he started
   running — Sean: "when the cat moves all the background lights go crazy".
   Anything decorative must be seeded from world coordinates or from stable
   indices (building index, row, column). `drawVolcano`'s lava river is the
   pattern to copy: it converts back with `wx = sx + camX * 0.26` first.
   Test: hold Dex at x, grab an ImageData band, hold him at x+100, grab again,
   and compare with the band shifted by `100 * parallaxFactor` — a stable
   backdrop gives **zero** changed pixels. Dismiss the focus hint first (send a
   keydown), or its panel sits in the middle of the band and swamps the result.
10. **A missing `sfx` entry froze the whole game.** The Glow Rat's first bounce
    called `sfx.stomp()`, which was never added to the registry. The TypeError
    escaped `update()`, so the `requestAnimationFrame(frame)` at the bottom of
    `frame()` never ran and the game locked solid the instant a child bounced
    on a Glow Rat. Sean reported it as "seems like it froze?" — the same words
    as the focus-loss problem in #8, so **check the console before assuming
    focus**: a real exception names a line, focus loss does not.
    Two defences now:
    - `frame()` wraps its body in try/catch and always re-arms the loop. The
      first five failures are logged, then it goes quiet. A child playing alone
      cannot recover from a dead loop, so degrading beats freezing.
    - Before handing over, sweep for this class statically: pull the names out
      of the `const sfx = {…}` block and diff them against every `sfx.x(` call
      in the file. It takes seconds and catches the whole family.
    A new sound is cheap — add the entry when you add the call.
11. **A new movement mode must run BEFORE the normal run-speed code, not
    after it.** The slide was wired in below the ordinary "accelerate towards
    `runSpeed` at 2600px/s²" block, which quietly overwrote the chute's
    velocity every frame. The slide worked — it just played completely flat,
    170–276px/s instead of 170–460, and no amount of tuning `slideGravity`
    changed it because the gradient was never reaching him. Moving the branch
    to the top of `updatePlayerPhysics` fixed it in one line. If a new mode
    ever feels oddly unresponsive, check what's still running underneath it.
12. **A boss needs invulnerability frames like anything else.** The crown
    could be hit again on the way down from the same bounce, which skipped a
    whole phase — the fight went 3 → 1 hp in one jump. `bossVulnerable()` now
    returns false while he's reeling.
13. **Never let a test reach a mechanic by teleporting — it stops testing the
    way in, which is where the bugs are.** This cost twice in one session.
    First the slide: every automated ride passed while the chute's mouth sat
    180px above the floor Dex stood on, because the bot mashed jump on
    approach and `startSlide()` teleports him onto the surface. Then the boss:
    the fight "worked" through three phases in testing, and was in fact
    unwinnable, because `dropOnCrown()` in the test set his position directly
    rather than jumping. Sean found both by simply trying to play them.
    **A boss test must run and jump. An entrance test must walk in.** If the
    harness writes `player.x = …` to get somewhere, it is not testing that
    somewhere is reachable.
14. **Test the ENTRANCE to a mechanic from the real spawn point.** Sean
    couldn't get on the slide at all. The chute's mouth is at y300 (it has
    to be, for the plunge illusion), but the starting ground was at y480 —
    so he was standing 180px below a chute he could see and never reach,
    and running at it just dropped him off the end of the ground.
    Every automated ride had passed, for two reasons worth remembering:
    the bot mashed jump on approach so it always hit the narrow trigger
    window, and `startSlide()` *teleports* Dex onto the chute surface,
    which silently papered over the 180px mismatch. A test that reaches
    the mechanic by teleporting is not testing the way in.
    The drain lip is now a ledge at the chute's own height, and stepping
    off it without pressing catches you on the chute rather than opening
    the level with a free zap.
15. **Always hand the preview tab back clean.** Headless testing pins things —
    `game.invuln = 99`, `setInterval` holding Dex at an x, a half-finished
    level — and whatever is left behind is what Sean sees if he looks at that
    pane. A leftover `invuln` of 85 seconds had Dex strobing on the spot and he
    reported it as a bug: "the cat is flashing". It cost him a round trip over
    something that was never in the game.
    After any test session: clear every interval, set `game.invuln = 0`, reset
    the input flags, clear the save and navigate back to the title screen.
12. **The same skeleton was copied into all four levels, so a layout fault is
    never in one level only.** Sean hit a platform hanging over the take-off
    for Glow City's moving-platform crossing — 78px of head room where he
    needed 131, with a mosquito parked on the jump arc and slime leaving a
    10px run-up. When the check was written it found the same class in
    **every** level: three more low ceilings and six movers sweeping through
    standing space, some dating back to Crystal Canyon. `checkLevels()` now
    covers both. When a layout complaint comes in about one level, fix the
    class everywhere, then re-run the validator on all of them.

    Normal invulnerability blinking is short and deliberate — 2s after a zap
    (`spawnProtectionMs`, 3.5s on assist level 2), 1.6s after shrinking
    (`shrinkInvulnMs`), 0.9s after the Bubble Shield pops. Anything longer than
    that on screen is a test leaking, not a design decision.

---

**16. A pressed state that moves the button swallows the click.** Sean could
not start Crystal Canyon from the level picker: the row looked active, the
handler was attached, and clicking the arrow at the end sometimes worked. The
cause was `.lvlCard:active { transform: scale(.985) }`. A browser only
synthesises a `click` when press and release land on the *same* element — and
a 633px-wide row that shrinks 1.5% while held pulls its own edges ~5px out
from under the pointer, so the release landed on the panel behind it and no
click was ever produced. **Never give a clickable thing pressed feedback that
changes its geometry.** Use colour, border or an inset shadow. The picker rows
now also carry a `pointerdown`/`pointerup` fallback and `pointer-events: none`
on their children, so the whole row is one target however the press lands.

*Corollary for diagnosing this class of bug:* `document.elementFromPoint()`,
computed `pointer-events` and a synthetic `.click()` will all look perfectly
healthy, because they test the resting state. The failure only exists while
the button is held. If a control "sometimes" works, suspect `:active`.

**17. Lives belong in `save`, never in `game`.** `beginAdventure()` wipes the
whole `game` object on every level start, so a lives counter kept there would
silently refill between levels. `save.lives` survives levels, the treehouse
and a page reload.

**18. `Object.assign(fresh, oldSave)` copies the old `v` back over the new
one.** The save migration looked correct and passed a single reload, but the
version never advanced, so the v4 branch re-ran on *every* load and reset
lives to 9 each refresh. Any migration must stamp `s.v = SAVE_DEFAULTS.v`
after the assign. Test persistence with an actual page reload, not just by
reading the object back.

**19. `game.js` was cache-busted; `index.html` was not.** A plain reload could
therefore pair a brand-new script with a cached page from an earlier session.
The script reached an element the old markup did not contain, threw at the
top level, and **every listener wired below that line silently stopped
existing** — mute, pause and resume all went dead, with one console error to
show for it. index.html now sends `Cache-Control: no-store`, and the newest
wiring is individually guarded. **Always test the plain URL, twice, and read
the console** — the bug is invisible on a `?something` URL because that is
never the cached one.

*And when reading the console: check the `?v=` in the stack trace against the
live one. The buffer keeps errors across navigations, and an old page load
will happily hand you a bug you fixed an hour ago.*

**20. A solid you can walk into is a wall, whatever it looks like.** Crystal
geodes (Crystal Canyon's bounce pads) were first built as a solid you land on
— which works perfectly if you arrive from above, and is nonsense if you
arrive from the side. The walk-from-spawn test caught it immediately: Dex ran
along flat ground into a big shiny crystal and simply stopped. A child reads
that as a broken wall, not a trampoline. Geodes are now a **touch volume** in
their own `LEVEL.pads` array, not platforms: any contact launches, from any
direction, and they can never block or trap. When adding a new object, ask
which directions a player can meet it from, and make every one of them do
something sensible.

**21. A geode's trigger is a tall column, and that is load-bearing.** The
crystals are 30px high; the trigger is 130. A geode is the only way across the
canyon behind it, and a 131px jump would otherwise sail clean over the top of
one and drop her in the void. `pad.baseY`/`pad.visH` are what gets drawn;
`pad.y`/`pad.h` are the trigger. Do not collapse them back together.

**22. The trigger fires on its LEFT edge, not its centre.** Running right, Dex
trips a geode the moment he touches the near edge — so an arc actually starts
about 29px before `pad.x`. The crystal trails along each flight were first
computed from the geode's centre and sat ~52px off the real path the whole
way. Anything positioned relative to a flight must be measured from where the
flight *starts*, not from the middle of the thing that caused it.

**23. `checkLevels()` flies every catapult three ways.** Full back lean, no
lean, full forward lean — and rejects any arc that hits scenery, lands on
spikes, or falls out of the world. It also feeds each geode's shortest arc
into the gap rule, which is what lets a catapult legitimately be the only way
across a 1,000px void. Without that pairing, "she can steer" quietly means
"she can steer into a pit". Trust the rule over your own arithmetic: it caught
all five original geode placements at once.

**24. `<meta http-equiv="Cache-Control">` does NOT stop index.html being
served from cache.** Gotcha 19 recorded the stale-page problem and "fixed" it
with that meta tag. It does not work — proven the hard way when the ending
shipped depending on two new ids in the victory panel and a cached page loaded
without them. `game.js` carries a `?v=` buster; the HTML around it does not,
and cannot be relied on to be the same generation.

**So: reach existing markup by structure, not by adding ids to it.**
`document.querySelector('#overlayVictory h2')` works on every generation of
the page; `$('victoryTitle')` only works on the newest one. New elements are
fine — new *dependencies* on new elements are the trap. Guard them, and give
them a structural fallback where the thing is already on screen.

**25. Exceptions off the frame loop used to vanish.** `frame()` has a
try/catch, so anything thrown while drawing is reported. The ending is not
drawn — `freeNova()` hands to `win()` on a `setTimeout` — so when `win()` hit
a missing element the whole ending disappeared in silence: the state said
`victory`, no card appeared, and the console was completely clean. There are
now `window` listeners for `error` and `unhandledrejection`. **If you add a
`setTimeout`, an event handler or a promise, remember its failures are not
covered by the frame loop's safety net** — the listeners will report them, but
only if you look.

**26. The end-of-level card only goes forward.** Its green button used to say
"Play again" and restart the level just finished. Sean: it *"implies u go back
to start of previous level"* — and then, plainly, *"dont have a button which
puts u back, instead make a continue button that takes u to the next level."*
It now reads "Continue to <the next level name>" and starts that level; on the
last level there is nothing to continue to, so it hides and the treehouse
button is the only way on.

*The general point, worth keeping:* renaming a button without moving its
behaviour would have been worse than leaving it alone. A label that merely
confuses is a muddle; a label that confidently states the wrong thing is a lie.

**27. A state with no updater freezes its animation values, it does not stop
them being used.** `win()` calls `addShake(4)` and then sets the state to
`victory`. The shake decays inside the per-state updaters, and `frame()` runs
no updater for `victory` — so `shakeMag` stayed at 4 for as long as the card
was up while `render()` kept offsetting a completely frozen world by a random
+-4px every frame. Sean: *"the background is very shaky - it looks buggy and
unprofessional"*. It affected `paused`, `gameover` and `math` too.

`frame()` now zeroes the shake outright in any state without an updater.
**When you add a state, ask what stops decaying in it** — shake, hitstop,
slow-motion and fade all live outside `update()`.

**28. `run` meant "grounded and moving fast", which is also true of sliding.**
Dex did his running cycle all the way down the storm drain. The slide now
excludes itself from `run` and has its own pose: legs straight out square to
the body, paws cocked up, one arm braced behind.

**29. The ending said cured; the drawing said radioactive.** King Ratthew kept
his green aura, glowing green eye, green sparks, corrupted purple fur and the
Gamma Crown through the whole ending — so the scene that tells a child he is
better showed him still visibly ill, only smaller. `drawRatthew` now takes
`{cured, crown}` and repaints him in the same browns as every other cured
creature (#8a6242 / #a67a52 / #2a1c10, from drawRat). **If a character changes
in the story, check the art changes with it.**

**30. The world clamp is not a wall.** The treehouse had only a floor solid,
so the only thing stopping Dex was `moveAndCollide`’s clamp to
`ROOM_W - player.w`. The room is exactly one viewport wide, so that clamp sits
at EXACTLY the screen edge: his whiskers rendered past 960 on the right and
his tail past 0 on the left. Sean: *"i just went off the screen at the
treehouse on the right hand side"*. The room now has real wall solids inset
far enough that the whole sprite stays visible — and still inside the 56px
reach of the door station. **A clamp stops a coordinate; it does not stop a
sprite, which is wider than its hitbox in every direction.**

**31. Every prompt said "press E". There is no E key on an iPad.** The
workshop, the door and the power-ups all named a control that does not exist
on the device this is now built for, so on a tablet the treehouse read as
inert — Sean: *"not sure how u build the powerup in novas workshop? seems
like nothing there"*. `actHint()` / `ActHint()` / `actKey()` now name whichever
control the player actually has, and the touch versions name the icon the
button is showing. **Any new instruction text must go through them.**

The touch buttons were also white-on-translucent-white, which vanished against
the brightly lit doorway — the very button the new text points at. They are
dark-filled now, and the power button wears a pulsing gold ring whenever
pressing it would actually do something.

*Worth knowing:* an empty workshop is CORRECT before the first level is
finished. Blueprints are the reward for first-clearing a level, so all four
frames legitimately show "???" until then, and the room says so.

**32. The stale-index.html trap is still live and it bit again.** The CSS
changes above silently did not apply on reload — computed styles still showed
the old values while the new class was present. The `no-store` meta from
gotcha 24 does not work. **The only reliable cache bust for the page itself is
a query string:** load `localhost:8471/?cb=something-new`. Always verify a CSS
change by reading `getComputedStyle`, never by looking at a screenshot.

**34. The boots refresh on landing, and that is deliberate.** They began with
one charge per level, topped up only by answering a maths question — so a clean
run gave exactly one double jump, and the only way to earn more was to keep
dying. Sean: *"do they just work once?!"* One airborne period now gets one
spring, back the instant he touches down. She cannot chain two in a single
jump, and she never has to ration it. The maths recharge still fires but finds
it full and hands over bonus crystals instead, so the teaching loop is intact.

This does not break any level: a double jump raises her reach to 262px but
horizontal reach is unchanged, so the catapult voids in Crystal Canyon (1,000px+)
still cannot be jumped and nothing is skippable.

**33. The Spring Boots are a double jump, and "twice as high" is literal.**
They used to sit on the power-up button and set `vy` to a flat 720 — but an
ordinary jump already starts at 760, so pressing them early took the charge
and gave nothing back. Sean: *"doesnt seem to work - lets keep it simple,
double press quickly, and he jumps twice as high."*

`springJump()` now solves for the velocity that puts the apex exactly two
normal jump heights above the ground he took off from, so the height is the
same whether she presses after 90ms or 350ms (measured: 255px against a 262px
target at every timing). **Do not replace that with a fixed velocity** — a
fixed number is only correct at one moment in the arc.

It is also immune to the jump cut (`player.launchT`). Without that, letting go
of the button just after a quick double-tap clamps the spring back to
`jumpCutVel` and eats the entire boost — which is precisely what "doesn't
seem to work" looked like. Verified: holding jump does NOT spend the charge,
pressing on the ground does not spend it, and an empty charge does nothing.

**35. `LEVEL` still holds the last level played while Dex is in the treehouse,
and the treehouse shares `updatePlayerPhysics`.** Going home from the sewer
mid-slide left him off screen, flickering in and out — the chute-lip detector
scans `LEVEL.chutes`, the treehouse door happens to sit within grab range of
the sewer chute's mouth, so every frame re-attached him and `updateSlide`
drove him a thousand pixels out of a 768px room.

Two things were needed, and the first alone was not enough:

1. `clearMovementState()` — one helper that lets go of vine, chute, flight and
   launch together. Called by `enterTreehouse`, `showTitle`, `startCinema` and
   `placeAtCheckpoint`. **Anything that moves Dex somewhere new must call it**,
   or the new place inherits the old place's physics.
2. The things that GRAB him — chute lips, vine reach, geodes — are now gated
   on `game.state === 'playing'`. Clearing state does nothing if the next
   frame re-attaches him.

*The general shape:* whenever a level's furniture is scanned every frame, ask
what happens when the player is somewhere that furniture does not exist.

**36. The Time Bubble freezes the world; it does not slow it.** It used to run
hazards at 35%, and only the systems that remembered to call `slowFactor()`
obeyed — **King Ratthew never did**, so he leapt and fired straight through the
one power-up meant to save her from exactly that.

It now freezes at the CALL SITE: `update()` computes `wdt = dt * slowFactor()`
and hands that to the world while Dex, the camera and decorative sparkles keep
real time. Because the factor is now binary, the systems that still multiply
by `slowFactor()` internally are multiplying zero by zero — harmless, so
nothing had to be unpicked. **Add a new hazard and it is frozen automatically,
provided you take dt from update() rather than reading a clock.**

Verified: movers, enemies, geysers and the King all unmoved 2.5s in, Dex moved
124px, everything running again afterwards.

## 7. Test procedure — run before handing anything to Sean

Syntax: `node --check game.js`

In the browser console:

- `NQ.checkLevels()` → `[]` means no floating creatures, no over-wide gaps,
  every checkpoint on solid footing and clear of every hazard and of every
  ranged attacker, nothing on the portal run-in, and every rising-slime zone
  escapable. Also a button in the debug panel.
- `NQ.quizTest(300)` → 300 questions, 0 issues.
- Per level and per checkpoint: `NQ.beginAdventure(i)`, set
  `game.checkpoint`, `placeAtCheckpoint()`, `game.invuln = 0`, no power-up, then
  step ~480 frames standing still. Expect no zap and `player.big` still true.
- Confirm the portal is still reachable in each level. The crude auto-runner
  (hold right, jump when there is no support ~70px ahead or a step within 200px)
  is enough to prove a route exists — but it is a poor *player*: it mistimes
  movers and jumps gap edges early, so a fall tells you very little on its own.
  Read where it stopped, then check that spot by hand.
- For a level with a `FLOOD`, run the climb with a deliberate pause after
  entering the zone (0s / 2s / 4s) and confirm the curve reads comfortable,
  tight, caught. Then confirm a zap resets the slime to the bottom.
- Check the console for errors — and treat any *uncaught* one as a freeze bug,
  even though the loop now survives it.
- Bounce every stompable creature at least once. A creature with a special
  first-hit branch (the Glow Rat) is a code path nothing else exercises.

Finally hand the tab back clean, or the next thing he sees is your test rig:

```js
['__p','__hold','__h2','__h3','__h4'].forEach(k => { if (window[k]) clearInterval(window[k]); });
NQ.game.invuln = 0;
NQ.input.left = NQ.input.right = NQ.input.jump = NQ.input.jumpPressed = false;
localStorage.removeItem('numberquest_save_v2');   // clean start
location.href = 'index.html';                     // back to the title screen
```

---

## 8. State of play

**Built:** opening cinematic (5 scenes), walkable treehouse (Nova's workshop,
her desk, mission board, open doorway onto Greenhaven), 4 power-ups, the
maths-on-zap loop, one-hit shrink, level picker, per-level saves, levels 1–2.

| # | Name | Theme | Status |
|---|---|---|---|
| 1 | Crystal Canyon | `canyon` | built |
| 2 | Tangle Jungle | `jungle` | built — banana monkeys, rats, **two vine swings** |
| 3 | Ember Volcano | `volcano` | built — lava geysers, lava waterfalls, Blaze Rats, Ember Rats |
| 4 | Glow City | `city` | built — Glow Rats, slime pools, **rising slime** |
| 5 | The Rat King's Sewer | `sewer` | built — the slide, the sewer, King Ratthew, Nova's cage |

**All five levels are built.** What's left is play-testing with a real child,
and deleting the 🧪 TEST bar before it ships.

**Level 5 notes.** Sean's brief, in his order: Dex slides in on his backside
down a long chute dodging and jumping; then a *normal* level through the sewer;
then the King. He pulled me up for designing only the boss the first time —
the slide and the sewer are two thirds of the level and were the point.

**The chute.** About fifteen seconds, and it is **one continuous descent** —
2,450px of it, gradient never negative, only easing and steepening. Sean was
clear about this after seeing the first version: *"i want one long continuious
slide where dex avoids enemies"*. The first attempt undulated up and down to
stay on screen and he spotted it immediately.

**That needed a vertical camera, which the engine had never had.** `camY` is
zero everywhere except on a chute and eases back to zero the moment he's off
one, so nothing else in the game is touched by it. Two things depend on it and
both bit during testing:

- The fall check is `player.y > camY + VIEW_H + 60`, not a fixed number.
- **`placeAtCheckpoint()` must SNAP the camera, not pan to it.** Respawning
  1,100px down the chute with the camera still at zero put Dex "below the
  screen" and zapped him on the first frame of his own respawn — the slide was
  unplayable after any mistake, and the isolated test missed it because a
  previous run had left `camY` conveniently non-zero.

The chute is authored as `chuteFromGrades(x, y, [[length, gradient], …])`, and
its far end is 2,000px below the sewer floor, so `CH.exitTo(x, y)` fires him
out of a pipe mouth back at ordinary level coordinates behind a splash.

**Everything on it is a creature**, per Sean: `CH.rat(x)` crouches on the chute
(jump it, or land on its head and cure it) and `CH.swarm(x)` hangs across the
pipe (stay LOW — do *not* jump). Plus `CH.gap(a, b)`, a hole to clear. One
button, two opposite answers.

**Spacing is set by the real jump distance, which is much longer than it
looks.** On a steep descent the chute falls away underneath him at ~280px/s, so
a hop keeps him airborne for nearly a second and covers 400px+. A swarm placed
250px after a hole is unavoidable — he is still in the air when he gets there.
Obstacles are now ≥500px apart. Verified by three riders: never jumping is hit
at the first rat, jumping constantly is hit at the first swarm, and timing it
is clean anywhere from 0.10s to 0.50s of lead.

**King Ratthew.** Sean: don't make him literally fifty times bigger, just very
large within the game's confines — and keep the intro's "fifty times" line,
because "i dont think an 8 year old will audit it". So the sprite is 250×190
and the story is unchanged.

**Five crown hits, and one loop repeated:** he blasts the ceiling, rock rains
down with every piece shadowed on the floor, Dex dodges through it, climbs a
shelf and jumps on his crown. Beams at Dex and the occasional leap fill the
gaps. He stands at full height throughout.

**NEVER cull a hazard's drawing by the position of the thing that made it.**
`drawKing()` early-returns when the King's body scrolls off screen, and his
beam, his falling rock, his shockwaves and the objective banner were all
drawn inside it, below that return. His beam is 1,500px long: run far
enough away and he killed Dex with something that was never painted at all.
Sean: *"im dieing when u cant actually see his laser beam."*

Everything of his that can reach Dex now lives in `drawBossFx()`, which has
no visibility test at all, and he will not take a shot while he is off
screen. Belt and braces, and both are worth keeping — verified by sampling
the canvas along the beam's path: with the King off screen entirely, 13 of
13 sampled points show the beam.

A second half to the same bug: the beam faded from the instant it fired but
stayed lethal to its last frame, so its final third was a nearly invisible
killer. It now holds full brightness for the whole time it can hurt you
(0.29s of 0.45s) and only fades once it cannot.

**The fight tells you what it wants.** Walking into the arena triggers a
title card (KING RATTHEW THE THIRD / "Cure him to free Nova!"), a boom, a
riser and his laugh, and a boss theme that runs until he's cured — it reuses
the intro's music engine, so there is nothing new to maintain. A banner sits
along the bottom of the screen for the whole fight: the objective in words,
and **five jewels that grey out as you knock them off**.

That jewel row is not decoration. Sean thought a zap had reset the fight to
five hits; it does not — `respawn()` leaves the boss exactly as it was, and
only `beginAdventure` (restarting the level from the pause menu, the picker
or the TEST bar) starts him over. The counter is there so the player can
SEE that, instead of having to infer it. Keep it.

One real bug came out of that report: `resetEntities()` revives every
creature in the level on a respawn, which resurrected the King's summoned
rats — including the ones swept away between phases. They are now cleared
instead, since they are transient rather than part of the level's cast.

**The tail is gone and should stay gone.** An earlier version gave each phase
its own verb, including grabbing his tail like a jungle vine. Sean, playing
it: *"there is something weird where he says — behold my magnificent tail and
a vine appears?"* It read as a bug, not a callback. **If a mechanic in this
fight needs explaining, it is wrong.**

Roughly half his shots go at Dex and half at the ceiling (`roofChance` 0.45).
Watch that balance if it is ever retuned — pushing roof shots to 0.62 once
squeezed the aimed beams down to about one a minute and Sean noticed they had
effectively disappeared.

**He hunts you** — Sean's verdict on the first version was "too easy", and it
was: a stationary target you could camp a ledge and drop onto. He now LEAPS AT
DEX every `leapEveryS`, landing where you were, and the landing winds him for
`windedS` — which is your opening. Dodge, then punish. A red shadow marks the
landing spot for most of a second and stops tracking you 55% of the way
through the wind-up, so there is always a committed target to step out of.

**Five jewels, not three**, and everything speeds up as they come off
(`bossPace`). The arena is **two** tiers a side, not three — Sean cut the top
pair — and the 316 shelf still reaches his crown while he stands.

**He does not fold up any anymore, and must not again.** For a while he
squashed flat when he was open to a hit, which brought the crown down to knee
height — but Sean cut it: *"i dont think we need a folded up - it looks
weird"*. He was right twice over. It looked like a rendering bug, and it also
meant the same squashed shape read as both "hit me" and "I'm coiling to
leap". **He now stands at his full height the whole fight**, which makes the
two shelves the route to his crown — that is what they are for. Rearing up to
leap is the only shape change left, so that tell has the field to itself.

The loop Sean asked for: **he blasts the ceiling, you dodge the rock, you
climb a ledge and jump on his crown, repeat five times.** Roof shots are the
main attack (`roofChance` 0.62), and each one is `rockVolleys` waves of
`rocks` — up to 14 lumps of ceiling in the air at once, every one with a
shadow on the floor first.

**A hazard's marker must last as long as the hazard does.** The rocks had
shadows from the start, and they were still too hard to dodge, because the
shadow only showed during the wind-up and vanished the moment the rock
began to fall — exactly when you need to know where it is going. The
shadow now lasts the whole way down, tightening and darkening as the rock
closes, and the fall was halved. Each rock is marked on the floor for
**2.2 seconds** (0.9s warning plus a 1.3s fall), against 0.75s of marker
and a 0.8s unmarked drop before. Same lesson as the flood taper: what you
can see has to match what can hurt you, for as long as it can hurt you.

Verified with a sweep: a plain run-and-jump lands on the crown from anywhere
along **either** shelf (left x10740–10900, right x11290–11430) at his normal
standing height, and five of those finish him — 1.0 down to 0.5 scale.

Four things about this fight were wrong at some point and every one of them
punished the player for doing the right thing. If it needs retuning, check
these before touching any numbers:

1. **No shockwave off the leap landing.** He lands where Dex was, so a wave
   rolling out from his feet caught you the instant you finished dodging — it
   cancelled the exact opening the dodge is meant to earn, 4 times out of 4.
2. **`windedS` must cover running back.** Dodging throws you 300–400px clear;
   at 1.9s you could not get back and jump. It is 3.0s.
3. **His body only hurts mid-leap.** Contact damage on a stationary boss you
   are meant to jump on was the single biggest source of zaps, and not one of
   them was the player's fault.
4. **He does ONE thing at a time** (`busy` / `breatherS`). Leaps, beams, rocks
   and rats all landing together took a played run from 3 zaps to 90.

The measured opening is a **300px band (x10820–11100)** where a plain
run-and-jump lands the hit, in both the winded and the laughing states.
Phase two gives about 15 seconds of open-to-attack per minute. **If a test
says the fight is unwinnable, check where the harness is standing before
believing it** — chasing that band cost most of a session.

**He is not boring any more** (Sean's word). The Gamma Crown fires green beams
out of his eyes: `laserEveryS` apart, `laserWarnS` of dashed sighting line and
a charging eye first — never a shot without a warning. `roofChance` of them go
UP instead, and he throws his head right back to do it (`lookUp` rears the
whole body and lifts the eye 52px), which brings `rocks` chunks of ceiling
down on Dex, each with a shadow on the floor before it lands. Beam and rock
both hurt. **He can't shoot while he's folded up** — that window stays safe,
or the only way to hit him would also be the only way to be shot.

The beams **aim**: they track Dex through the first 45% of the wind-up and
then commit, so a shot at someone up on a shelf comes in at an angle instead
of sailing past underneath. Tracking him all the way to the trigger makes it a
homing beam with no moment where moving helps — don't.

Measured: about ten shots a minute, four at Dex and six at the roof. A played
run of the whole fight now takes ~40s with 3 shrinks and 3 zaps, against 22s
and no damage at all before the lasers went in.

**The minions are capped.** Sean: *"the rats are buggy by the king, u jump on
one- more come out."* Three faults stacked: no limit on how many were alive,
every one spawning at the same x so they stood inside each other, and cured
ones never cleared. Now `maxRats` alive at once, alternating sides, and
`sweepKingRats()` clears the floor whenever the phase changes.

**The ending.** He is *cured*, not beaten — everything in this game is, and it
would be odd for the villain to be the exception. Then Nova's cage, locked with
the only two-step question in the game (`MathQuiz.finale()`: a times table then
a subtraction), and she gets one hint after a single wrong answer instead of
two, because she's right there talking him through it. It is the only question
you get as a reward rather than a penalty. The Star Portal refuses to open
until the crown is broken and Nova is out.

**Level 4 notes.** Sean's spec was "city with large glowing green rats and toxic
slime". Asked how to keep the levels varied he was given four options and picked
**rising toxic slime** — "seems like the most variety". So the level is built
around it:

- **Glow Rats** — big (54×38), slow, and they take **two** bounces. The first
  knocks the glow out (sprite shrinks to 0.74, flash, shake, toast "Knocked the
  glow out of it — hit it again!"); the second cures. `drawRat` now scales by
  `e.w / 36`, so any future big rat draws big for free.
- **`SLIME(x, w, y)`** — a permanent bubbling pool. Green always means jump.
- **`FLOOD(x1, x2, startY, topY)`** — hidden in the gutter until Dex enters the
  zone, then climbs at `floodRisePx` while he is inside and drains
  `floodDrainMult`× faster once he is clear; `placeAtCheckpoint()` resets it, so
  a retry always starts from the bottom.

**There are exactly two rising-slime obstacles in the game, both in Glow City,
and they are the whole middle of the level.** Sean asked for it earlier, longer
and harder, then harder again with smaller platforms and wider gaps:

| | stage one | stage two |
|---|---|---|
| starts at | x2020 (**19%**) | x4180 (**40%**) |
| length | 1640px | 1840px |
| climb | 228px, 6 steps | 266px, 7 steps |
| gaps | 55 → 105px | 60 → 132px |
| steps | 150 → 100px wide | 146 → 74px wide |
| tops out at | y254 | y230 |

**The step-sizing rule, which is the whole reason these are fair.** A
full-power jump from a step's edge carries Dex about 166px while he is still
above the next step's height. So a landing step must be at least
`166 - gap + 40` wide, or a committed jump sails clean over it. Widen the gap
and the step gets *smaller* — which is exactly the shape Sean asked for, and it
works because **every jump is the same jump**: run to the edge and go. Nothing
in either staircase needs a half-press or a shortened hop; an 8-year-old only
has to learn one action and repeat it faster than the slime.

An earlier attempt at "harder" used narrow steps with *small* gaps and it was
much worse: a full jump overshot the step and a short jump fell in the gap, so
the player had to modulate jump length with nothing on screen telling them so.
If these ever need retuning, change the gaps and let the widths follow the
formula — do not set them independently.

`floodRisePx` is **40**. Measured with an auto-runner that jumps at the last
moment, pausing for N seconds after entering the zone:

| dither | stage one | stage two |
|---|---|---|
| 0s | escapes, 55px clear | escapes, 56px clear |
| 0.5s | 34px clear | 35px clear |
| 1s | 14px clear | 15px clear |
| 1.5s | takes the shrink hit, still escapes | same |
| 2s | caught | caught |

Both stages measure almost identically, which is deliberate — stage two is
longer and taller but the gaps grow to match, so it reads as *more of the same,
faster* rather than a difficulty cliff.

**Glow City has five checkpoints, not the usual four**, and that is deliberate:
one before each stage and one on the dry roof between them, so failing stage two
never makes you replay stage one. If the count is ever cut back, the roof
checkpoint at x3620 is the one that must stay.

Three things about the flood were learned the hard way and must not be undone:

1. **The street has to stop.** With ground running the whole length of the zone,
   the fastest route was to sprint along the road underneath the fire escapes —
   the climb was decorative. Section 3's road now ends at 6180 and resumes at
   7400; in between there is only the staircase.
2. **Staircase steps are sized by the formula, never by eye.** Three versions
   got this wrong. 70px gaps over a pit: the auto-runner fell in constantly.
   24px gaps looked safe — narrower than Dex is wide — but were not, because
   the collision resolves each axis separately, so a landing a pixel short of
   the next step slides down its face and through the gap. Narrow steps with
   small gaps were worst of all: a full jump overshoots, a short one falls in,
   and the player has to guess the jump length. The rule that finally worked is
   `step width >= 166 - gap + 40`, so a committed full-power jump always lands.
   With it the auto-runner never falls — **every** failure is the slime, which
   is the point.
3. **Nothing may hover over the staircase.** A mosquito parked over the middle
   of the climb knocked Dex mid-step into the slime — a hit you cannot avoid
   without stopping, and stopping is exactly what the slime punishes. The one
   mosquito in the section now waits above the escape roof, where a miss is
   harmless.

Measured on the finished staircase at `floodRisePx: 30` — straight up clears by
106px, a 2s dither by 20px, a 4s dither is caught on the last step. That "so
close" catch is deliberate; the checkpoint is only 660px back.

The slime is drawn **translucent** over a vertical gradient with bubbles rising
inside it. An earlier opaque fill turned the top half of the level into a flat
green slab that read as a rendering bug. It also **tapers** to its resting level
over the last 130px at each end so it never ends in a vertical wall, and
`floodHits()` tests that same tapered surface rather than a plain rectangle —
never let those two drift apart.

**Level 2 notes — the vines.** `VINE(ax, ay, len)` hangs a vine whose end sits
at `(ax, ay + len)`. Dex catches it in mid-air with jump and lets go with jump.
On grab his momentum is converted to angular velocity and `vineGrabBoost` is
added in his direction of travel — without that boost a slow approach gives a
feeble arc and the crossing becomes luck rather than timing. Release throws him
along the tangent plus `vineReleaseBoost` upward, so letting go on the forward
upswing sends him up and out. All the knobs are in `TUNING.player`.

| | vine one | vine two |
|---|---|---|
| gap | 470px (x4950 → x5420) | 510px (x7320 → x7830) |
| anchor / length | x5120, 260 | x7480, 270 |
| release window | 0.33–0.83s (**0.5s wide**) | 0.42–0.75s (**0.33s wide**) |

The first is the teacher and the second is the test. Both were measured by
running the swing and varying how long the vine is held; if they ever need
retuning, move the landing ground rather than the vine — the landing edge is
what sets the window.

**Each vine has a checkpoint on the ledge in front of it** (x4760 and x7060),
so a missed swing costs one maths question and the run-up rather than half the
level. That took the jungle to **five** checkpoints, like Glow City.

**Level 3 notes.** `GEYSER(x, y, phase)` erupts upward on a telegraphed cycle;
`FALL(x, top, bottom, phase)` pours downward and eases off between surges — two
different axes so they don't feel samey. Falls are `fallWidth` 72 and
deliberately dramatic: heat glow, six streaks, a big roiling splash pool, steam
either side, molten spray and a shake on impact.

Fire cast (14 rats): **Ember Rats** breathe a cone of fire, **Blaze Rats** run
ablaze with flames off their backs (head safe to bounce), **Magma Rats** prowl,
rear up glowing, then spit an arcing fireball. Fireballs reuse the `bolts`
projectile array with `kind: 'fireball'` — flatter and faster than a banana,
~200px reach.

`checkLevels()` now also verifies geysers sit on solid ground, falls have
height, neither sits on a checkpoint or the portal run-in, **and no checkpoint
is within reach of any ranged attacker** (fireball or banana). That last rule
caught three compromised checkpoints the moment Magma Rats were added — add it
to any new ranged species by giving the CREATURES entry `spits` or `throws`.

**Known limitation Sean has been told about:** Time Bubble and Cure Pulse can't
be earned until levels 3 and 4 exist, since power-ups are tied to level index.
The workshop shows them as "Win it in Level 3/4!".
