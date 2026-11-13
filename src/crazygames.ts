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
type SDK = { init(): Promise<void>; environment: 'local' | 'crazygames' | 'disabled'; game: Game; ad?: { requestAd(type: 'rewarded', callbacks: AdCallbacks): void | Promise<void> } }
declare global { interface Window { CrazyGames?: { SDK: SDK } } }

let initialization: Promise<void> | undefined
let sdk: SDK | undefined
let loading = 0
let pauses = 0
const sessions = new Set<symbol>()
let reportedLoading = false
let reportedPlaying = false
let scheduled = false
let adPending = false
let adsDisabledForSession = false

export function adsAvailable() { return !adsDisabledForSession && !!sdk && sdk.environment !== 'disabled' && !!sdk.ad }
export function requestRewardedAd(reward: () => boolean): Promise<'rewarded' | 'unavailable' | 'busy' | 'save-error'> {
  if (adPending) return Promise.resolve('busy')
  if (!adsAvailable() || sessions.size > 0 || loading > 0) return Promise.resolve('unavailable')
  adPending = true
  return new Promise(resolve => {
    let settled = false, started = false
    const finish = (success: boolean) => {
      if (settled) return
      settled = true
      if (started) { pauses--; setAdMuted(false); schedule() }
      adPending = false
      if (!success || !started) { resolve('unavailable'); return }
      try { resolve(reward() ? 'rewarded' : 'save-error') }
      catch { resolve('save-error') }
    }
    const callbacks: AdCallbacks = {
      adStarted() { if (settled || started) return; started = true; pauses++; sync(); setAdMuted(true) },
      adFinished() { finish(true) },
      adError(error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'adsDisabled') adsDisabledForSession = true
        finish(false)
      },
    }
    try { void Promise.resolve(sdk!.ad!.requestAd('rewarded', callbacks)).catch(() => finish(false)) }
    catch { finish(false) }
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
      if (!candidate) return
      // Disabled SDK methods throw, including initialization on unsupported hosts.
      if (candidate.environment === 'disabled') return
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([candidate.init(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('SDK initialization timed out')), 3000) })])
      } finally { clearTimeout(timer) }
      if (candidate.environment !== 'local' && candidate.environment !== 'crazygames') return
      sdk = candidate
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
    } catch (error) { console.warn('CrazyGames SDK unavailable; continuing normally.', error) }
  })()
}
