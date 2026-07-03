# Handoff — wife's-notes feature pass

Session hit the context/usage limit mid-verification. Everything below is
committed and pushed to `main`. Pick up at "Remaining work" / "In progress
when cut off".

## What prompted this

The user's wife gave a batch of design notes on the Cozy Sprites tamagotchi
game (see conversation for the verbatim list). This session implemented
essentially all of them. Original file list at session start (`M`/`??` in
git status) reflected an earlier, separate in-progress session's changes —
this session built on top of that working tree, not a clean baseline.

## Done (implemented + unit tested + typechecked + built)

- **Pixel icons, not emoji** — new `src/render/icons.ts`. 30 icons authored
  as 12×12 char grids, rendered to cached canvases/data-URLs. All emoji in
  `main.ts` and `ui/menus.ts` replaced (`iconEl`/`iconHTML`/`iconUrl`/
  `iconCanvas`).
- **Monospace typeface** — `style.css` body font-family swapped to a
  monospace stack.
- **Bedroom → cozy garden clearing** — `src/render/scene.ts` fully rewritten:
  sky/hills/grass, lantern (replaces lamp; same on/off semantics as before),
  stump, fence, mushroom, flower patch, fireflies + stars at night.
- **Baby/child/teen stages have real distinct sprites**, plus all 6 adults
  now have visually distinct silhouettes (not just recolored blobs), plus a
  **secret 7th adult form: `ghost`** (unlocked via sustained night care —
  see `evolution.ts` `s.ghost` scoring, gated behind `nightCare >= 8`+).
  `src/render/sprites.ts` fully rewritten with per-body face offsets
  (`faceDx`/`faceDy`) and overlays (glasses, eye-bags, teeth, etc).
- **Speech bubbles anchor to the sprite**, not fixed top-center.
  `Scene.creatureAnchor()` returns CSS-pixel position above the creature's
  head (accounts for canvas scaling + letterboxing); `main.ts` `say()` uses
  it to position `.speech-bubble` inline via `left`/`top`.
- **Chattiness limiting by age/creature** — `pet/dialogue.ts`
  `speakChance()`/`shouldSpeak()`. Important categories (`sick`, `hatch`,
  `win`, `call`, etc via `ALWAYS_SPEAK`) always speak; routine chatter
  (`idle`, `tap`, `feed`) rolls against per-stage (`STAGE_CHATTINESS`) or
  per-adult-form (`FORM_CHATTINESS`) probabilities. Teens are quiet (0.35),
  dogs are chatty (0.9), ghosts are nearly silent (0.25).
- **Cleaning animation** — `Scene.playClean()`: broom sweeps across the
  grass with sparkles; `main.ts doClean()` calls it before the pet's
  reaction line plays.
- **Named illnesses (Oregon Trail flavor)** — `pet/types.ts` `ILLNESSES`
  table: sniffles, dysentery, goblin flu, the vapors, the plague (weighted
  roll in `state.ts rollIllness()`, plague ~10%). Announcement copy via
  `dialogue.ts illnessAnnouncement()` → "NAME has dysentery." **Plague
  needs two medicine doses** (`giveMedicine` returns `note: "dose"` on the
  first, `"cured"` on the second); everything else is still the original
  one-dose heal. Status panel shows the specific illness.
- **Death is now possible** + death animation + memorial screen.
  `state.ts`: `zeroHealthMs` accumulates while `health <= 0` (past egg
  stage only), death fires at `DEATH_AFTER_ZERO_HEALTH_MS` (6 min demo-paced,
  same file). `causeOfDeath()` infers a cause (illness name > hunger >
  happiness > "general neglect"). `Scene.playDeath()` plays a lie-down +
  fade + floating-spirit act. `main.ts mountMemorial()` is a new screen
  (separate from the hatch screen) showing `memorialLine()` +
  `epitaph()` + lifespan, with a "Lay to rest" button that files a farm
  entry with `passedAway: true, cause`. Farm/Collection UI in `menus.ts`
  renders a grave icon + "died of X" for these entries.
