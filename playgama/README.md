# Bunoku — Playgama build

- `npm run build:playgama` produces `dist-playgama/`.
- `npm run dev -- --mode playgama` runs the Playgama development entry.
- `npm run preview -- --mode playgama` previews the production output.
- `npm run build` remains the standard CrazyGames/Vercel build in `dist/`.
- `node --test tests/*.test.mjs` runs the game and SDK adapter tests.

The Playgama entry loads the locally bundled official Bridge SDK, initializes it,
and hydrates all save keys before importing React and the game. Bridge selects
platform/cloud storage where supported; localhost tests do not verify real cloud
synchronization.

The build plugin substitutes platform modules and emits Bridge configuration and
its license. It never rewrites component source. Explicit shared integration
branches use `globalThis.BUNOKU_PLAYGAMA`, replaced with `false` in the standard
build so those branches and their imports are removed from its output.

Interstitials are requested at existing menu/restart/next-level breaks, without a
custom frequency timer. Rewarded credits are granted only on Bridge's `rewarded`
state; `closed` or `failed` alone grant nothing. Existing Hint/Undo accounting
still grants three independent uses and never spends them automatically.

Before release, test real rewarded/interstitial ads, host pause/audio events,
and cross-session/cross-device cloud saving inside the actual Playgama host.
Automated SDK tests use simulated events and are not proof of live ad delivery.
