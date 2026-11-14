import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { createAllowances } from '../src/game/allowances.ts'
import { pokiBuild } from '../build/poki.ts'

const tick = () => new Promise(setImmediate)

function fixture({ missing = false } = {}) {
  const calls = [], logs = [], listeners = new Map(), data = new Map(), timers = []
  let adMuted = false, platformMuted = false, inert = false, resolveReward, resolveCommercial
  const root = { toggleAttribute(_name, value) { inert = value }, removeAttribute() { inert = false } }
  const body = { children: [], append(element) { element.parentNode = body; body.children.push(element) } }
  const document = {
    hidden: false, documentElement: { lang: 'en' }, body, activeElement: null,
    addEventListener(name, fn) { listeners.set(name, fn) },
    removeEventListener(name) { listeners.delete(name) },
    getElementById(id) { return id === 'root' ? root : id === 'poki-sdk' ? script : null },
    createElement(tag) { return makeElement(tag) },
    createElementNS(_namespace, tag) { return makeElement(tag) },
    createTextNode(textContent) { return { textContent } },
  }
  function makeElement(tag) {
    return {
      tagName: tag, children: [], attributes: {}, style: {}, parentNode: null,
      classList: { add(value) { this.value = value } },
      setAttribute(name, value) { this.attributes[name] = value },
      append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child) } },
      remove() { if (this.parentNode?.children) this.parentNode.children = this.parentNode.children.filter(child => child !== this) },
      focus() { document.activeElement = this },
      click() { this.onclick?.() },
    }
  }
  const scriptListeners = new Map()
  const script = {
    addEventListener(name, fn) { scriptListeners.set(name, fn) },
    removeEventListener(name) { scriptListeners.delete(name) },
  }
  const sdk = {
    init() { calls.push(['init']); return Promise.resolve() },
    gameLoadingFinished() { calls.push(['loadingFinished']) },
    gameplayStart() { calls.push(['gameplayStart']) },
    gameplayStop() { calls.push(['gameplayStop']) },
    commercialBreak(onAdStarted) {
      calls.push(['commercialBreak'])
      this.onCommercialStarted = onAdStarted
      return new Promise(resolve => { resolveCommercial = resolve })
    },
    rewardedBreak(onAdStarted) {
      calls.push(['rewardedBreak'])
      this.onRewardStarted = onAdStarted
      return new Promise(resolve => { resolveReward = resolve })
    },
  }
  const window = { PokiSDK: missing ? undefined : sdk, confirm: () => true }
  const source = fs.readFileSync('src/poki/platform.ts', 'utf8')
    .replace(/if \(import\.meta\.hot\)[\s\S]*$/, '')
    .replace(/import\.meta\.env\?\.DEV/g, 'false')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const context = {
    window, document, navigator: { language: 'en' }, console: { info: (...args) => logs.push(args) },
    setTimeout(fn) { timers.push(fn); return timers.length }, clearTimeout() {}, queueMicrotask,
  }
  const run = vm.runInNewContext(`(function(require,module,exports){${js}\n})`, context)
  run(
    specifier => {
      if (specifier !== '../audio.ts') throw Error(`Unexpected import ${specifier}`)
      return { setAdMuted(value) { adMuted = value }, setPlatformMuted(value) { platformMuted = value } }
    }, module, module.exports,
  )
  const store = createAllowances(() => ({ getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }))
  return {
    api: module.exports, calls, logs, window, sdk, scriptListeners, timers, store,
    body,
    chooseReward(kind, buttonIndex = 3) { body.children[0].children[0].children[buttonIndex].click() },
    state: () => ({ adMuted, platformMuted, inert }),
    completeReward: value => resolveReward(value),
    completeCommercial: () => resolveCommercial(),
    hide(value) { document.hidden = value; listeners.get('visibilitychange')?.() },
    failScript() { scriptListeners.get('error')?.() },
  }
}

async function ready(f) {
  assert.equal(await f.api.initializePoki(), true)
  assert.equal(f.calls.filter(([name]) => name === 'init').length, 1)
  f.api.gameLoadingFinished()
}

