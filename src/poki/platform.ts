import { setAdMuted, setPlatformMuted } from '../audio.ts'

type PokiSDK = NonNullable<Window['PokiSDK']>
type Result = 'rewarded' | 'unavailable' | 'busy' | 'cancelled' | 'save-error'

let initialization: Promise<boolean> | undefined
let sdk: PokiSDK | undefined
let initialized = false
let adPending = false
let modalPauses = 0
let adPaused = false
let loading = 0
let loadingFinishedReported = false
let gameplayReported = false
let scheduled = false
let suppressCommercial = false
const sessions = new Set<symbol>()

export function withoutCommercialBreak(action: () => void) {
  const previous = suppressCommercial
  suppressCommercial = true
  try { action() } finally { suppressCommercial = previous }
}

function diagnostic(event: string, detail?: unknown) {
  if (import.meta.env?.DEV) console.info('[Bunoku Poki]', event, detail ?? '')
}

let rewardKind: 'hint' | 'undo' = 'hint'
export function logAdDiagnostic(event: string, detail?: unknown) {
  if (event === 'control requests reward' && detail && typeof detail === 'object' && 'kind' in detail && (detail.kind === 'hint' || detail.kind === 'undo')) rewardKind = detail.kind
  diagnostic(event, detail)
}
export function sdkLocale() { return navigator.language }
export function adsAvailable() { return initialized && typeof sdk?.rewardedBreak === 'function' }
export function isPlatformPaused() { return adPaused || adPending || modalPauses > 0 || document.hidden }

function sync() {
  const paused = isPlatformPaused()
  document.getElementById('root')?.toggleAttribute('inert', paused)
  setAdMuted(adPaused || adPending)
  setPlatformMuted(document.hidden || modalPauses > 0)
  if (!initialized || !sdk) return
  const playing = sessions.size > 0 && !paused && loading === 0
  if (gameplayReported && !playing) {
    try { sdk.gameplayStop() } catch (error) { diagnostic('gameplayStop failed', error) }
    gameplayReported = false
  }
  if (!gameplayReported && playing) {
    try { sdk.gameplayStart(); gameplayReported = true } catch (error) { diagnostic('gameplayStart failed', error) }
  }
}

function scheduleSync() {
  if (scheduled) return
  scheduled = true
  queueMicrotask(() => { scheduled = false; sync() })
}

function setAdPause(paused: boolean) {
  if (adPaused === paused) return
  adPaused = paused
  sync()
}

export function initializePoki() {
  return initialization ??= (async () => {
    let candidate = window.PokiSDK
    if (!candidate) candidate = await new Promise<PokiSDK | undefined>(resolve => {
      const script = document.getElementById('poki-sdk')
      if (!script) { resolve(undefined); return }
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        script.removeEventListener('load', loaded)
        script.removeEventListener('error', failed)
        resolve(window.PokiSDK)
      }
      const loaded = () => finish()
      const failed = () => finish()
      const timer = setTimeout(finish, 4000)
      script.addEventListener('load', loaded, { once: true })
      script.addEventListener('error', failed, { once: true })
      if (window.PokiSDK) finish()
    })
    if (!candidate) { diagnostic('SDK script unavailable; continuing without platform features'); return false }
    try {
      diagnostic('initialization started')
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          candidate.init(),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Poki SDK initialization timed out')), 4000) }),
        ])
      } finally { if (timer) clearTimeout(timer) }
      sdk = candidate
      initialized = true
      diagnostic('initialization completed')
      sync()
      return true
    } catch (error) {
      diagnostic('initialization failed; continuing without platform features', error)
      sdk = undefined
      initialized = false
      return false
    }
  })()
}

export function gameLoadingFinished() {
  if (!initialized || !sdk || loadingFinishedReported) return
  try { sdk.gameLoadingFinished(); loadingFinishedReported = true; diagnostic('gameLoadingFinished') }
  catch (error) { diagnostic('gameLoadingFinished failed', error) }
}

export function trackGameplay(playing: boolean) {
  const session = Symbol('gameplay-session')
  if (playing) sessions.add(session)
  scheduleSync()
  return () => { sessions.delete(session); scheduleSync() }
}

export function beginLoading() {
  loading++
  scheduleSync()
  let ended = false
  return () => { if (!ended) { ended = true; loading--; scheduleSync() } }
}

