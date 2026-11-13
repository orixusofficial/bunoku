# Bunoku submission fixes — 13 November 2026

## Implemented
- Rewards are confined to the menu Rewards screen. Depleted gameplay controls show an informational notice; they do not navigate to an automatic ad request.
- Players select Hint or Undo, then explicitly choose Watch Ad or the equally styled Continue without an ad control. Successful, started ads grant exactly 3 corresponding credits; nothing is consumed automatically. Duplicate callbacks and requests remain guarded.
- adsDisabled/adblock suppress further session offers; adCooldown suppresses offers for 60 seconds; saved reward cooldown hides the watch CTA. Other failures show a friendly unavailable message. Audio mute remains tied to adStarted and restored on terminal callbacks without altering preferences.
- Daily saves the original verified puzzle, board, lives, failure carrots, Undo board/failure history, hint preview/used hints and combo count. Initial save and cooldown timestamp share the same local ledger write. Resume opens the same unfinished attempt before any generation. Finished attempts cannot be reopened by stale saves.
- SDK v3 user.systemInfo.locale initializes language only when there is no saved valid preference. English fallback and all four language choices remain supported. Manually selecting the current language now also persists the preference.
- Short desktop Rewards screens use compact spacing and omit decorative art so consent/skip remain visible. The puzzle board uses more of the available short-frame height.

## Files
Modified: PRD.md; src/App.tsx; src/App.css; src/components/GameScreen.tsx; src/components/DailyAccess.tsx; src/components/Rewards.tsx; src/game/allowances.ts; src/crazygames.ts; src/i18n.ts; src/main.tsx; src/translations.ts.
Added: src/game/dailyState.ts.
Updated tests: tests/allowances.test.mjs; tests/crazygames.test.mjs; tests/level1-tutorial.test.mjs; tests/rewards-flow.test.mjs.
Added tests: tests/daily-save.test.mjs; tests/locale.test.mjs.
Test artifacts: artifacts/final-test-server.mjs; artifacts/final-daily-layout.png; this report.
Backup: backups/before-submission-fixes-20261113/.

## Verification
- Final production build passed. All 54 automated tests passed. git diff --check passed.
- Automated tests cover Daily partial progress/history reload, cooldown persistence, no replacement of unfinished attempts, terminal-state protection, invalid/blocked saves; supported SDK locale variants and saved manual overrides; independent three-credit grants, explicit consent, duplicate/error guards; adsDisabled, adblock, adCooldown, unfilled, rejected SDK initialization and audio recovery. Existing engine, tutorial, keyboard and progression tests pass.
- Local production build browser test: real generator produced 9x9 Daily. A manual X survived refresh; all 81 region identities matched the original. Main Menu displayed Resume puzzle, and return restored the same attempt.
- Browser ad tests used isolated SDK callback fixtures, not real advertisements: duplicate adFinished callbacks granted only 3 Hint credits, then only 3 Undo credits. Credits survived reload. The game buttons showed 3 each; manual Hint and Undo use reduced the appropriate count to 2. A simulated adsDisabled response granted 0, hid Watch Ad, and allowed normal Level 11 gameplay and keyboard marking. No captured warning/error logs in these local flows.
- Local 9x9 board geometry checked at requested 907x510, 821x462 (browser rounded width to 822), 1440x900, 390x844 and 768x1024, DPR approximately 1. No horizontal overflow or clipped controls; board and controls fit the viewport. Rewards checked at short desktop and 360x800; no overflow after compact rules. Saved screenshot shows tablet layout, not 907x510.
- Live Vercel menu and normal Level 2 opened at 907x510, DPR 1. Live script is index-Cxp1wRq1.js (the preceding build). These new fixes are local only. Nothing pushed or deployed.
- Temporary local server stopped; created test tabs closed and viewport reset.

## Remaining verification and limitations
- Real CrazyGames Preview/Basic Launch, real adblock extensions and physical offline network changes were not tested. Automated mocks simulate their SDK outcomes; they do not certify portal behavior.
- The SDK exposes no documented preflight Basic Launch ad-availability flag in this integration. A first explicit opt-in may receive adsDisabled; subsequent offers are hidden for that session. Confirm portal behavior in Preview.
- Fully offline cold-start hosting is not implemented. Offline SDK failure is nonfatal once the game/assets are available; a fresh visit still needs network or browser cache.
- Actual ad playback, physical touch devices, Safari/Edge, locale supplied by the portal, and audible ad/music mixing still need manual Preview/device checks. No native translation-language review was performed.
- Storage is browser-local, not authenticated cloud storage. Clearing data removes it; intentional clock manipulation and competing progress edits across tabs are not server-secured. Active attempts from the older build cannot be recovered because that build never saved their boards.
