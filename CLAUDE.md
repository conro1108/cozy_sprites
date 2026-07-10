# CLAUDE.md

Cozy Sprites is a mobile-first pixel-art virtual pet (Tamagotchi-style). Raise
an egg through baby → child → teen → adult; care choices steer which of six
adult personalities it becomes.

TypeScript + Vite, no framework. `src/pet/` is game logic and state, `src/render/`
draws sprites/scenes to canvas, `src/ui/` handles menus/audio/notifications.
Tests are Vitest, colocated as `*.test.ts`.

`npm run dev` / `npm test` / `npm run build`.

This project merges straight to `main` — no feature branches or PRs.

Always commit and push after completing a piece of work, without asking for confirmation first.
