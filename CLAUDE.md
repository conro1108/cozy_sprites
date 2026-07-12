# CLAUDE.md

Cozy Sprites is a mobile-first pixel-art virtual pet (Tamagotchi-style). Raise
an egg through baby → child → teen → adult; care choices steer which of six
adult personalities it becomes.

TypeScript + Vite, no framework. `src/pet/` is game logic and state, `src/render/`
draws sprites/scenes to canvas, `src/ui/` handles menus/audio/notifications.
Tests are Vitest, colocated as `*.test.ts`.

`npm run dev` / `npm test` / `npm run build`.

## Sprite rendering — hard rule

Never draw sprite art with non-integer `ctx.scale()`/`ctx.rotate()` — on the
tiny scene buffer that resamples the 16×16 art off the pixel grid (unequal
eyes, outlines that double or vanish, sheared pixels). All creature
deformation (squash/tilt/flip) goes through `drawSpriteQuantized` in
`src/render/scene.ts`; read its docblock before changing animation or adding
draw paths. Squash must *thin* rows (±1px), never drop whole rows — 1px
features disappear otherwise. Unit tests can't catch visual regressions here:
verify rendering changes with the `verify-full` skill (headless browser
screenshots) before calling them done.

This project merges straight to `main` — no feature branches or PRs.

Always commit and push after completing a piece of work, without asking for confirmation first.
