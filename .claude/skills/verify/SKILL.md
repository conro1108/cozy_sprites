---
name: verify
description: Build, launch, and drive Cozy Sprites in a real browser to verify changes end-to-end.
---

# Verifying Cozy Sprites

1. `npx vite --port 5199` (background). App at http://localhost:5199/.
2. Drive with playwright-core (already a devDependency, no browser download needed):
   `chromium.launch({ channel: "chrome", headless: true })`, viewport ~400×780.
   Node resolves `import "playwright-core"` from the *script's own directory*
   upward, not the shell's cwd — write/run the driver script from inside this
   project (e.g. a temp `.mjs` file here, deleted after), not from a scratchpad
   path elsewhere.
3. Seed game state directly — write a full `PetState` JSON to localStorage key
   `cozy-sprites-pet`, then `page.reload()`. See `src/pet/types.ts` for the shape
   and `src/pet/state.ts` `createPet()` for defaults. Farm: `cozy-sprites-farm`.

## Gotchas
- **Seeding race**: if a live pet is on screen, reloading fires `visibilitychange`
  → `commit()` → the game re-saves the current pet *over* your seed. Reload to a
  petless/hatch state first (or seed before the first pet exists), then seed.
- Speech is throttled by chattiness (`shouldSpeak`); to force a bubble use an
  ALWAYS_SPEAK path (e.g. Clean with `poops: 0` → clean_nothing commentary).
- Stage timers are demo-paced (`TIMING` in state.ts): egg hatches in 60s, so a
  seeded egg stays an egg only briefly.
- Wander/act state lives in the canvas scene; sample `[data-bubble]` /
  `[data-attn]` inline styles to check anchor tracking, screenshots for the rest.
