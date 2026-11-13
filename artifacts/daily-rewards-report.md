# Bunoku Daily access and rewards implementation

Implemented locally on 2026-11-13. Nothing was committed, pushed or deployed.

## Behavior

- Daily remains visible with a lock, ten progress segments and completed-level count. Existing saved normal level minus one supplies completed levels; saved Level 11 unlocks Daily.
- Generation must succeed before claiming an attempt. The claim is saved immediately before entering the game, with a second eligibility check and a Web Lock where supported. Duplicate clicks do not generate multiple attempts. Failure to generate/save consumes no playable attempt.
- A claimed Daily has a 24-hour cooldown. The menu countdown survives reload. Daily Restart/Next cannot replay the attempt; normal Restart/Next remain unchanged. Daily end screens also show the countdown.
- A separate versioned record tracks five lifetime free Hints and five lifetime free Undos, then independent earned credits. Only a real hint preview or Undo spends a use. Invalid/no-op actions do not spend; Undo, Restart and level changes do not refund uses. Repeating the already-highlighted hint does not spend again.
- Exhausted free allowances add a small video icon to the existing controls. They never request an ad. If no credits remain, the existing feedback area points to Rewards in the main menu.
- Rewards offers three Hint OR three Undo credits for one optional rewarded ad. Continue without an ad has the same size, font and colors as reward buttons. Offers follow completion of at least one puzzle, so new players experience gameplay before advertising. A saved 60-second offer cooldown prevents rapidly chaining reward offers.
- Only CrazyGames SDK v3 `ad.requestAd('rewarded', callbacks)` is used. Requests are blocked during active gameplay/loading and while another request is pending. Only a started ad followed by adFinished can grant credits. Duplicate callbacks, errors, rejected calls, disabled SDK and cancelled/unfilled outcomes grant nothing.
- Ad audio mute is independent of platform mute and saved player preferences. It starts only on adStarted and is removed on terminal callbacks. Gameplay reporting resumes according to existing active sessions. The SDK owns the pending request until a terminal callback; no unsafe timeout lets a late ad interrupt resumed gameplay.

## Files changed in this task

Existing production files:

- `PRD.md`: document the approved limits/reward behavior and persistence limits.
- `src/App.tsx`: Rewards navigation, Daily eligibility and persistent claim at actual start.
- `src/App.css`: compact progress, lock/video icons and Rewards styling using existing palette/buttons.
- `src/audio.ts`: independent ad mute override.
- `src/crazygames.ts`: guarded, deduplicated rewarded callback integration and cleanup.
- `src/components/MainMenu.tsx`: Daily indicator and Rewards entry.
- `src/components/GameScreen.tsx`: actual-use spending, exhausted icons/messages and Daily replay protection.
- `src/translations.ts`: new interface text in Spanish, Arabic and Hindi as well as default English source text.

New production files:

- `src/game/allowances.ts`: persistent ledger, validation, allowance/reward operations, clock handling and countdown formatting.
- `src/useAllowances.ts`: live balance/countdown updates and cross-tab storage notifications.
- `src/components/DailyAccess.tsx`: lock/progress/countdown UI.
- `src/components/Rewards.tsx`: separate opt-in reward screen.
- `src/components/RewardIcon.tsx`: reusable video icon.

Tests/support:

- New `tests/allowances.test.mjs`.
- Updated `tests/crazygames.test.mjs`, `tests/level1-tutorial.test.mjs`, `tests/keyboard.test.mjs`.
- New `artifacts/rewards-test-server.mjs` supplies isolated browser profiles and explicit mock SDK callback scenarios. This instrumentation is never included in production output.
- Backups: `backups/before-daily-rewards-20261113-005105/`.
- This report and regenerated ignored `dist/` output.

Earlier uncommitted SDK integration changes in index.html, main.tsx, puzzleClient.ts and the asset-path test remain present; this task did not revert them.

## Actual test results

- Production build passed. All 43 automated tests passed, including all existing regression tests. `git diff --check` passed.
- Deterministic persistence tests: before/after completing Level 10; exact 24-hour boundary; duplicate Daily claim rejection; reload; five uses per action; independent credits; duplicate reward rejection; 60-second offer cooldown; clock rollback plus elapsed time; corrupt records and blocked saves.
- Actual GameScreen handlers tested: no charge for empty Undo, exactly five real Hint previews and Undos, sixth blocked, no refund after Restart/reload, paid credit spending, and no Daily replay through Restart.
- SDK callback tests: one request/reward despite duplicate calls, mute only after adStarted, no grant on unfilled/error/cancelled/rejected/disabled outcomes, failed-save handling, gameplay recovery, and independent restoration of platform/player audio preferences.
- Browser prepared profile with saved Level 7: Daily visibly locked at 6/10.
- Browser prepared profile with saved Level 10: completed the actual generated Level 10 puzzle using visible logical deductions; Daily unlocked automatically. Started its actual 81-cell puzzle, marked a cell, verified Restart did not clear it, returned to menu and refreshed; countdown and lock persisted.
- Browser real controls: five Hints and five Undos used on normal gameplay, sixth uses blocked; Rewards showed 0 free uses for both. Reload did not replenish them.
- Browser explicit mock SDK scenarios: Hint completion granted exactly 3 Hint credits despite duplicate adFinished; persisted across reload; one actual Hint spent a credit, leaving 2. Undo completion granted exactly 3 Undo credits. Simulated adsDisabled returned an explanation and granted nothing.
- Browser real official SDK local environment: first-puzzle offer gate verified, completed the actual Level 1 puzzle, requested the SDK's local rewarded simulation, saw its test overlay, received 3 Undo credits, and navigated normally afterward. An earlier local simulation also verified the Hint reward. No captured console warnings/errors.
- Browser 360×800: menu and Rewards had no horizontal overflow or clipped buttons; reward/continue controls were measured at the same width, height, font size and background color. No physical mobile-device test was performed.
- Temporary localhost server stopped and no listener remained on port 5198.

## Limits and remaining platform verification

- This project still uses its existing local saving model. CrazyGames Data/cloud saving is not configured in the portal and has not been enabled or claimed. Allowances and timestamps persist for the browser save; they are not an authenticated cross-device lifetime entitlement.
- Saved high-water time plus monotonic elapsed session time prevents simple clock rollback from resetting the cooldown. Without trusted server time, deliberate clock jumps across reloads cannot be secured. Clearing/editing browser storage can reset/tamper with local saves.
- Web Locks serialize Daily claims across tabs where supported. LocalStorage is not a transactional cross-device service; concurrent balances on separate devices are not protected.
- SDK callback behavior, actual ad availability/Basic Launch configuration, and cloud/time guarantees still need CrazyGames Preview/platform testing. Local simulation and mocked error cases are not proof of actual CrazyGames Preview compatibility.
