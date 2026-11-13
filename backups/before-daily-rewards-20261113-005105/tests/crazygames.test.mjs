import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/crazygames.ts', import.meta.url), 'utf8').replaceAll('import.meta.hot', 'false')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const tick = () => new Promise(resolve => queueMicrotask(resolve))
function fixture(environment = 'local', reject = false) {
  const events = [], mutes = []
  let listener, inits = 0
  const game = { settings: { muteAudio: true }, addSettingsChangeListener(fn) { listener = fn }, removeSettingsChangeListener() {} }
  for (const event of ['gameplayStart', 'gameplayStop', 'loadingStart', 'loadingStop']) game[event] = () => events.push(event)
  const SDK = { environment, game, async init() { inits++; if (reject) throw Error('offline') } }
  const module = { exports: {} }
  vm.runInNewContext('(function(require,exports){' + code + '})', { window: { CrazyGames: { SDK }, confirm: () => { assert.equal(events.at(-1), 'gameplayStop'); return true } }, queueMicrotask, setTimeout, clearTimeout, console: { warn() {} } })(() => ({ setPlatformMuted: v => mutes.push(v) }), module.exports)
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
  cleanup(); delete globalThis.Audio; delete globalThis.document
})
