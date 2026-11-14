import { setAdMuted, setPlatformMuted } from '../audio.ts'

export type GDEvent = { name: string; message?: unknown }
type GDSDK = { preloadAd?(type: 'rewarded'): Promise<unknown>; showAd(type?: 'rewarded'): Promise<unknown> | void }
declare global {
  interface Window {
    GD_OPTIONS?: { gameId: string; onEvent: (event: GDEvent) => void }
    gdsdk?: GDSDK
  }
}
type Result = 'rewarded' | 'unavailable' | 'busy' | 'save-error'
type Request = { kind: 'rewarded' | 'interstitial'; reward?: () => boolean; started: boolean; complete: boolean; saved: boolean; resolve: (result: Result) => void }
let initialization: Promise<boolean> | undefined, settleInitialization: ((ready: boolean) => void) | undefined
let ready = false, adPaused = false, modalPauses = 0, loading = 0
let pending: Request | undefined
const privacy: Record<string, boolean | null> = { tracking: null, targeting: null, thirdParty: null }

export function logAdDiagnostic(event: string, detail?: unknown) { console.info('[Bunoku GameDistribution]', event, detail ?? '') }
export function sdkLocale() { return navigator.language }
export function adsAvailable() { return ready && typeof window.gdsdk?.showAd === 'function' }
export function isPlatformPaused() { return adPaused || !!pending || modalPauses > 0 || document.hidden }
export function privacyState() { return { ...privacy } }
function sync() {
  document.getElementById('root')?.toggleAttribute('inert', isPlatformPaused())
  setAdMuted(adPaused)
  setPlatformMuted(document.hidden || modalPauses > 0)
}
function finish(result: Result, failed = false) {
  const request = pending
  if (!request) return
  pending = undefined
  if (failed) adPaused = false
  sync(); request.resolve(result)
}
function outcome(request: Request): Result { return request.complete ? request.saved ? 'rewarded' : 'save-error' : 'unavailable' }
function preloadRewarded() {
  try { void window.gdsdk?.preloadAd?.('rewarded')?.catch(error => logAdDiagnostic('rewarded preload unavailable', error)) }
  catch (error) { logAdDiagnostic('rewarded preload error', error) }
}
function onEvent(event: GDEvent) {
  logAdDiagnostic('SDK event', event.name)
  switch (event.name) {
    case 'SDK_READY':
      { const wasReady = ready; ready = typeof window.gdsdk?.showAd === 'function'; settleInitialization?.(ready)
        if (ready && !wasReady) preloadRewarded() }
      break
    case 'SDK_GAME_PAUSE':
      adPaused = true; if (pending) pending.started = true; sync(); break
    case 'SDK_GAME_START':
      adPaused = false
      if (pending) finish(outcome(pending))
      sync(); break
    case 'SDK_REWARDED_WATCH_COMPLETE': {
      const request = pending
      if (request?.kind !== 'rewarded' || !request.started || request.complete) break
      request.complete = true
      try { request.saved = request.reward?.() === true }
      catch (error) { console.error('GameDistribution reward could not be saved:', error) }
      break
    }
    case 'SDK_ERROR': case 'AD_ERROR':
      console.warn('GameDistribution SDK/ad error:', event.message)
      settleInitialization?.(false); finish('unavailable', true); adPaused = false; sync(); break
    // Bunoku runs no independent analytics or third-party tracking. These SDK
    // opt-out signals are recorded; consent is never inferred or granted here.
    case 'SDK_GDPR_TRACKING': privacy.tracking = false; break
    case 'SDK_GDPR_TARGETING': privacy.targeting = false; break
    case 'SDK_GDPR_THIRD_PARTY': privacy.thirdParty = false; break
  }
}
export function initializeGameDistribution() {
  return initialization ??= new Promise<boolean>(resolve => {
    if (!__BUNOKU_GD_GAME_ID__) { console.warn('GameDistribution Game ID is not configured'); resolve(false); return }
    const timer = setTimeout(() => { console.warn('GameDistribution SDK unavailable; continuing without ads'); settleInitialization?.(false) }, 10000)
    let settled = false
    settleInitialization = value => { if (!settled) { settled = true; clearTimeout(timer); resolve(value) } }
    window.GD_OPTIONS = { gameId: __BUNOKU_GD_GAME_ID__, onEvent }
    document.addEventListener('visibilitychange', sync)
    if (document.getElementById('gamedistribution-jssdk')) return
    const script = document.createElement('script')
    script.id = 'gamedistribution-jssdk'; script.src = 'https://html5.api.gamedistribution.com/main.min.js'; script.async = true
    script.onerror = () => { settleInitialization?.(false); logAdDiagnostic('SDK script could not load') }
    document.head.appendChild(script)
  })
}
function requestAd(kind: Request['kind'], reward?: () => boolean): Promise<Result> {
  if (pending || adPaused || loading > 0 || modalPauses > 0 || document.hidden) return Promise.resolve('busy')
  if (!adsAvailable()) return Promise.resolve('unavailable')
  return new Promise(resolve => {
    const request: Request = { kind, reward, started: false, complete: false, saved: false, resolve }
    pending = request; sync()
    try {
      // Invoke synchronously in the click task. Preloading is not a prerequisite
      // and never grants anything; the SDK decides whether an ad can be shown.
      const result = kind === 'rewarded' ? window.gdsdk!.showAd('rewarded') : window.gdsdk!.showAd()
      if (result && typeof result.then === 'function') {
        void result.then(() => { if (pending === request) finish(outcome(request)) }, error => {
          logAdDiagnostic('ad unavailable', error); if (pending === request) finish('unavailable', true)
        })
      }
    } catch (error) { logAdDiagnostic('ad request error', error); if (pending === request) finish('unavailable', true) }
  })
}
export function requestRewardedAd(reward: () => boolean) { return requestAd('rewarded', reward) }
export function showInterstitialAtBreak() { return requestAd('interstitial') }
export function beginLoading() { loading++; let ended = false; return () => { if (!ended) { ended = true; loading-- } } }
export function pauseForDialog() { modalPauses++; sync(); let ended = false; return () => { if (!ended) { ended = true; modalPauses--; sync() } } }
export function confirmDuringGameplay(message: string) { const resume = pauseForDialog(); try { return window.confirm(message) } finally { resume() } }
// These hooks have no corresponding official GD API. Keep the shared game's
// lifecycle interface without inventing calls to unsupported SDK methods.
export function trackGameplay(_playing: boolean) { return () => {} }
export function reportLevelStart(_puzzle: { level: number }) {}
export function reportOutcome(_outcome: 'win' | 'fail', _level: number) {}

if (import.meta.hot) import.meta.hot.dispose(() => { document.removeEventListener('visibilitychange', sync); document.getElementById('root')?.removeAttribute('inert'); setAdMuted(false); setPlatformMuted(false) })