- **Farm at any age, with darkening confirm copy** — `dialogue.ts
  FARM_CONFIRM` has distinct, progressively more uncomfortable lines per
  stage (egg → baby → child → teen → adult); `menus.ts confirmFarm()`
  colors the line and changes the button text ("Do it anyway") when the
  pet isn't an adult yet.
- **In-scene game animations, text from the sprite, not the panel**:
  - Fetch: visible throw arc + chase + retrieve/fumble, `Scene.playFetch()`.
  - RPS: countdown "fists" bob, then both moves reveal above the
    player/pet, `Scene.playRps()` (uses the rock/paper/scissors icons as
    sprites).
  - Hide & Seek: the creature actually vanishes (`Scene.playHide()`,
    poof/dust act), guess UI appears, then it pops out of the *real* spot
    (`Scene.playReveal()`, positions defined in `HIDE_SPOT_POS`).
  - Higher/Lower and Would-You-Rather stay panel-driven (need to show
    cards/question text) but final verdict now always comes from
    `ctx.finishGame(..., line)` → spoken by the sprite via `say()`, not
    printed in the panel.
  - `menus.ts` restructured: `MenuCtx` gained `scene()` and `stageEl()` so
    game code can drive the `Scene` acts and overlay lightweight controls
    (`stageOverlay()` / `.stage-controls` in CSS) onto the `.stage` div
    instead of the modal panel for in-scene games.
- **Expanded dialogue copy**, profanity capped at "hell" (used once, in
  `GENERAL.idle`) — `pet/dialogue.ts` rewritten with several more lines per
  category/stage/adult, a `ghost` voice bank, illness/memorial/farm copy
  banks. `pet/games.ts` also got more fetch/would-you-rather copy and the
  hide-and-seek spots renamed to match the garden (stump/flowers/fence/
  mushroom, consistent with `HIDE_SPOT_POS` in scene.ts).
- **Notification settings (off/dire/any care drop)** — new
  `src/ui/notifications.ts` (`getNotifyPref`/`setNotifyPref`/`notify`,
  localStorage-backed, requests `Notification` permission on opt-in, only
  fires while tab is hidden). Wired into Status panel
  (`menus.ts notifySettings()`) as a 3-way toggle row, and into
  `main.ts stepPet()`/`beginDeath()` for sick/hungry/low-health/mess/
  attention-call/death events.
- **How to Play made obscure** — entry point is now a barely-visible "?"
  button tucked at the bottom of the Status panel (`.help-hidden` CSS,
  low-contrast, no icon/label), rather than a prominent labeled button on
  the main nav. Copy in `openHelp()` rewritten to be vaguer/more cryptic
  ("Operations, not spoilers" tone), no more prescriptive per-icon list.