test('Poki initializes once, signals loading after ready, and does not request ads during startup', async () => {
  const f = fixture()
  const first = f.api.initializePoki(), second = f.api.initializePoki()
  assert.equal(first, second)
  assert.equal(await first, true)
  f.api.gameLoadingFinished()
  assert.deepEqual(f.calls, [['init'], ['loadingFinished']])
  assert.equal(f.api.adsAvailable(), true)
})

test('missing SDK script is non-fatal and no ad is requested', async () => {
  const f = fixture({ missing: true }), init = f.api.initializePoki()
  f.failScript()
  assert.equal(await init, false)
  assert.equal(f.api.adsAvailable(), false)
  assert.equal(await f.api.requestRewardedAd(() => assert.fail('must not grant')), 'unavailable')
  assert.deepEqual(f.state(), { adMuted: false, platformMuted: false, inert: false })
})

test('SDK initialization rejection is non-fatal', async () => {
  const f = fixture(); f.sdk.init = () => Promise.reject(Error('SDK unavailable'))
  assert.equal(await f.api.initializePoki(), false)
  assert.equal(f.api.adsAvailable(), false)
  assert.equal(await f.api.requestRewardedAd(() => assert.fail('must not grant')), 'unavailable')
})

test('gameplay start/stop is deduplicated and pause, visibility, and audio recover', async () => {
  const f = fixture(); await ready(f)
  const end = f.api.trackGameplay(true)
  await tick(); await tick()
  assert.equal(f.calls.filter(([name]) => name === 'gameplayStart').length, 1)
  f.hide(true)
  assert.equal(f.state().platformMuted, true)
  assert.equal(f.calls.filter(([name]) => name === 'gameplayStop').length, 1)
  f.hide(false); await tick()
  assert.equal(f.calls.filter(([name]) => name === 'gameplayStart').length, 2)
  end(); await tick()
  assert.equal(f.calls.filter(([name]) => name === 'gameplayStop').length, 2)
})

for (const kind of ['hint', 'undo']) test(`successful ${kind} rewarded break grants exactly 3 credits once, without consuming them`, async () => {
  const f = fixture(); await ready(f)
  for (let i = 0; i < 5; i++) assert.equal(f.store.consume(kind), true)
  const grant = () => f.store.grant(kind, `${kind}-reward-1`)
  const request = f.api.requestRewardedAd(grant, kind)
  assert.equal(f.calls.some(([name]) => name === 'rewardedBreak'), false, 'show the optional choice before asking the SDK')
  const panel = f.body.children[0].children[0]
  assert.equal(panel.children[2].textContent, 'Continue without an ad')
  assert.equal(panel.children[3].children[0].classList.value, 'reward-icon')
  assert.deepEqual(f.state(), { adMuted: true, platformMuted: true, inert: true }, 'the offer dialog pauses and mutes before the ad request')
  assert.equal(await f.api.requestRewardedAd(() => assert.fail('duplicate request must be blocked'), kind), 'busy')
  f.chooseReward(kind)
  assert.equal(f.calls.at(-1)[0], 'rewardedBreak', 'SDK call starts directly from the explicit Watch click')
  f.sdk.onRewardStarted(); f.sdk.onRewardStarted()
  f.completeReward(true)
  assert.equal(await request, 'rewarded')
  assert.equal(f.store.status()[`${kind}Credits`], 3)
  assert.equal(f.store.status()[kind === 'hint' ? 'undoCredits' : 'hintCredits'], 0)
  assert.deepEqual(f.state(), { adMuted: false, platformMuted: false, inert: false })
  assert.equal(f.store.status()[`${kind}Credits`], 3, 'reward stays available until the player uses it')
  assert.equal(f.store.consume(kind), true)
  assert.equal(f.store.status()[`${kind}Credits`], 2)
})

for (const outcome of ['skipped', 'rejected', 'throws']) test(`rewarded ${outcome} grants nothing and allows a later request`, async () => {
  const f = fixture(); await ready(f)
  if (outcome === 'throws') f.sdk.rewardedBreak = () => { throw Error('offline') }
  const request = f.api.requestRewardedAd(() => f.store.grant('hint', `${outcome}-id`), 'hint')
  f.chooseReward('hint')
  if (outcome === 'skipped') f.completeReward(false)
  if (outcome === 'rejected') f.completeReward(Promise.reject(Error('ad unavailable')))
  assert.equal(await request, 'unavailable')
  assert.equal(f.store.status().hintCredits, 0)
  assert.deepEqual(f.state(), { adMuted: false, platformMuted: false, inert: false })
  f.sdk.rewardedBreak = () => Promise.resolve(false)
  const retry = f.api.requestRewardedAd(() => f.store.grant('hint', 'retry-id'), 'hint')
  f.chooseReward('hint')
  assert.equal(await retry, 'unavailable')
})

