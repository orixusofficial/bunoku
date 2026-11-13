# Bunoku asset-path verification — 2026-11-13

The actual risk was hosting-directory portability, not iframe embedding by itself. URLs beginning `/bunny/`, `/audio/`, `/favicon.svg`, and Vite's default `/assets/` resolve at the child document's origin root. They work on the current root-hosted Vercel site but can escape a nested game package directory. Nunito also depended on two external Google domains. SVG internal fragment references and the existing worker URL were already correct.

Changed production files:

- `vite.config.ts`: relative build base (`./`).
- `index.html`: favicon follows Vite's base. The source entry script remains Vite-managed; the built script and stylesheet URLs are relative.
- `src/assetUrl.ts` (new): shared base-aware public asset resolver.
- `src/audio.ts`: only music/effect URL construction uses the resolver. Playback, volume, toggles, timing and instances are unchanged.
- `src/components/MainMenu.tsx`, `src/components/HowToPlay.tsx`, `src/components/GameScreen.tsx`: only image URLs and the resolver import changed.
- `src/index.css`: replace external font import with a local Nunito variable face covering weights 400–800.
- `src/assets/fonts/Nunito-Variable.ttf` (new): official Nunito font from `https://github.com/google/fonts/blob/main/ofl/nunito/Nunito%5Bwght%5D.ttf`.
- `public/fonts/Nunito-OFL.txt` (new): official SIL redistribution license, included in the built package.

Test/support files:

- Updated `tests/levels.test.mjs` expected audio URLs and the asset resolver mocks in `tests/how-to-play.test.mjs`, `tests/keyboard.test.mjs`, `tests/level1-tutorial.test.mjs`.
- Added `tests/asset-paths.test.mjs` to check root/nested/configured bases and portable production entry/font/worker references.
- Added `artifacts/asset-check-server.mjs` and `artifacts/check-asset-responses.mjs` as repeatable verification tools. Test HTML instrumentation is injected only by the temporary server, never into production files.
- Added this report and `artifacts/assets-local-responses.json`, `artifacts/assets-vercel-responses.json` with individual response results.
- Backed up all 11 edited existing files under `backups/before-portable-assets-20261113-001654/` before editing.
- Rebuilt ignored `dist/` output.

Actual tests:

1. `npm run build` passed. `node --test tests/*.test.mjs` passed all 31 tests. `git diff --check` found no whitespace errors.
2. Browser asset-decoding page at a nested directory: all seven public SVGs loaded with nonzero natural dimensions; all twelve MP3s reached readyState 4 with no media errors; local Nunito loaded and samples rendered at weights 400, 500, 600, 700, 800.
3. Built game at root hosting: Main Menu, How to Play and Level 1 opened; displayed images loaded; worker generated the board; no captured console warnings/errors.
4. Built game inside a cross-origin iframe: parent `http://localhost:5197/frame.html`, child `http://127.0.0.1:5197/package/bunoku/`, sandbox allowing scripts/same-origin/modals and autoplay permission. Normal Play generated 16 cells and Daily Puzzle generated 81. Bunny, whole/eaten carrots and tutorial imagery loaded. A correct rabbit and an incorrect placement exercised the existing image/animation states. All recorded game audio requests remained inside `/package/bunoku/audio/`; actual media play events were observed for music, entery, Xon, Xoff, foundbunny, nice and failbite. Music reported volume 0.05 and loop true. Other sounds were decoded by the asset page, not individually exercised through every end-game/combo event. No captured console warnings/errors.
5. Local nested HTTP checks: 25 successful responses, including all public assets, license, entry, JS/CSS, worker and bundled font. Existing public asset bytes matched originals using SHA-256.
6. Current Vercel deployment: 29 successful responses, including all 19 original public assets, entry, JS/CSS, worker, external Google stylesheet and five current font files. All existing image/audio asset bytes matched local originals using SHA-256. Browser opened the menu and Daily Puzzle with 81 cells, all displayed images loaded, and no captured console warnings/errors. The Music setting was returned to OFF after testing.
7. Diff check confirmed no changes to `src/game/`, `src/App.tsx`, `src/App.css`, existing `public/bunny/` assets or `public/audio/` files. Temporary server was stopped; no listener remained on port 5197.

Limitations: the patched build has not been deployed to Vercel; Vercel results describe its existing deployment. The local nested iframe validates the portability fix, but this is not an actual CrazyGames upload or platform test. No SDK or gameplay changes were made. No physical mobile-device test was performed for this asset-only task.
