# Pet Thing — Implementation Plan (Draft v0.1)

## Phase 0 — Foundation
*Goal: the boring stuff everything else depends on, done once.*
- Persistence layer: IndexedDB wrapper + anonymous device ID generation
  (SPEC §6). Everything downstream needs somewhere to read/write state.
- Core game-loop architecture: tick-based stat decay engine (hunger/
  happiness/health/age/weight), independent of any UI.
- Pixel-canvas rendering shell: low-res internal canvas, nearest-neighbor
  upscale, full-height mobile layout, safe-area insets, portrait-first,
  desktop centering.
- Test harness (Vitest pairs naturally with the existing Vite scaffold) —
  wired up now so stat/evolution logic gets unit tests as it's written
  rather than bolted on later.

## Phase 1 — Vertical slice: Egg → Baby
*Goal: prove the feel before investing in content breadth.*
- Egg + Baby life stages only, with real timers (5 min / 30 min).
- Hunger, Happiness, Health, Discipline stats wired to the decay engine.
- Bottom-nav overlay shell (all six buttons) with Feed (one item), Clean,
  Light, Status functional.
- Dialogue delivery system (speech bubble, cooldown, dismiss-on-tap) — built
  early even with placeholder lines, since it's core to whether the pet
  *feels* alive.
- Tap-the-pet interaction + annoyance-at-repeated-tapping.

This phase is the one to actually play and gut-check before going further —
if the core loop isn't fun at this size, nothing downstream fixes that.

## Phase 2 — Full life cycle, single adult path
*Goal: prove the evolution pipeline end-to-end before multiplying content.*
- Extend the state machine through Child → Teen → Adult.
- Hidden evolution scoring (care mistakes, discipline, cake consumption,
  most-played game) — built against **one** target adult first, to validate
  the whole pipeline before it has to fan out to the full roster.
- Full 5-item food system, Higher/Lower + Fetch (the two lowest-risk games),
  Discipline action.
- Adult's three soft phases (young/mature/elder) as time-gated dialogue/
  animation unlocks.

## Phase 3 — Content breadth
*Goal: turn the one proven adult into the full roster.*
- Remaining adults, each with distinct visuals, idle animations, favorite/
  disliked food, game preference.
- Rock/Paper/Scissors, Hide and Seek, Would You Rather.
- Real dialogue-writing pass per character (SPEC §13 is inspiration, not
  copy — this is where it gets actually written).
- Room ambient behaviors, Farm archive gallery + Send to Farm flow.

## Phase 4 — Systems & mystery polish
*Goal: the stuff that makes it feel "observable, not documented."*
- Help screen copy (vague-but-useful), collection clues screen.
- Sickness/medicine system (currently underspecified in SPEC — needs its
  own mini-pass here).
- Backup/export mechanism (resolves the passphrase-vs-file question).
- Secret characters (Ghost, Cube Being), any fully-hidden stat(s), and the
  carrot/stick discipline variant from SPEC §15, if you two land on wanting
  them in.

## Phase 5 — PWA hardening
*Goal: make the web app installable and offline-capable — a day-one web
requirement even before touching native.*
- Service worker + offline caching, manifest/icons/splash, "add to home
  screen" flow.
- Performance pass (load time, asset budget).
- Real-device testing across phone sizes/notches.

---

## Follow-up bucket (deliberately light): Notifications + iOS
- Character-voiced push notifications (SPEC §8) — Web Push if
  browser-only, or native push once wrapped.
- Thin native wrap (e.g. Capacitor) reusing the Phase 0–5 web build as-is —
  no separate app logic.
- App Store packaging (icons, screenshots, privacy disclosure for the local
  anonymous ID).
- Android wrap as a near-free extra once the iOS shell pattern exists.