- **Fixed a pre-existing evolution bug** found while adding ghost tests: a
  pet that played every minigame an equal number of times would always
  resolve to whichever `GameId` happened to iterate first in `Object.keys`
  order (not a real "favorite"), AND `determineAdultForm` always picked the
  literal highest-scoring form with no randomness — so near-identical
  upbringings produced the **same adult every single time** (this is what
  the user flagged mid-session: "we've done several tries and always got
  the same adult"). Fixed in `pet/evolution.ts`:
  - `mostPlayed()` now only reports a "top game" if it's uniquely highest
    (not tied) — `unique` flag gates `hasTopGame`.
  - `determineAdultForm()` now ranks forms by score, takes all forms within
    `TIE_EPSILON` (0.5) of the top score as candidates, and picks randomly
    among them (rng injectable, defaults to `Math.random`). A clear winner
    still resolves deterministically; a genuine near-tie no longer always
    breaks the same way.
  - Tests added in `evolution.test.ts` covering both fixes.
- **Baseline test fixes** — two pre-existing failing tests in
  `state.test.ts` assumed `createPet` starts at max hunger; a prior session
  had changed starting hunger/happiness to 3 (deliberate "start with real
  needs" change per commit `0a87fc5`) without updating these tests. Fixed.
- New/updated test files: `state.test.ts` (illness, dose mechanic, death,
  dead-pet-inert checks), `evolution.test.ts` (ghost path, tie-breaking),
  `dialogue.test.ts` (new — chattiness, illness/memorial copy, farm lines,
  pickLine voice priority).

**Full suite status as of last check: 60/60 tests passing, `tsc --noEmit`
clean, `vite build` succeeds.**

## In progress when cut off — READ THIS FIRST

I was doing a full browser smoke-test with Playwright (`chromium-cli` isn't
installed in this environment; used `playwright-core` from
`node_modules/playwright-core` directly instead, launching Chrome via
`channel: "chrome"`). Driver scripts live in
`/Users/connorrowe/.claude/jobs/ac077863/tmp/` (job-scoped tmp — **may not
exist in a new session**; recreate as needed, see recipe below).

**First screenshots looked great** — egg scene in the new garden at night,
lantern glow, fireflies, pixel icons in the nav, speech bubble ("I have
reconsidered.") anchored correctly above the egg sprite. See
`2-egg-scene.png` / `4-tapped.png` in that tmp dir if it still exists.

**Then I hit what looked like a stage-advance bug**: backdating
`createdAt`/`stageStartedAt`/`lastUpdated` in localStorage via
`page.evaluate()` and then calling `page.reload()` did NOT advance the pet
past "Egg" stage, even though the elapsed time (4.5 min) should push it
through egg (1 min) + baby (3 min) into child. Debugged and **confirmed
this is a test-harness race, not an app bug**:

- `main.ts` has a `document.addEventListener("visibilitychange", ...)`
  handler that calls `commit()` (→ `savePet(pet)`) using the **live page's
  in-memory `pet` variable**.
- When `page.reload()` tears down the old page, that handler fires with the
  stale (pre-backdate) in-memory pet and re-saves it, clobbering the
  localStorage edit I made via `page.evaluate()` moments earlier — because
  my edit went straight to localStorage but never touched the running
  page's JS-side `pet` variable.
- Confirmed via `debug2.mjs`: seeding localStorage with `addInitScript` on
  a **fresh page** (before any app JS runs, so there's no live in-memory
  state to race against) correctly advances the pet to `"child"` stage.
  Output was: `STAGE AFTER CLEAN SEED: child null` (form is null because
  child isn't adult yet — expected).

This is not a real bug in the game — it only affects *externally* poking
localStorage while the app is running, which a real user never does. But it
means my `drive.mjs` script (same tmp dir) is producing misleading
screenshots for every step after the first backdate (child/adult/hide-seek/
death screenshots all still show "Egg" because of this race). **Those
screenshots should be disregarded/re-taken, not trusted as evidence of a
bug.**

## Remaining work

1. **Rewrite the Playwright driver to seed state correctly** (use the
   `addInitScript` + fresh-page pattern from `debug2.mjs`, not "backdate
   live page's localStorage then reload") and re-run the full smoke test:
   - egg → child → teen → adult (verify each stage's distinct sprite renders)
   - ghost secret adult (seed `hidden.nightCare = 12`+, verify sprite +
     collection entry appears, still hidden for other undiscovered secrets)
   - all 5 minigames, especially the 3 in-scene ones (fetch throw/chase/
     retrieve, RPS countdown+reveal, hide&seek vanish/guess/pop-out from the
     *correct* spot)
   - illness flow: force `stepEvents` to roll sick, confirm illness-specific
     announcement text and Status panel condition row; force `illness:
     "plague"` and confirm two-dose cure flow via Care panel
   - death flow: force `health: 0, zeroHealthMs: DEATH_AFTER_ZERO_HEALTH_MS`
     pre-seeded (not accumulated live), reload, confirm death act plays and
     memorial screen appears with correct cause/epitaph, confirm farm entry
     afterward
   - notification settings toggle in Status panel (can't fully test actual
     OS notification delivery headless, but confirm the 3-way toggle UI
     works and doesn't throw)
   - hidden "?" help button in Status panel opens the obscured help copy
   - speech bubble anchoring during a scene act (e.g. mid-fetch chase) —
     confirm it doesn't detach or clip off-screen
2. Actually **look at every screenshot** (Read tool renders images) rather
   than assuming success from "no page errors" — a blank/wrong frame won't
   throw a JS error.
3. Once the smoke test is clean, this satisfies the `/run` skill's "drive
   it, don't just launch it" bar and the `verify` skill's intent — consider
   invoking `/verify` explicitly if the harness surfaces it, or at least
   note in the final summary that manual verification is limited to what
   was actually screenshotted.
4. Answer the user's still-open question from earlier: **"can this be
   playwrighted, or will there always be some poking and prodding outside
   of CI needed?"** My honest answer, ready to give: yes, the deterministic
   flows (stage advance via seeded localStorage + `addInitScript`, minigame
   outcomes via mocking `Math.random`/injecting rng, illness/death via
   direct state seeding) can all be fully automated and are good candidates
   for a real CI smoke test using this project. The main things that stay
   "poking and prodding" are (a) subjective art/animation *feel* — does the
   fetch arc look good, does the bubble placement look right — which needs
   a human or a vision-capable review of screenshots, not just DOM
   assertions; and (b) actual OS-level push notification delivery, which
   headless Chrome can't fully exercise. Recommend: write a real Playwright
   test file (not throwaway tmp scripts) using the `addInitScript` seeding
   pattern, checked into the repo (no test runner currently wired for E2E —
   only vitest unit tests exist; would need `@playwright/test` added as a
   devDependency and a `playwright.config.ts`), and keep visual review as a
   periodic human/agent screenshot pass rather than a CI gate.
5. Nothing in `SPEC.md`/`PLAN.md`/`agent_exec.md` was updated to reflect
   these changes — check whether the user wants those docs kept in sync
   (SPEC.md in particular documents things like the emoji icons, single
   blob body, bedroom scene, always-possible-no-death design that are now
   all stale).

## Known rough edges / things worth a second look

- `Scene.creatureAnchor()` assumes the canvas is letterboxed via
  `object-fit: contain` sizing math — should hold given the CSS
  (`#scene { object-fit: contain }`), but wasn't verified against a real
  resize/orientation change.
- Ghost adult's `speakChance` is intentionally very low (0.25) — could read
  as "broken/unresponsive" to a player who doesn't know that's deliberate;
  worth a UX gut-check.
- `DEATH_AFTER_ZERO_HEALTH_MS = 6 * 60_000` (6 min) is a demo-paced guess,
  same spirit as the existing demo-compressed `TIMING` table in
  `state.ts` — not spec'd anywhere, just chosen to be reachable in a single
  playtest sitting like the other stage timers.
- Didn't add a settings/toggle for the swear-word cap or illness
  frequency — those were interpreted as fixed design decisions from the
  notes, not configurable options. Flag if that's wrong.
- `persistence.ts migratePet()` backfills new `PetState` fields for saves
  written before this session (illness/dosesGiven/zeroHealthMs/deadAt/
  causeOfDeath) — sick-but-no-illness old saves default to `"sniffles"`.
  Reasonable default, not deeply tested against a real old save blob.

## Recipe to resume Playwright smoke-testing in a new session

```bash
cd /Users/connorrowe/projects/cozy_sprites
npx vite --port 5199 &   # or check if already running: curl -s localhost:5199
# driver scripts should import playwright-core directly, e.g.:
#   import { chromium } from "/Users/connorrowe/projects/cozy_sprites/node_modules/playwright-core/index.mjs";
#   chromium.launch({ channel: "chrome", headless: true })
# Seed state with context.newPage() + page.addInitScript(...) BEFORE goto(),
# never by editing localStorage on an already-running page and reloading it.
```
