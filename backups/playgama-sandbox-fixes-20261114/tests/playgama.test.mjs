import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import ts from 'typescript'
import { playgamaBuild } from '../build/playgama.ts'
import { createAllowances } from '../src/game/allowances.ts'
import { createDailyPuzzle, attemptPlacement } from '../src/game/puzzle.ts'
import { initialDailyProgress } from '../src/game/dailyState.ts'

function events(target = {}) {
  const listeners = new Map()
  return Object.assign(target, {
    on(key, fn) { if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(fn) },
    off(key, fn) { listeners.get(key)?.delete(fn) },
    emit(key, value) { for (const fn of [...(listeners.get(key) ?? [])]) fn(value) },
  })
}
function load(file, require, globals = {}) {
  const module = { exports: {} }
  const source = fs.readFileSync(file, 'utf8').replace(/^if \(import.meta.hot\)[\s\S]*$/m, '').replaceAll('import.meta.env.DEV', 'true')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext('(function(require,module,exports){' + js + '})', { console, queueMicrotask, setTimeout, clearTimeout, Event, ...globals })(require, module, module.exports)
  return module.exports
}
function fixture(store = new Map()) {
  const messages = [], mute = [], requests = []
  let initialized = 0, loaded = 0, writes = 0, inert = false
  const document = events({ hidden: false, getElementById: () => ({ toggleAttribute(_, value) { inert = value } }) })
  document.addEventListener = document.on; document.removeEventListener = document.off
  const window = events({ confirm: () => true, dispatchEvent() {} })
  window.addEventListener = window.on; window.removeEventListener = window.off
  const sdk = {
    async initialize() { initialized++ },
    EVENT_NAME: { AUDIO_STATE_CHANGED: 'audio', PAUSE_STATE_CHANGED: 'pause', REWARDED_STATE_CHANGED: 'reward', INTERSTITIAL_STATE_CHANGED: 'interstitial' },
    platform: events({ isAudioEnabled: true, isPaused: false, language: 'es', async sendMessage(message, options) { messages.push([message, options]) } }),
    storage: { async get(keys) { loaded++; return keys.map(key => store.get(key) ?? null) }, async set(keys, values) { writes++; keys.forEach((key, i) => store.set(key, values[i])) }, async flush() {} },
    advertisement: events({ isRewardedSupported: true, isInterstitialSupported: true, rewardedState: 'closed', interstitialState: 'closed', showRewarded() { requests.push('rewarded') }, showInterstitial() { requests.push('interstitial') } }),
  }
  const globals = { document, window }
  const storage = load('src/playgama/storage.ts', () => ({ bridge: () => sdk }), { ...globals, setTimeout: () => 1, clearTimeout() {} })
  const platform = load('src/playgama/platform.ts', name => name === '../audio.ts' ? { setPlatformMuted: value => mute.push(value), setAdMuted() {} } : name === './storage.ts' ? storage : { bridge: () => sdk }, globals)
  const state = (kind, value) => { sdk.advertisement[kind === 'reward' ? 'rewardedState' : 'interstitialState'] = value; sdk.advertisement.emit(kind, value) }
  return { sdk, platform, storage, store, messages, mute, requests, document, state, counts: () => ({ initialized, loaded, writes, inert }) }
}
const tick = () => new Promise(setImmediate)

