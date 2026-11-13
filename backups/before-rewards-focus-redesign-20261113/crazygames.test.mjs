import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/crazygames.ts', import.meta.url), 'utf8').replaceAll('import.meta.hot', 'false')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const tick = () => new Promise(resolve => queueMicrotask(resolve))
function fixture(environment = 'local', reject = false, ad) {
  const events = [], mutes = []
  let listener, inits = 0
  const game = { settings: { muteAudio: true }, addSettingsChangeListener(fn) { listener = fn }, removeSettingsChangeListener() {} }
  for (const event of ['gameplayStart', 'gameplayStop', 'loadingStart', 'loadingStop']) game[event] = () => events.push(event)
  const SDK = { environment, game, ad, async init() { inits++; if (reject) throw Error('offline') } }
  const module = { exports: {} }
  vm.runInNewContext('(function(require,exports){' + code + '})', { window: { CrazyGames: { SDK }, confirm: () => { assert.equal(events.at(-1), 'gameplayStop'); return true } }, queueMicrotask, setTimeout, clearTimeout, console: { warn() {} } })(() => ({ setPlatformMuted: v => mutes.push(v), setAdMuted: v => mutes.push(v) }), module.exports)
  return { api: module.exports, events, mutes, get inits() { return inits }, change: v => listener({ muteAudio: v }) }
}
test('initializes once; balanced loading; menu/pause/end/restart transitions; coalesces StrictMode', async () => {
  const f = fixture(), endLoad = f.api.beginLoading()
  await Promise.all([f.api.initializeCrazyGames(), f.api.initializeCrazyGames()])
  assert.equal(f.inits, 1); assert.deepEqual(f.events, ['loadingStart'])
  endLoad(); endLoad(); await tick()
  const replay = f.api.trackGameplay(true); replay(); const stop = f.api.trackGameplay(true); await tick()
  assert.deepEqual(f.events, ['loadingStart', 'loadingStop', 'gameplayStart'])
  f.api.confirmDuringGameplay('Restart?'); await tick()
  assert.deepEqual(f.events.slice(-2), ['gameplayStop', 'gameplayStart'])
  stop(); await tick(); assert.equal(f.events.at(-1), 'gameplayStop')
  const end = f.api.beginLoading(); await tick(); const resume = f.api.trackGameplay(true); end(); await tick()
  assert.deepEqual(f.events.slice(-3), ['loadingStart', 'loadingStop', 'gameplayStart'])
  resume(); await tick(); assert.equal(f.events.at(-1), 'gameplayStop')
  assert.deepEqual(f.mutes, [true]); f.change(false); assert.deepEqual(f.mutes, [true, false])
})
for (const [environment, reject] of [['disabled', false], ['local', true]]) test(`${environment}, rejection=${reject}: nonfatal with no feature calls`, async () => {
  const f = fixture(environment, reject)
  f.api.beginLoading(); f.api.trackGameplay(true); await f.api.initializeCrazyGames(); await tick()
  assert.deepEqual(f.events, []); assert.deepEqual(f.mutes, [])
  assert.equal(f.inits, environment === 'disabled' ? 0 : 1)
})

test('platform mute overrides both audio channels and preserves independent preferences', async () => {
  const audio = await import('../src/audio.ts?platform-test')
  const players = []
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }
  globalThis.Audio = class { constructor(src) { this.src = src; this.paused = true; players.push(this) } play() { this.paused = false; return Promise.resolve() } pause() { this.paused = true } }
  const cleanup = audio.initializeAudio()
  audio.setMusicEnabled(true); audio.setSoundEffectsEnabled(true)
  audio.setPlatformMuted(true)
  const music = players[0], effect = audio.playSound('foundbunny')
  assert(music.muted && music.paused && effect.muted)
  audio.setMusicEnabled(true); audio.setSoundEffectsEnabled(true)
  assert(music.muted && music.paused && effect.muted)
  audio.setSoundEffectsEnabled(false); audio.setPlatformMuted(false)
  assert.equal(music.muted, false); assert.equal(music.volume, .05); assert.equal(music.loop, true); assert(effect.muted)
  audio.setMusicEnabled(false); audio.setSoundEffectsEnabled(true)
  assert(music.paused); assert.equal(effect.muted, false)
  audio.setPlatformMuted(true); audio.setAdMuted(true); audio.setAdMuted(false)
  assert(effect.muted, 'ending an ad cannot override platform mute')
  audio.setPlatformMuted(false); audio.setAdMuted(true); audio.setSoundEffectsEnabled(false); audio.setAdMuted(false)
  assert(effect.muted, 'ending an ad cannot override the player preference')
  cleanup(); delete globalThis.Audio; delete globalThis.document
})

