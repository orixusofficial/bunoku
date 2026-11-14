import { setAdMuted, setPlatformMuted } from '../audio.ts'
import { bridge } from './runtime.ts'
import { flushStorage, initializeStorage } from './storage.ts'

let initialization: Promise<void> | undefined
let initialized = false
let ready = false, reportedPlaying = false, hostPaused = false, hostAudio = false
let loading = 0, reportedLoading = false, modalPause = 0
let adPending = false, adOpen = false
const sessions = new Set<symbol>()
let scheduled = false
const cleanup: (() => void)[] = []
const startedPuzzles = new WeakSet<{ level: number }>()
let pendingPuzzle: { level: number } | undefined
let levelEnded = false

export function isPlatformPaused() { return hostPaused || document.hidden || modalPause > 0 || adOpen || adPending }
export function adsAvailable() { return initialized && bridge().advertisement.isRewardedSupported }
export function sdkLocale() { return bridge().platform.language }
export function logAdDiagnostic(event: string, detail?: unknown) { console.info('[Bunoku Playgama]', event, JSON.stringify(detail ?? {})) }

function send(message: string, options?: { level: number }) {
  void bridge().platform.sendMessage(message, options).catch(error => console.warn('Playgama lifecycle message failed:', message, error))
}
function sync() {
  scheduled = false
  const paused = isPlatformPaused()
  document.getElementById('root')?.toggleAttribute('inert', paused || adPending)
  setPlatformMuted(!hostAudio || hostPaused || document.hidden || modalPause > 0 || adOpen)
  setAdMuted(adOpen)
  if (!ready) return
  const playing = sessions.size > 0 && loading === 0 && !paused && !adPending && !levelEnded
  if (playing && pendingPuzzle) {
    send('level_started', { level: pendingPuzzle.level })
    startedPuzzles.add(pendingPuzzle); pendingPuzzle = undefined; reportedPlaying = true
  } else if (playing !== reportedPlaying) { send(playing ? 'level_resumed' : 'level_paused'); reportedPlaying = playing }
  if (reportedLoading !== (loading > 0)) { send(loading ? 'in_game_loading_started' : 'in_game_loading_stopped'); reportedLoading = loading > 0 }
}
function schedule() { if (!scheduled) { scheduled = true; queueMicrotask(sync) } }

export function initializePlaygama() {
  return initialization ??= (async () => {
    const sdk = bridge()
    await sdk.initialize()
    hostAudio = sdk.platform.isAudioEnabled
    hostPaused = sdk.platform.isPaused
    adOpen = sdk.advertisement.interstitialState === 'opened' || sdk.advertisement.rewardedState === 'opened'
    const audio = (enabled: unknown) => { hostAudio = enabled === true; sync() }
    const pause = (paused: unknown) => { hostPaused = paused === true; sync() }
    const visibility = () => sync()
    const adState = () => {
      adOpen = sdk.advertisement.interstitialState === 'opened' || ['opened', 'rewarded'].includes(sdk.advertisement.rewardedState)
      sync()
    }
    sdk.platform.on(sdk.EVENT_NAME.AUDIO_STATE_CHANGED, audio)
    sdk.platform.on(sdk.EVENT_NAME.PAUSE_STATE_CHANGED, pause)
    sdk.advertisement.on(sdk.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, adState)
    sdk.advertisement.on(sdk.EVENT_NAME.REWARDED_STATE_CHANGED, adState)
    document.addEventListener('visibilitychange', visibility)
    cleanup.push(() => sdk.platform.off(sdk.EVENT_NAME.AUDIO_STATE_CHANGED, audio), () => sdk.platform.off(sdk.EVENT_NAME.PAUSE_STATE_CHANGED, pause), () => document.removeEventListener('visibilitychange', visibility))
    cleanup.push(() => sdk.advertisement.off(sdk.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, adState), () => sdk.advertisement.off(sdk.EVENT_NAME.REWARDED_STATE_CHANGED, adState))
    sync()
    await initializeStorage()
    initialized = true
    logAdDiagnostic('initialized', { platform: sdk.platform.id, rewardedSupported: sdk.advertisement.isRewardedSupported })
  })()
}
export function markGameReady() {
  if (ready || !initialized) return
  ready = true
  send('game_ready')
  sync()
}
export function beginLoading() {
  loading++; schedule()
  let done = false
  return () => { if (!done) { done = true; loading--; schedule() } }
}
export function trackGameplay(playing: boolean) {
  const token = Symbol()
  if (playing) sessions.add(token)
  schedule()
  return () => { sessions.delete(token); schedule() }
}
export function reportLevelStart(puzzle: { level: number }) {
  levelEnded = false
  if (!startedPuzzles.has(puzzle)) pendingPuzzle = puzzle
  schedule()
}
export function reportOutcome(outcome: 'win' | 'fail', level: number) {
  levelEnded = true; reportedPlaying = false
  send(outcome === 'win' ? 'level_completed' : 'level_failed', { level })
  void flushStorage().catch(error => console.error('Playgama progress save failed:', error))
}
export function confirmDuringGameplay(message: string) {
  modalPause++; sync()
  try { return window.confirm(message) }
  finally { modalPause--; schedule() }
}
export function pauseForDialog() {
  modalPause++; sync()
  let released = false
  return () => { if (!released) { released = true; modalPause--; sync() } }
}