export function reportLevelStart(_puzzle: { level: number }) {}
export function reportOutcome(_outcome: 'win' | 'fail', _level: number) {}

function rewardOfferCopy(kind: 'hint' | 'undo') {
  const language = (document.documentElement.lang || 'en').split('-')[0]
  if (language === 'es') return kind === 'hint'
    ? { title: '¿Quieres más pistas?', prompt: 'Elige un video opcional para obtener 3 pistas, o sigue jugando.', keep: 'Seguir sin anuncio', watch: 'Ver video por 3 pistas' }
    : { title: '¿Quieres más deshacer?', prompt: 'Elige un video opcional para obtener 3 deshacer, o sigue jugando.', keep: 'Seguir sin anuncio', watch: 'Ver video por 3 deshacer' }
  if (language === 'ar') return kind === 'hint'
    ? { title: 'هل تريد تلميحات إضافية؟', prompt: 'اختر فيديو اختياريًا لتحصل على 3 تلميحات، أو تابع اللعب.', keep: 'المتابعة دون إعلان', watch: 'شاهد فيديو مقابل 3 تلميحات' }
    : { title: 'هل تريد مرات تراجع إضافية؟', prompt: 'اختر فيديو اختياريًا لتحصل على 3 مرات تراجع، أو تابع اللعب.', keep: 'المتابعة دون إعلان', watch: 'شاهد فيديو مقابل 3 مرات تراجع' }
  if (language === 'hi') return kind === 'hint'
    ? { title: 'और संकेत चाहिए?', prompt: '3 संकेत पाने के लिए वैकल्पिक वीडियो चुनें, या खेल जारी रखें।', keep: 'विज्ञापन के बिना जारी रखें', watch: '3 संकेतों के लिए वीडियो देखें' }
    : { title: 'और बार वापस करना है?', prompt: '3 बार वापस पाने के लिए वैकल्पिक वीडियो चुनें, या खेल जारी रखें।', keep: 'विज्ञापन के बिना जारी रखें', watch: '3 बार वापस पाने के लिए वीडियो देखें' }
  return kind === 'hint'
    ? { title: 'Want more Hints?', prompt: 'Choose an optional video for 3 Hints, or keep playing.', keep: 'Continue without an ad', watch: 'Watch video for 3 Hints' }
    : { title: 'Want more Undos?', prompt: 'Choose an optional video for 3 Undos, or keep playing.', keep: 'Continue without an ad', watch: 'Watch video for 3 Undos' }
}

function presentRewardChoice(kind: 'hint' | 'undo', onWatch: () => void, onContinue: () => void) {
  const copy = rewardOfferCopy(kind)
  const previous = document.activeElement as HTMLElement | null
  let resumeDialog = () => {}
  const backdrop = document.createElement('div')
  const panel = document.createElement('section')
  const heading = document.createElement('h2')
  const prompt = document.createElement('p')
  const keep = document.createElement('button')
  const watch = document.createElement('button')
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const iconRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  backdrop.className = 'dialog-backdrop'
  panel.className = 'settings-dialog'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-labelledby', 'poki-reward-title')
  panel.style.display = 'grid'
  panel.style.gap = '12px'
  panel.style.textAlign = 'center'
  panel.style.direction = document.documentElement.lang === 'ar' ? 'rtl' : 'ltr'
  heading.id = 'poki-reward-title'
  heading.textContent = copy.title
  prompt.textContent = copy.prompt
  keep.type = watch.type = 'button'
  // Poki requires the normal continuation option to be at least as prominent
  // as the ad choice, with both visible at once and the video icon explicit.
  keep.className = 'pill-button primary-button'
  keep.textContent = copy.keep
  watch.className = 'pill-button secondary-button'
  keep.style.width = watch.style.width = '100%'
  keep.style.minHeight = watch.style.minHeight = '48px'
  icon.setAttribute('viewBox', '0 0 24 24')
  icon.setAttribute('aria-hidden', 'true')
  icon.classList.add('reward-icon')
  icon.style.width = icon.style.height = '22px'
  iconRect.setAttribute('x', '2'); iconRect.setAttribute('y', '5'); iconRect.setAttribute('width', '20'); iconRect.setAttribute('height', '14'); iconRect.setAttribute('rx', '4')
  iconPath.setAttribute('d', 'm10 9 5 3-5 3Z')
  icon.append(iconRect, iconPath)
  watch.append(icon, document.createTextNode(copy.watch))
  let closed = false
  const close = () => {
    if (closed) return false
    closed = true
    backdrop.remove()
    resumeDialog()
    previous?.focus({ preventScroll: true })
    return true
  }
  keep.onclick = () => { if (close()) onContinue() }
  watch.onclick = () => { if (close()) onWatch() }
  panel.onkeydown = event => {
    if (event.key === 'Escape') { event.preventDefault(); keep.click() }
    if (event.key === 'Tab') {
      event.preventDefault()
      const current = document.activeElement
      if (event.shiftKey) (current === keep ? watch : keep).focus()
      else (current === watch ? keep : watch).focus()
    }
  }
  // Standard continue is first and equal size, above the non-green rewarded
  // option, as required by Poki's ad hierarchy guidance.
  panel.append(heading, prompt, keep, watch)
  backdrop.append(panel)
  resumeDialog = pauseForDialog()
  try {
    document.body.append(backdrop)
    keep.focus()
  } catch (error) {
    close()
    throw error
  }
}

