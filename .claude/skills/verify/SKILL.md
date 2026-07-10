---
name: verify
description: Quick sanity check for Cozy Sprites — typecheck, build, and unit tests. No browser.
---

# Verifying Cozy Sprites (light)

1. `npm run build` — `tsc` typecheck + Vite build. Catches most breakage.
2. `npm test` — Vitest unit tests.

That's it — no browser, no screenshots. This is the default.

For changes that need to actually be *seen* to confirm they're right, the
`verify-full` skill drives a real headless browser — but it's much more
expensive (screenshots burn a lot of tokens), so ask before reaching for it
rather than deciding unilaterally.