function requestAd(kind: 'rewarded' | 'interstitial', reward?: () => boolean): Promise<'rewarded' | 'unavailable' | 'busy' | 'save-error'> {
  if (!initialized) { logAdDiagnostic('request rejected: adapter not initialized'); return Promise.resolve('unavailable') }
  const sdk = bridge(), ads = sdk.advertisement
  if (adPending || ['loading', 'opened'].includes(ads.interstitialState) || ['loading', 'opened', 'rewarded'].includes(ads.rewardedState)) { logAdDiagnostic('request busy', { kind, interstitial: ads.interstitialState, rewarded: ads.rewardedState }); return Promise.resolve('busy') }
  if (kind === 'rewarded' ? !ads.isRewardedSupported : !ads.isInterstitialSupported) { logAdDiagnostic('request unsupported', { kind }); return Promise.resolve('unavailable') }
  adPending = true; sync()
  return new Promise(resolve => {
    let settled = false
    const event = kind === 'rewarded' ? sdk.EVENT_NAME.REWARDED_STATE_CHANGED : sdk.EVENT_NAME.INTERSTITIAL_STATE_CHANGED
    const finish = (result: 'rewarded' | 'unavailable' | 'save-error') => {
      if (settled) return
      settled = true; ads.off(event, stateChanged)
      adPending = false; sync()
      resolve(result)
    }
    const stateChanged = (state: unknown) => {
      logAdDiagnostic('ad state', { kind, state })
      if (settled) return
      if (state === 'opened') { adOpen = true; sync() }
      else if (state === 'rewarded' && kind === 'rewarded') {
        // Remove the listener before saving, so duplicate SDK events cannot grant twice.
        settled = true; ads.off(event, stateChanged)
        void (async () => {
          let result: 'rewarded' | 'save-error' = 'save-error'
          try { if (reward?.()) { await flushStorage(); result = 'rewarded' } }
          catch (error) { console.error('Playgama reward save failed:', error) }
          finally { adPending = false; sync(); resolve(result) }
        })()
      } else if (state === 'closed' || state === 'failed') finish('unavailable')
    }
    ads.on(event, stateChanged)
    const show = () => {
      logAdDiagnostic('request starts', { kind, platform: sdk.platform.id })
      try { if (kind === 'rewarded') ads.showRewarded('bunoku_help'); else ads.showInterstitial('bunoku_break') }
      catch (error) { console.warn('Playgama ad unavailable:', error); finish('unavailable') }
    }
    if (kind === 'interstitial') void flushStorage().catch(error => console.error('Playgama save failed:', error)).then(show)
    else show()
  })
}
export function requestRewardedAd(reward: () => boolean) { return requestAd('rewarded', reward) }
export function showInterstitialAtBreak() { return requestAd('interstitial') }

if (import.meta.hot) import.meta.hot.dispose(() => { cleanup.forEach(fn => fn()); document.getElementById('root')?.removeAttribute('inert'); setPlatformMuted(false); setAdMuted(false) })