test('Bridge initializes once and hydrates saves before synchronous gameplay reads', async () => {
  const f = fixture()
  assert.throws(() => f.storage.gameStorage.getItem('bunoku.normalLevel'))
  f.store.set('bunoku.normalLevel', '11')
  await Promise.all([f.platform.initializePlaygama(), f.platform.initializePlaygama()])
  assert.equal(f.counts().initialized, 1); assert.equal(f.counts().loaded, 1)
  assert.equal(f.storage.gameStorage.getItem('bunoku.normalLevel'), '11')
  f.platform.markGameReady(); f.platform.markGameReady()
  const stop = f.platform.trackGameplay(true); await tick()
  const endLoading = f.platform.beginLoading(); await tick(); endLoading(); endLoading(); await tick()
  stop(); await tick()
  assert.equal(f.messages.filter(([m]) => m === 'game_ready').length, 1)
  assert.deepEqual(f.messages.map(([m]) => m), ['game_ready', 'level_resumed', 'level_paused', 'in_game_loading_started', 'level_resumed', 'in_game_loading_stopped', 'level_paused'])
})
test('platform pause, tab visibility and audio state mute without changing user preferences', async () => {
  const f = fixture(); await f.platform.initializePlaygama(); f.platform.markGameReady()
  f.platform.trackGameplay(true); await tick()
  f.sdk.platform.emit('pause', true); assert(f.platform.isPlatformPaused()); assert(f.counts().inert); assert.equal(f.mute.at(-1), true)
  f.sdk.platform.emit('pause', false); assert.equal(f.platform.isPlatformPaused(), false)
  f.sdk.platform.emit('audio', false); assert.equal(f.mute.at(-1), true)
  f.sdk.platform.emit('audio', true); assert.equal(f.mute.at(-1), false)
  f.document.hidden = true; f.document.emit('visibilitychange', new Event('visibilitychange')); assert(f.platform.isPlatformPaused())
  f.document.hidden = false; f.document.emit('visibilitychange', new Event('visibilitychange')); assert.equal(f.platform.isPlatformPaused(), false)
})
for (const kind of ['hint', 'undo']) test(`${kind}: rewarded only grants 3 once, preserves other balance and never auto-consumes`, async () => {
  const f = fixture(); await f.platform.initializePlaygama()
  const allowance = createAllowances(() => f.storage.gameStorage)
  for (let i = 0; i < 5; i++) allowance.consume(kind)
  const ad = f.platform.requestRewardedAd(() => allowance.grant(kind, 'transaction'))
  assert.equal(await f.platform.requestRewardedAd(() => assert.fail('duplicate grant')), 'busy')
  assert.deepEqual(f.requests, ['rewarded']); assert.equal(f.mute.at(-1), false)
  f.state('reward', 'opened'); assert.equal(f.mute.at(-1), true)
  f.state('reward', 'rewarded'); f.state('reward', 'rewarded')
  assert.equal(await ad, 'rewarded'); assert.equal(allowance.status()[kind + 'Credits'], 3)
  assert.equal(allowance.status()[kind === 'hint' ? 'undoFree' : 'hintFree'], 5)
  assert.equal(f.mute.at(-1), true, 'keep muted until ad actually closes')
  assert.equal(await f.platform.requestRewardedAd(() => false), 'busy')
  f.state('reward', 'closed'); assert.equal(f.mute.at(-1), false); assert.equal(f.counts().inert, false)
  const restored = createAllowances(() => ({ getItem: key => f.store.get(key) ?? null, setItem: (key, value) => f.store.set(key, value) }))
  assert.equal(restored.status()[kind + 'Credits'], 3)
})
test('failed, cancelled and unsupported ads grant nothing; later retry and Bridge interstitial skips recover', async () => {
  const f = fixture(); await f.platform.initializePlaygama(); let grants = 0
  for (const terminal of ['failed', 'closed', 'failed']) {
    const ad = f.platform.requestRewardedAd(() => { grants++; return true })
    f.state('reward', 'loading'); f.state('reward', terminal)
    assert.equal(await ad, 'unavailable'); assert.equal(f.counts().inert, false)
  }
  f.sdk.advertisement.isRewardedSupported = false
  assert.equal(await f.platform.requestRewardedAd(() => { grants++; return true }), 'unavailable')
  assert.equal(grants, 0); assert.equal(f.requests.length, 3)
  const ad = f.platform.showInterstitialAtBreak(); await tick()
  f.state('interstitial', 'loading'); f.state('interstitial', 'failed'); await ad
  assert.equal(f.counts().inert, false)
})
test('Bridge storage batches changes, persists Daily ledger and reports save failure', async () => {
  const f = fixture(); await f.platform.initializePlaygama()
  for (let i = 0; i < 20; i++) f.storage.gameStorage.setItem('bunoku.allowances.v1', JSON.stringify({ move: i }))
  f.storage.gameStorage.setItem('bunoku.language', 'ar')
  assert.equal(f.counts().writes, 0); await f.storage.flushStorage()
  assert.equal(f.counts().writes, 1); assert.equal(f.store.get('bunoku.allowances.v1'), '{"move":19}')
  f.sdk.storage.set = async () => { throw Error('offline save rejected') }
  f.storage.gameStorage.setItem('bunoku.language', 'hi')
  await assert.rejects(f.storage.flushStorage(), /offline/)
  assert.throws(() => f.storage.gameStorage.setItem('bunoku.normalLevel', '12'), /unavailable/)
})
test('Playgama build uses module routing and a separate entry, without source transforms', () => {
  const plugin = playgamaBuild()
  assert.equal(plugin.transform, undefined)
  assert.equal(plugin.transformIndexHtml, undefined)
  assert(plugin.resolveId('../crazygames.ts', path.resolve('src/game/puzzleClient.ts')).endsWith('platform.ts'))
  assert.equal(plugin.resolveId('./components/PrivacyPolicy', path.resolve('src/App.tsx')), path.resolve('src/playgama/PrivacyPolicy.tsx'))
  assert.equal(plugin.resolveId('./puzzle.ts', path.resolve('src/game/puzzleClient.ts')), undefined)
  const html = fs.readFileSync('playgama/index.html', 'utf8')
  assert(!html.includes('crazygames-sdk')); assert(html.includes('/src/playgama/main.ts'))
  const standard = fs.readFileSync('index.html', 'utf8')
  assert(standard.includes('crazygames-sdk-v3.js')); assert(!standard.includes('playgama'))
})