test('rewarded success grants once; pending request does not mute; duplicate requests/callbacks are ignored', async () => {
  let callbacks, calls = 0, credits = 0
  const f = fixture('local', false, { requestAd(type, next) { assert.equal(type, 'rewarded'); calls++; callbacks = next } })
  await f.api.initializeCrazyGames()
  const result = f.api.requestRewardedAd(() => { credits += 3; return true })
  assert.deepEqual(f.mutes, [true], 'no ad mute before adStarted')
  assert.equal(await f.api.requestRewardedAd(() => { credits += 3; return true }), 'busy')
  callbacks.adStarted(); callbacks.adStarted()
  const stop = f.api.trackGameplay(true); await tick()
  assert.deepEqual(f.events, [], 'active ad suspends gameplay')
  callbacks.adFinished(); callbacks.adFinished(); callbacks.adError(); await tick()
  assert.equal(await result, 'rewarded'); assert.equal(credits, 3); assert.equal(calls, 1)
  assert.deepEqual(f.mutes, [true, true, false]); assert.equal(f.events.at(-1), 'gameplayStart')
  stop(); await tick()
})

test('ads cannot be requested from active gameplay or while a puzzle is loading', async () => {
  const f = fixture('local', false, { requestAd() { assert.fail('ad requested during gameplay/loading') } })
  await f.api.initializeCrazyGames()
  const stop = f.api.trackGameplay(true); await tick()
  assert.equal(await f.api.requestRewardedAd(() => assert.fail('unexpected reward')), 'unavailable')
  stop(); await tick()
  const finish = f.api.beginLoading(); await tick()
  assert.equal(await f.api.requestRewardedAd(() => assert.fail('unexpected reward')), 'unavailable')
  finish(); await tick()
})

test('ad errors, unfilled, cancelled, disabled and failed reward saves grant nothing and recover', async () => {
  for (const mode of ['unfilled', 'started-error', 'cancelled', 'rejected', 'save-error']) {
    let callbacks, credits = 0
    const f = fixture('local', false, { requestAd(_type, cb) { callbacks = cb; if (mode === 'rejected') return Promise.reject(Error('adsDisabled')) } })
    await f.api.initializeCrazyGames()
    const result = f.api.requestRewardedAd(() => { if (mode === 'save-error') return false; credits += 3; return true })
    if (mode === 'started-error' || mode === 'save-error') callbacks.adStarted()
    if (mode === 'save-error' || mode === 'cancelled') callbacks.adFinished()
    else if (mode !== 'rejected') callbacks.adError({ code: 'unfilled' })
    assert.equal(await result, mode === 'save-error' ? 'save-error' : 'unavailable')
    callbacks.adFinished(); callbacks.adStarted(); assert.equal(credits, 0)
    const stop = f.api.trackGameplay(true); await tick(); assert.equal(f.events.at(-1), 'gameplayStart'); stop(); await tick()
  }
  const disabled = fixture('disabled', false, { requestAd() { assert.fail('disabled SDK ad call') } })
  await disabled.api.initializeCrazyGames()
  assert.equal(await disabled.api.requestRewardedAd(() => assert.fail('disabled SDK reward')), 'unavailable')
})