test('choosing the standard continue option dismisses the offer without requesting an ad or granting a reward', async () => {
  const f = fixture(); await ready(f)
  const request = f.api.requestRewardedAd(() => f.store.grant('undo', 'must-not-grant'), 'undo')
  f.chooseReward('undo', 2)
  assert.equal(await request, 'cancelled')
  assert.equal(f.calls.some(([name]) => name === 'rewardedBreak'), false)
  assert.equal(f.store.status().undoCredits, 0)
  assert.deepEqual(f.state(), { adMuted: false, platformMuted: false, inert: false })
})

test('existing control diagnostic selects Undo without changing the shared reward API', async () => {
  const f = fixture(); await ready(f)
  f.api.logAdDiagnostic('control requests reward', { kind: 'undo' })
  const request = f.api.requestRewardedAd(() => assert.fail('cancelled offer'))
  assert.equal(f.body.children[0].children[0].children[0].textContent, 'Want more Undos?')
  f.chooseReward('undo', 2)
  await request
})

test('menu wrapper suppresses commercial requests and restores later transition opportunities', async () => {
  const f = fixture(); await ready(f)
  f.api.withoutCommercialBreak(() => { void f.api.showInterstitialAtBreak() })
  assert.equal(f.calls.some(([name]) => name === 'commercialBreak'), false)
  const request = f.api.showInterstitialAtBreak()
  assert.equal(f.calls.at(-1)[0], 'commercialBreak')
  f.completeCommercial(); await request
})

test('commercial breaks are explicit, pause and mute while shown, and resume gameplay after completion', async () => {
  const f = fixture(); await ready(f)
  const end = f.api.trackGameplay(true); await tick(); await tick()
  const ad = f.api.showInterstitialAtBreak()
  assert.equal(f.calls.at(-1)[0], 'commercialBreak')
  assert.deepEqual(f.state(), { adMuted: true, platformMuted: false, inert: true })
  assert.equal(f.calls.filter(([name]) => name === 'gameplayStop').length, 1)
  f.sdk.onCommercialStarted()
  f.completeCommercial(); await ad; await tick()
  assert.deepEqual(f.state(), { adMuted: false, platformMuted: false, inert: false })
  assert.equal(f.calls.filter(([name]) => name === 'gameplayStart').length, 2)
  end()
})

test('commercial-break errors restore audio and allow gameplay to continue', async () => {
  const f = fixture(); await ready(f)
  const end = f.api.trackGameplay(true); await tick(); await tick()
  f.sdk.commercialBreak = () => Promise.reject(Error('ad unavailable'))
  await f.api.showInterstitialAtBreak()
  await tick()
  assert.deepEqual(f.state(), { adMuted: false, platformMuted: false, inert: false })
  assert.equal(f.calls.filter(([name]) => name === 'gameplayStart').length, 2)
  end()
})

test('build routes SDK imports to one Poki adapter and keeps the Poki SDK script in its isolated entry', () => {
  const plugin = pokiBuild(), entry = path.resolve('src/App.tsx')
  const crazy = plugin.resolveId('./crazygames.ts', entry)
  const platform = plugin.resolveId('../playgama/platform.ts', path.resolve('src/components/GameScreen.tsx'))
  assert.equal(crazy, platform)
  assert(!crazy.includes('\\'))
  const bundle = { app: { type: 'chunk', modules: { [crazy]: {} } } }
  plugin.generateBundle.call({}, {}, bundle)
  assert.throws(() => plugin.generateBundle.call({}, {}, { app: { type: 'chunk', modules: { [crazy]: {}, [path.resolve('src/gamedistribution/platform.ts')]: {} } } }), /leaked/)
  const html = fs.readFileSync('poki/index.html', 'utf8')
  assert.equal((html.match(/https:\/\/game-cdn\.poki\.com\/scripts\/v2\/poki-sdk\.js/g) ?? []).length, 1)
  assert(html.includes('../src/poki/main.ts'))
})

