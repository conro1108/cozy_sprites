# agent_exec.md — internal build log

One-shot build of the "Pet Thing" (working title: **Cozy Sprites**) from SPEC.md + PLAN.md.

## North star
- Mobile-first pixel pet. Scene fills ~80% of viewport. Feels like an app, not a website.
- **Cute pixel-art visual style à la Stardew Valley** — warm cozy palette, crisp
  nearest-neighbor sprites, a little room. This is the thing to get right.
- Tamagotchi care loop underneath + a dry/cursed personality layer on top.

## Scope decisions for the one-shot (recorded)
- **Timers are demo-tuned, not spec-tuned.** Spec wants Egg 5min / Baby 30min /
  Child+Teen 24-48h. That means nobody sees an adult in a play session. I use a
  compressed `TIMING` table by default so the whole Egg→Adult arc is reachable in
  minutes, with the real spec values kept in a comment. One constant to swap.
- **Roster: 6 adults** (the spec's recommended v1 scope), full evolution pipeline.
  Each: distinct pixel sprite (palette + shape), favorite/disliked food, preferred
  game, dialogue voice. Cut from the 8: Sleepy Moon-style secrets/Flower deferred
  where needed — final 6 chosen in roster.ts.
- **All 5 foods, all 5 games** (Higher/Lower, Fetch, RPS, Hide & Seek, Would You
  Rather), Clean, Medicine, Discipline, Light/sleep.
- **Sickness**: simple model — risk rises from low health / too much cake /
  uncleaned poop; medicine cures.
- **Persistence**: localStorage + export/import save string + farm archive.
  (Spec wants IndexedDB; localStorage is fine for v1, export covers the backup ask.)
- **Secret adults (Ghost / Cube Being)**: stretch, include if time.
- **PWA**: manifest + theme; service worker only if cheap.

## Architecture
- `src/pet/` pure logic (no DOM, unit-tested):
  - `types.ts`, `state.ts` (stats/decay/actions/lifecycle/poop/sickness),
    `evolution.ts` (hidden scoring → adult), `roster.ts`, `dialogue.ts`,
    `games.ts`, `persistence.ts`.
- `src/render/` canvas pixel rendering: `sprites.ts` (sprite data + palettes +
  pixel draw), `scene.ts` (room + pet + poop + anim loop).
- `src/ui/` overlays (status/food/play/care/help/collection), nav, speech bubble.
- `src/main.ts` wiring.

## Progress
- [x] Read spec/plan, inspect scaffold.
- [x] Core logic modules + tests (36 tests green): types, state, evolution,
      roster, dialogue, games, persistence.
- [x] Pixel sprite renderer + cozy room (verified via headless renders — cute).
- [x] UI shell, nav, 6 overlays, all 5 games wired.
- [x] Wire main, persistence, export/import, PWA (manifest + icons + SW).
- [x] Sonnet review pass #1 (mid-build) — fixes applied (see below).
- [x] Sonnet review pass #2 (final) — fixes applied (see below).

## Verification
- tsc + `npm run build` clean; `npm test` 36 passing.
- Rendered real sprites + room to PNG via vite-node (creatures distinct/cute;
  room reads cozy day & night). Headless-Chrome screenshots of hatch + in-game
  confirm layout (a "clipping" scare turned out to be a headless viewport
  artifact — measured doc==win, no real overflow).

## Review notes
### Mid-build (Sonnet, principal-engineer) — addressed
- HIGH: decay applied one stage's multiplier across a stage boundary (egg's 0×
  meant a gap spanning hatch decayed nothing). → Rewrote applyElapsedDecay to
  process elapsed in per-stage chunks (decaySegment + advanceOne). Added a
  regression test.
- MED: Fetch mini-game leaked a requestAnimationFrame loop if the panel was
  closed mid-throw. → Added Panel.onClose cleanup hook; fetch cancels its rAF.
- LOW: visibilitychange resume didn't persist. → now calls commit().
- LOW (noted, left as scope): needsCare() helper unused; baby daytime nap from
  SPEC §4 not implemented (sleep is night/lights-only).

### Final (Sonnet, principal-engineer) — addressed
- HIGH: hatch/evolve fanfare was skipped when a stage boundary was crossed
  while backgrounded (boot + visibilitychange decayed directly, only tick()
  detected transitions — and mobile freezes JS on background). → Factored a
  shared stepPet(now, withEvents) that detects transitions + fires
  handleStageChange; used by tick, cold boot (mount-then-catch-up), and
  foreground resume.
- LOW: adult first-line setTimeout could deref null if farmed within 700ms.
  → guarded with if (pet).
- LOW: importSave accepted well-formed-but-wrong-shape blobs. → added
  isValidPet shape check; bad paste now returns "Invalid code".
- Reviewer confirmed the chunked decay loop is bounded (≤5 iters), the ctx/menu
  wiring is consistent, games can't double-fire, and the core loop matches SPEC.
