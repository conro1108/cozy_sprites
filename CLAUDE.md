# CLAUDE.md

Cozy Sprites is a mobile-first pixel-art virtual pet (Tamagotchi-style). Raise
an egg through baby → child → teen → adult; care choices steer which of ten
adult personalities it becomes (six standard, three earnable secrets, one
pure-luck double-secret).

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

## No live data migrations

Don't add backward-compat handling for old `PetState` shapes (e.g. `field ??
default` patterns in `persistence.ts` for newly-added fields). Export/import
is the only persistence boundary and is treated as atomic — there are no
in-flight saves on an old schema to upgrade. When adding a field, just add it
to the type and to `createPet`; skip the migration shim.

Always commit and push after completing a piece of work, without asking for confirmation first.
Always `git pull` before pushing, in case downstream changes have landed —
this is still single-threaded on `main`, just cheap insurance.
