# Cozy Sprites 🥚

A mobile-first, cozy pixel-art virtual pet. Classic Tamagotchi-style care
mechanics underneath, a dry / slightly cursed personality layer on top.

Raise an egg through **baby → child → teen → adult**. How you care for it —
what you feed it, which games you play, how you discipline it, whether you let
it sleep — quietly steers which of ten adult personalities it becomes. You're
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

- **Care loop**: energy, happiness, health, discipline, weight, sickness,
  poop, attention calls, and a real day/night sleep cycle.
- **6 foods** (burger, cake, carrot, salad, soup, cube) across healthy /
  neutral / treat tiers, and **6 mini-games** (Higher/Lower, Fetch,
  Rock-Paper-Scissors, Hide & Seek, Would You Rather, the Cube's Hum).
- **10 adult forms** — 6 standard, 3 earnable secrets, and 1 double-secret
  that's pure luck — each with distinct pixel art, favourite/disliked food,
  preferred game, and its own dialogue voice.
- **Retirement**: adults age toward a peaceful send-off (restless → ready →
  walked, or left, to the farm) rather than dying of old age.
- **Collection & Farm archive** (retirees roam a little paddock scene), an
  export/import backup code, optional browser notifications, a day/night
  festival easter egg, and tiny WebAudio chiptune sound effects.

## Layout

- `src/pet/` — pure, DOM-free game logic (unit-tested): `state.ts` (engine),
  `evolution.ts`, `roster.ts`, `dialogue.ts`, `games.ts`, `persistence.ts`,
  `names.ts`.
- `src/render/` — pixel-art renderer: `sprites.ts` (creature art),
  `scene.ts` (the cozy room + animation loop), `props.ts`, `icons.ts`.
- `src/ui/` — overlay screens, the mini-games UI, `audio.ts` (sound),
  `notifications.ts`, `festival.ts`.
- `src/main.ts` — orchestration (tick loop, action wiring).

> The pet lives on the **real wall clock**, not a compressed demo timer — see
> the file header of `src/pet/state.ts` for the day/night and pacing rules,
> and `TIMING` for how long each stage actually takes.
