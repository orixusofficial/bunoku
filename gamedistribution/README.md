# Bunoku — GameDistribution

The public GameDistribution Game ID supplied by the developer is stored in
`game.config.json`. It is not an API key. Production builds reject an absent or
malformed ID instead of inserting a sample ID.

- Build: `npm run build:gamedistribution`
- Output: `D:\bunoku\dist-gamedistribution` (upload its contents, with index.html at the root)
- Local development: `npm run dev -- --mode gamedistribution`
- Preview: `npm run preview -- --mode gamedistribution`
- Tests: `node --test tests/*.test.mjs`

The entry initializes the official HTML5 SDK once using GD_OPTIONS, before
importing the game. A blocked/offline SDK falls back to ordinary play without
ads. SDK_GAME_PAUSE mutes audio and blocks input; SDK_GAME_START resumes play
without changing the player's Music or Sound Effects preferences.

Pre-roll is requested from the player's normal/Daily Play action. Existing Menu,
Restart confirmation and Next actions provide natural mid-roll breaks. These
calls are made in the user-input task, with no custom ad-frequency timer. The
SDK alone controls whether an ad actually appears.

Rewarded preload does not grant anything. A pending, started rewarded request
can grant exactly three selected credits only on SDK_REWARDED_WATCH_COMPLETE.
Promise resolution, SDK_GAME_START, early closure and errors never grant credits.
The existing allowance ledger persists balances locally and does not auto-use a
reward. This edition does not use Playgama Bridge storage or CrazyGames SDK.

The target reuses existing portal UI/audio utilities through normalized module
aliases, with its own SDK, storage adapter, entry and privacy text. The two build
flags select shared portal behavior without source-text transformations. Neither
other build loads this SDK. No extra package was added.

## Manual dashboard and iframe checks

1. Enable the game's **Rewarded Ads** flag in the GameDistribution dashboard.
2. Verify the Game ID matches the dashboard and test in its actual developer iframe.
3. Test real filled/unfilled/closed rewarded videos, audio restoration, consent
   dialogs and pre-/mid-roll frequency. Local stub callbacks do not verify live ads.
4. Follow the platform's current upload/review requirements manually. This work
   does not upload, publish or modify the dashboard.

Official references:
- https://github.com/GameDistribution/GD-HTML5/wiki/SDK-Implementation
- https://github.com/GameDistribution/GD-HTML5/wiki/Rewarded-Ads

## Files added or updated for this target

Added:
- `gamedistribution/index.html`, `game.config.json`, `README.md`
- `src/gamedistribution/main.ts`, `platform.ts`, `storage.ts`, `build.d.ts`, `PrivacyPolicy.tsx`
- `build/gamedistribution.ts`
- `tests/gamedistribution.test.mjs`

Updated:
- `package.json`, `vite.config.ts`, `.gitignore`
- Shared compile-time portal guards in `src/App.tsx`, `src/audio.ts`, `src/i18n.ts`,
  `src/components/GameScreen.tsx`, `src/components/HowToPlay.tsx`,
  `src/game/allowances.ts`, `src/game/keyboard.ts`, `src/game/levels.ts`, and `src/game/tutorial.ts`.
  App also supplies GD-only user-triggered pre-roll hooks.

Verification: 124 tests passed (105 existing + 19 GD tests). The standard build's
25 files and Playgama's 34 files remained byte-identical. A Playgama build in
memory matched all 14 generated files without rewriting its output directory.
Real ad delivery, platform consent and device behavior still require the actual
GameDistribution developer iframe. No dashboard changes or uploads were made.
