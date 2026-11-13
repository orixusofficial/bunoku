import { setPlatformMuted, setAdMuted } from './audio.ts'

type Settings = { muteAudio?: boolean }
type Game = {
  settings: Settings
  gameplayStart(): void
  gameplayStop(): void
  loadingStart(): void
  loadingStop(): void
  addSettingsChangeListener(listener: (settings: Settings) => void): void
  removeSettingsChangeListener(listener: (settings: Settings) => void): void
}
type AdCallbacks = { adStarted(): void; adFinished(): void; adError(error?: unknown): void }
type SDK = { init(): Promise<void>; environment: 'local' | 'crazygames' | 'disabled'; game: Game; user?: { systemInfo?: { locale?: string } }; ad?: { requestAd(type: 'rewarded', callbacks: AdCallbacks): void | Promise<void> } }
declare global { interface Window { CrazyGames?: { SDK: SDK } } }

let initialization: Promise<void> | undefined
let sdk: SDK | undefined
let sdkInit: Promise<void> | undefined
let initStatus = 'not-started'
let environment: string | undefined
let lastAdError: unknown
let loading = 0
let pauses = 0
const sessions = new Set<symbol>()
let reportedLoading = false
let reportedPlaying = false
let scheduled = false
let adPending = false
export function sdkLocale() { try { return sdk?.user?.systemInfo?.locale } catch { return undefined } }

export function logAdDiagnostic(event: string, detail?: unknown) {
  if (!import.meta.env?.DEV && !(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('bunokuDebug') === '1')) return
  const value = detail instanceof Error ? { name: detail.name, message: detail.message } : detail
  let message = ''
  try { message = value === undefined ? '' : JSON.stringify(value) }
  catch { message = String(value) }
  console.info('[Bunoku CrazyGames]', event, message)
}
export function adsAvailable() { return !!sdk && sdk.environment !== 'disabled' && typeof sdk.ad?.requestAd === 'function' }
export async function requestRewardedAd(reward: () => boolean): Promise<'rewarded' | 'unavailable' | 'busy' | 'save-error' | 'adCooldown' | 'unfilled' | 'adsDisabled' | 'adblock'> {
  if (adPending) { logAdDiagnostic('request blocked: already pending'); return 'busy' }
  adPending = true
  if (!sdk && initStatus !== 'disabled') await initializeCrazyGames()
  const reason = !sdk ? `SDK ${initStatus}` : !adsAvailable() ? 'SDK missing rewarded API' : loading > 0 ? 'puzzle loading' : null
  logAdDiagnostic('rewarded availability', { available: !reason, initStatus, environment, reason, lastAdError })
  if (reason) { adPending = false; return 'unavailable' }
  logAdDiagnostic('request starts', { type: 'rewarded', environment })
  return new Promise(resolve => {
    let settled = false, started = false
    let failure: 'unavailable' | 'adCooldown' | 'unfilled' | 'adsDisabled' | 'adblock' = 'unavailable'
    const finish = (success: boolean) => {
      if (settled) { logAdDiagnostic('duplicate terminal callback ignored'); return }
      settled = true
      if (started) { pauses--; setAdMuted(false); schedule() }
      adPending = false
      if (!success || !started) { logAdDiagnostic('request ended without reward', { success, started, lastAdError }); resolve(failure); return }
      try { const saved = reward(); logAdDiagnostic('reward persistence', { saved }); resolve(saved ? 'rewarded' : 'save-error') }
      catch (error) { logAdDiagnostic('reward save failed', error); resolve('save-error') }
    }
    const callbacks: AdCallbacks = {
      adStarted() { if (settled || started) return; started = true; logAdDiagnostic('adStarted'); pauses++; sync(); setAdMuted(true) },
      adFinished() { logAdDiagnostic('adFinished'); finish(true) },
      adError(error) {
        if (settled) return
        lastAdError = error
        logAdDiagnostic('adError', error)
        if (error && typeof error === 'object' && 'code' in error && ['adCooldown','unfilled','adsDisabled','adblock'].includes(String(error.code))) {
          failure = error.code as typeof failure
        }
        finish(false)
      },
    }
    try { void Promise.resolve(sdk!.ad!.requestAd('rewarded', callbacks)).catch(error => { lastAdError = error; logAdDiagnostic('request promise rejected', error); finish(false) }) }
    catch (error) { lastAdError = error; logAdDiagnostic('request threw', error); finish(false) }
  })
}