test('SDK/storage initialization failure cannot send ready, request ads or silently replace saves', async () => {
  for (const stage of ['sdk', 'storage']) {
    const f = fixture()
    if (stage === 'sdk') f.sdk.initialize = async () => { throw Error('SDK failed') }
    else f.sdk.storage.get = async () => { throw Error('cloud load failed') }
    await assert.rejects(f.platform.initializePlaygama(), /failed/)
    f.platform.markGameReady()
    assert.equal(f.messages.length, 0)
    assert.equal(await f.platform.requestRewardedAd(() => assert.fail('grant')), 'unavailable')
    assert.equal(f.requests.length, 0)
    assert.throws(() => f.storage.gameStorage.getItem('bunoku.normalLevel'), /unavailable/)
  }
})

test('level start is deduplicated; outcomes and modal pause report correctly', async () => {
  const f = fixture(); await f.platform.initializePlaygama(); f.platform.markGameReady()
  const puzzle = { level: 2 }
  f.platform.reportLevelStart(puzzle); f.platform.reportLevelStart(puzzle)
  f.platform.trackGameplay(true); await tick()
  f.platform.confirmDuringGameplay('Restart?'); await tick()
  f.platform.reportOutcome('win', 2); f.platform.reportOutcome('fail', 3)
  assert.equal(f.messages.filter(([m]) => m === 'level_started').length, 1)
  assert(f.messages.some(([m]) => m === 'level_paused'))
  assert(f.messages.some(([m, p]) => m === 'level_completed' && p.level === 2))
  assert(f.messages.some(([m, p]) => m === 'level_failed' && p.level === 3))
})

test('interstitial break locks immediately, ignores duplicate clicks and recovers from SDK throws', async () => {
  const f = fixture(); await f.platform.initializePlaygama()
  const ad = f.platform.showInterstitialAtBreak()
  assert.equal(f.counts().inert, true)
  assert.equal(await f.platform.showInterstitialAtBreak(), 'busy')
  await tick(); assert.deepEqual(f.requests, ['interstitial'])
  f.state('interstitial', 'opened'); assert.equal(f.mute.at(-1), true)
  f.state('interstitial', 'closed'); await ad
  assert.equal(f.counts().inert, false); assert.equal(f.mute.at(-1), false)
  f.sdk.advertisement.showRewarded = () => { throw Error('unavailable') }
  assert.equal(await f.platform.requestRewardedAd(() => assert.fail('grant')), 'unavailable')
  assert.equal(f.counts().inert, false)
})

test('real Daily progress and cooldown survive rehydration through Bridge storage', async () => {
  const first = fixture(); await first.platform.initializePlaygama()
  const account = createAllowances(() => first.storage.gameStorage)
  const puzzle = createDailyPuzzle(), progress = initialDailyProgress(puzzle)
  assert(account.startDaily(10, progress))
  const move = attemptPlacement(puzzle, progress.board, puzzle.solution[0])
  assert(move.accepted)
  assert(account.saveDaily({ ...account.dailyAttempt(), board: move.state }))
  first.storage.gameStorage.setItem('bunoku.language', 'es')
  first.storage.gameStorage.setItem('bunoku.musicEnabled', 'true')
  await first.storage.flushStorage()
  const second = fixture(first.store); await second.platform.initializePlaygama()
  const resumed = createAllowances(() => second.storage.gameStorage)
  assert.deepEqual(Array.from(resumed.dailyAttempt().board.cells), Array.from(move.state.cells))
  assert.deepEqual(Array.from(resumed.dailyAttempt().puzzle.regions), Array.from(puzzle.regions))
  assert(resumed.status().dailyRemaining > 0)
  assert.equal(resumed.startDaily(10, initialDailyProgress(createDailyPuzzle())), false)
  assert.equal(second.storage.gameStorage.getItem('bunoku.language'), 'es')
  assert.equal(second.storage.gameStorage.getItem('bunoku.musicEnabled'), 'true')
})

test('fresh level waits for platform resume and does not emit a duplicate resumed event', async () => {
  const f = fixture(); await f.platform.initializePlaygama(); f.platform.markGameReady()
  f.sdk.platform.emit('pause', true)
  f.platform.reportLevelStart({ level: 10 }); f.platform.trackGameplay(true); await tick()
  assert(!f.messages.some(([m]) => m === 'level_started'))
  f.sdk.platform.emit('pause', false)
  assert.equal(f.messages.filter(([m]) => m === 'level_started').length, 1)
  assert.equal(f.messages.filter(([m]) => m === 'level_resumed').length, 0)
  f.platform.reportOutcome('win', 10); await tick()
  assert.equal(f.messages.at(-1)[0], 'level_completed')
})
