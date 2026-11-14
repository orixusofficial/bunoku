# Bunoku — Poki build

This is an isolated Poki entry and build. It reuses Bunoku's shared puzzle UI,
game engine, local save format, audio preferences and existing reward ledger.
Poki-specific SDK calls are contained in `src/poki/platform.ts` and selected by
`build/poki.ts` module aliases.
The build enables the existing portal hooks using the legacy
`BUNOKU_PLAYGAMA` compile flag, but aliases the actual SDK and storage modules
to Poki. No Playgama runtime or other platform SDK is included. The shared
GameScreen and App have no Poki-specific changes. A Poki-only GameScreen
wrapper suppresses ads on menu exits.

## Build and preview

```sh
npm run build:poki
npm run preview -- --mode poki
```

The production output is `dist-poki/` with `index.html` at its root. The SDK
script is the official HTML5 URL from Poki's documentation. No game ID or API
credential is required by this SDK integration.

## Integration details

- Initialization uses `PokiSDK.init()`; failure or an unavailable script is
  non-fatal and Bunoku continues without Poki services.
- `gameLoadingFinished()` runs once after the app is mounted.
- Gameplay start/stop is balanced for active play, pauses, dialogs, ads, menu
  navigation, puzzle completion and failure.
- Optional Hint/Undo ads call `rewardedBreak()` only from the player's clearly
  labeled action. Exactly three credits are granted only when the SDK promise
  resolves `true`; a false result or error grants nothing.
- Commercial breaks use `commercialBreak()` at existing restart and next-level
  transitions. Menu exits do not request ads. Poki determines ad frequency.
- An optional Poki-only offer shows a standard continuation above a non-green
  video reward button, with equal button sizes. The adapter receives the
  reward identity through the existing control diagnostic hook.
- Input is disabled and Bunoku audio is muted while an ad is pending/playing;
  audio and gameplay resume after the SDK promise settles.
- Existing local progress and user audio preferences remain in browser storage.

## Manual testing

Use the official Poki Inspector to validate SDK events, device behavior and
real advertising. Local unit tests use a mocked SDK and do not establish that
real ad inventory is available. Uploading, review requests and developer
dashboard settings are intentionally outside this integration task.

Official references:

- https://developers.poki.com/guide/sdk-html5
- https://developers.poki.com/guide/sdk-overview
- https://developers.poki.com/guide/requirements-quality