function invoke(method: 'loadingStart' | 'loadingStop' | 'gameplayStart' | 'gameplayStop') {
  if (!sdk || sdk.environment === 'disabled') return
  try { sdk.game[method]() } catch (error) { console.warn('CrazyGames event unavailable:', method, error) }
}
function sync() {
  scheduled = false
  if (!sdk || sdk.environment === 'disabled') return
  const playing = sessions.size > 0 && !loading && !pauses
  if (reportedPlaying && !playing) { invoke('gameplayStop'); reportedPlaying = false }
  if (reportedLoading !== (loading > 0)) {
    invoke(loading ? 'loadingStart' : 'loadingStop'); reportedLoading = loading > 0
  }
  if (!reportedPlaying && playing) { invoke('gameplayStart'); reportedPlaying = true }
}
function schedule() {
  if (!scheduled) { scheduled = true; queueMicrotask(sync) }
}
export function trackGameplay(playing: boolean) {
  const session = Symbol()
  if (playing) sessions.add(session)
  schedule()
  return () => { sessions.delete(session); schedule() }
}
export function beginLoading() {
  loading++; schedule()
  let finished = false
  return () => { if (!finished) { finished = true; loading--; schedule() } }
}
export function confirmDuringGameplay(message: string) {
  pauses++; sync()
  try { return window.confirm(message) }
  finally { pauses--; schedule() }
}

export function initializeCrazyGames() {
  return initialization ??= (async () => {
    try {
      initStatus = 'waiting-for-script'; logAdDiagnostic('initialization starts')
      // The async script must never hold up normal browser play indefinitely.
      if (!window.CrazyGames?.SDK) await new Promise<void>((resolve, reject) => {
        const script = document.getElementById('crazygames-sdk')
        const finish = (error?: Error) => {
          clearTimeout(timer); script?.removeEventListener('load', loaded); script?.removeEventListener('error', failed)
          if (error) reject(error); else resolve()
        }
        const loaded = () => finish()
        const failed = () => finish(new Error('SDK script unavailable'))
        const timer = setTimeout(failed, 3000)
        script?.addEventListener('load', loaded, { once: true }); script?.addEventListener('error', failed, { once: true })
      })
      const candidate = window.CrazyGames?.SDK
      if (!candidate) throw new Error('SDK script did not expose CrazyGames.SDK')
      environment = candidate.environment
      logAdDiagnostic('SDK environment', { environment })
      // Disabled SDK methods throw, including initialization on unsupported hosts.
      if (candidate.environment === 'disabled') { initStatus = 'disabled'; logAdDiagnostic('SDK disabled on this host'); return }
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        initStatus = 'initializing'
        await Promise.race([sdkInit ??= candidate.init().catch(error => { sdkInit = undefined; throw error }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('SDK initialization timed out')), 3000) })])
      } finally { clearTimeout(timer) }
      environment = candidate.environment
      if (candidate.environment !== 'local' && candidate.environment !== 'crazygames') {
        initStatus = 'disabled'; logAdDiagnostic('SDK unavailable after initialization', { environment }); return
      }
      sdk = candidate
      initStatus = 'ready'; logAdDiagnostic('initialization completed', { environment, rewardedAPI: typeof sdk.ad?.requestAd })
      const settingsChanged = (settings: Settings) => setPlatformMuted(settings.muteAudio === true)
      settingsChanged(sdk.game.settings)
      sdk.game.addSettingsChangeListener(settingsChanged)
      sync()
      if (import.meta.hot) import.meta.hot.dispose(() => {
        if (reportedPlaying) invoke('gameplayStop')
        if (reportedLoading) invoke('loadingStop')
        sdk?.game.removeSettingsChangeListener(settingsChanged)
        sdk = undefined; setPlatformMuted(false)
      })
    } catch (error) {
      initStatus = 'failed'; logAdDiagnostic('initialization failed (retry allowed)', error)
      initialization = undefined
      console.warn('CrazyGames SDK unavailable; continuing normally.', error)
    }
  })()
}
