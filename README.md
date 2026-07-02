# Cozy Sprites 🥚

A mobile-first, cozy pixel-art virtual pet. Classic Tamagotchi-style care
mechanics underneath, a dry / slightly cursed personality layer on top. Built
from `SPEC.md`.

Raise an egg through **baby → child → teen → adult**. How you care for it —
what you feed it, which games you play, how you discipline it, whether you let
it sleep — quietly steers which of six adult personalities it becomes. You're
not told the formula; you learn it by playing.

## Run it

```bash
npm install
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build
npm run preview    # serve the production build
```

Open the dev URL on a phone (or use your browser's device emulation) for the
intended portrait experience. It also installs as a PWA and works offline
after the first visit.

## What's in the box

- **Care loop**: hunger, happiness, health, discipline, weight, sickness,
  poop, day/night sleep.
- **5 foods** (burger, cake, carrot, noodles, cube) and **5 mini-games**
  (Higher/Lower, Fetch, Rock-Paper-Scissors, Hide & Seek, Would You Rather).
- **6 adult forms**, each with distinct pixel art, favourite/disliked food,
  preferred game, and its own dialogue voice.
- **Collection & Farm archive**, plus an export/import backup code.

## Layout

- `src/pet/` — pure, DOM-free game logic (unit-tested): `state.ts` (engine),
  `evolution.ts`, `roster.ts`, `dialogue.ts`, `games.ts`, `persistence.ts`.
- `src/render/` — pixel-art renderer: `sprites.ts` (creature art),
  `scene.ts` (the cozy room + animation loop).
- `src/ui/` — overlay screens and the mini-games UI.
- `src/main.ts` — orchestration (tick loop, action wiring).

> Life-stage timers are **compressed for demo play** (whole arc in minutes).
> See `TIMING` in `src/pet/state.ts` for the spec-accurate values.