function runRewardedBreak(grant: () => boolean, resolve: (result: Result) => void) {
  let started = false
  let settled = false
  const finish = (result: Result) => {
    if (settled) return
    settled = true
    adPending = false
    setAdPause(false)
    sync()
    resolve(result)
  }
  const onAdStarted = () => {
    if (started || settled) return
    started = true
    diagnostic('rewardedBreak started')
    setAdPause(true)
  }
  let request: Promise<boolean>
  try { request = sdk!.rewardedBreak(onAdStarted) }
  catch (error) { diagnostic('rewardedBreak request failed', error); finish('unavailable'); return }
  void Promise.resolve(request).then(success => {
    if (success !== true) { diagnostic('rewardedBreak did not complete'); finish('unavailable'); return }
    try { finish(grant() ? 'rewarded' : 'save-error') }
    catch (error) { diagnostic('reward save failed', error); finish('save-error') }
  }, error => { diagnostic('rewardedBreak failed', error); finish('unavailable') })
}

export function requestRewardedAd(grant: () => boolean, kind: 'hint' | 'undo' = rewardKind): Promise<Result> {
  if (adPending || adPaused || modalPauses > 0 || document.hidden) return Promise.resolve('busy')
  if (!adsAvailable() || !sdk) return Promise.resolve('unavailable')
  adPending = true
  sync()
  return new Promise<Result>(resolve => {
    try {
      presentRewardChoice(kind, () => runRewardedBreak(grant, resolve), () => {
        adPending = false
        sync()
        resolve('cancelled')
      })
    } catch (error) {
      diagnostic('reward choice could not open', error)
      adPending = false
      sync()
      resolve('unavailable')
    }
  })
}

export function showInterstitialAtBreak(): Promise<void> {
  if (suppressCommercial) return Promise.resolve()
  if (!initialized || !sdk || typeof sdk.commercialBreak !== 'function' || adPending || adPaused || modalPauses > 0 || document.hidden) return Promise.resolve()
  adPending = true
  sync()
  let started = false
  const onAdStarted = () => {
    if (started) return
    started = true
    diagnostic('commercialBreak started')
    setAdPause(true)
  }
  let request: Promise<void>
  try { request = sdk.commercialBreak(onAdStarted) }
  catch (error) {
    diagnostic('commercialBreak request failed', error)
    adPending = false
    sync()
    return Promise.resolve()
  }
  return Promise.resolve(request).catch(error => {
    diagnostic('commercialBreak unavailable', error)
  }).finally(() => {
    adPending = false
    setAdPause(false)
    sync()
  })
}

export function pauseForDialog() {
  modalPauses++
  sync()
  let ended = false
  return () => { if (!ended) { ended = true; modalPauses--; sync() } }
}

export function confirmDuringGameplay(message: string) {
  const resume = pauseForDialog()
  try { return window.confirm(message) } finally { resume() }
}

document.addEventListener('visibilitychange', sync)
if (import.meta.hot) import.meta.hot.dispose(() => {
  document.removeEventListener('visibilitychange', sync)
  if (gameplayReported && sdk) { try { sdk.gameplayStop() } catch { /* HMR teardown only. */ } }
  document.getElementById('root')?.removeAttribute('inert')
  setAdMuted(false)
  setPlatformMuted(false)
  sessions.clear()
})
