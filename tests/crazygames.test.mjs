import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/crazygames.ts', import.meta.url), 'utf8').replaceAll('import.meta.hot', 'false').replaceAll('import.meta.env?.DEV', 'true')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const tick = () => new Promise(resolve => queueMicrotask(resolve))
function fixture(environment = 'local', reject = false, ad) {
  const events = [], mutes = [], logs = []
  let listener, inits = 0
  const game = { settings: { muteAudio: true }, addSettingsChangeListener(fn) { listener = fn }, removeSettingsChangeListener() {} }
  for (const event of ['gameplayStart', 'gameplayStop', 'loadingStart', 'loadingStop']) game[event] = () => events.push(event)
  const SDK = { environment, game, ad, async init() { inits++; if (reject) throw Error('offline') } }
  const browserWindow = { CrazyGames: { SDK }, confirm: () => { assert.equal(events.at(-1), 'gameplayStop'); return true } }
  const module = { exports: {} }
  vm.runInNewContext('(function(require,exports){' + code + '})', { window: browserWindow, document: { getElementById: () => null }, queueMicrotask, setTimeout, clearTimeout, console: { warn() {}, info(...args) { logs.push(args) } } })(() => ({ setPlatformMuted: v => mutes.push(v), setAdMuted: v => mutes.push(v) }), module.exports)
  return { api: module.exports, events, mutes, logs, window: browserWindow, SDK, get inits() { return inits }, change: v => listener({ muteAudio: v }) }
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
  const result = f.api.requestRewardedAd(() => { credits += 1; return true })
  assert.deepEqual(f.mutes, [true], 'no ad mute before adStarted')
  assert.equal(await f.api.requestRewardedAd(() => { credits += 1; return true }), 'busy')
  callbacks.adStarted(); callbacks.adStarted()
  const stop = f.api.trackGameplay(true); await tick()
  assert.deepEqual(f.events, [], 'active ad suspends gameplay')
  callbacks.adFinished(); callbacks.adFinished(); callbacks.adError(); await tick()
  assert.equal(await result, 'rewarded'); assert.equal(credits, 1); assert.equal(calls, 1)
  assert.deepEqual(f.mutes, [true, true, false]); assert.equal(f.events.at(-1), 'gameplayStart')
  stop(); await tick()
})

test('adsDisabled is returned faithfully; a manual later attempt reaches the SDK and never grants', async () => {
  let callbacks, requests = 0, grants = 0
  const f = fixture('crazygames', false, { requestAd(_type, cb) { requests++; callbacks = cb } })
  await f.api.initializeCrazyGames()
  assert.equal(f.api.adsAvailable(), true)
  const result = f.api.requestRewardedAd(() => { grants++; return true })
  callbacks.adError({ code: 'adsDisabled', message: 'Basic Launch' })
  assert.equal(await result, 'adsDisabled')
  assert.equal(f.api.adsAvailable(), true)
  const again=f.api.requestRewardedAd(() => { grants++; return true }); callbacks.adError({code:'adsDisabled'}); assert.equal(await again,'adsDisabled')
  assert.equal(requests, 2)
  assert.equal(grants, 0)
})

test('Hint/Undo requests during gameplay use official SDK callbacks; puzzle loading still blocks requests',async()=>{
 let callbacks,calls=0,credits=0
 const f=fixture('local',false,{requestAd(type,cb){assert.equal(type,'rewarded');calls++;callbacks=cb}})
 await f.api.initializeCrazyGames();const stop=f.api.trackGameplay(true);await tick()
 const first=f.api.requestRewardedAd(()=>{credits+=3;return true})
 assert.equal(await f.api.requestRewardedAd(()=>true),'busy')
 callbacks.adStarted();callbacks.adFinished();callbacks.adFinished();assert.equal(await first,'rewarded')
 const second=f.api.requestRewardedAd(()=>{credits+=3;return true})
 callbacks.adStarted();callbacks.adFinished();assert.equal(await second,'rewarded');assert.equal(calls,2);assert.equal(credits,6)
 stop();const end=f.api.beginLoading();assert.equal(await f.api.requestRewardedAd(()=>true),'unavailable');end()
})
for(const code of ['adsDisabled','adblock','adCooldown','unfilled']) test(`${code}: no reward, audio recovers and ordinary gameplay can resume`,async()=>{
  let callbacks, grants=0
  const f=fixture('local',false,{requestAd(_type,cb){callbacks=cb}})
  await f.api.initializeCrazyGames()
  const result=f.api.requestRewardedAd(()=>{grants++;return true})
  callbacks.adStarted();callbacks.adError({code});callbacks.adFinished()
  assert.equal(await result,code);assert.equal(grants,0);assert.equal(f.mutes.at(-1),false)
  assert.equal(f.api.adsAvailable(),true,'no custom cooldown or permanent error latch')
  const retry=f.api.requestRewardedAd(()=>{grants++;return true});callbacks.adError({code});assert.equal(await retry,code);assert.equal(grants,0)
  const stop=f.api.trackGameplay(true);await tick();assert.equal(f.events.at(-1),'gameplayStart');stop()
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
    assert.equal(await result, mode === 'save-error' ? 'save-error' : ['cancelled','rejected'].includes(mode) ? 'unavailable' : 'unfilled')
    callbacks.adFinished(); callbacks.adStarted(); assert.equal(credits, 0)
    const stop = f.api.trackGameplay(true); await tick(); assert.equal(f.events.at(-1), 'gameplayStart'); stop(); await tick()
  }
  const disabled = fixture('disabled', false, { requestAd() { assert.fail('disabled SDK ad call') } })
  await disabled.api.initializeCrazyGames()
  assert.equal(await disabled.api.requestRewardedAd(() => assert.fail('disabled SDK reward')), 'unavailable')
})


test('a script timeout does not permanently poison initialization; a later real SDK can initialize before a request',async()=>{
  let grant=0
  const f=fixture('local',false,{requestAd(_type,cb){cb.adStarted();cb.adFinished()}})
  delete f.window.CrazyGames
  await f.api.initializeCrazyGames()
  assert.equal(f.inits,0)
  f.window.CrazyGames={SDK:f.SDK}
  assert.equal(await f.api.requestRewardedAd(()=>{grant++;return true}),'rewarded')
  assert.equal(f.inits,1);assert.equal(grant,1)
  assert(f.logs.some(log=>log[1].includes('initialization failed')))
  assert(f.logs.some(log=>log[1]==='initialization completed'))
})
test('a request waits for initialization and logs the actual SDK error without granting',async()=>{
  let ready=false,calls=0,grants=0
  const f=fixture('local',false,{requestAd(type,cb){assert(ready);assert.equal(type,'rewarded');calls++;cb.adError({code:'unfilled',message:'No inventory available'})}})
  f.SDK.init=async()=>{await tick();ready=true}
  const pending=f.api.requestRewardedAd(()=>{grants++;return true})
  assert.equal(await f.api.requestRewardedAd(()=>true),'busy')
  assert.equal(await pending,'unfilled');assert.equal(calls,1);assert.equal(grants,0)
  assert(f.logs.some(log=>log[1]==='adError'&&log[2].includes('unfilled')&&log[2].includes('No inventory available')))
})
