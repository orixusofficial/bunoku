export type SoundName = 'Xon' | 'Xoff' | 'foundbunny' | 'entery' | 'nice' | 'wow' | 'excellent' | 'unrealistic' | 'failbite' | 'win' | 'fail'

import { assetUrl } from './assetUrl.ts'
import { preloadDiscoveryAudio, resumeDiscoveryAudio, setDiscoveryMuted } from './playgama/discoveryAudio.ts'

let soundEffectsEnabled = true
let musicEnabled = false
let platformMuted = false
let adMuted = false
let initialized = false
let music: HTMLAudioElement | null = null
const effects = new Set<HTMLAudioElement>()

function resumeMusic() {
  if (!initialized || !musicEnabled || platformMuted || adMuted || document.hidden) {
    if (music) { music.muted = true; music.pause() }
    return
  }
  if (!music) {
    music = new Audio(assetUrl('audio/music.mp3'))
    music.loop = true
    music.volume = 0.05
  }
  music.muted = false
  if (music.paused) void music.play().then(() => {
    // A pending play request must not undo a later Sound OFF action.
    if ((!initialized || !musicEnabled || platformMuted || adMuted || document.hidden) && music) { music.muted = true; music.pause() }
  }).catch(() => {
    // A later user interaction retries blocked playback.
  })
}

if (import.meta.hot) import.meta.hot.dispose(() => {
  // Fast Refresh preserves React state, but replaces this module's globals.
  // Silence the old module's players before its references are discarded.
  if (music) { music.muted = true; music.pause() }
  effects.forEach((audio) => { audio.muted = true; audio.pause() })
})

export function setMusicEnabled(enabled: boolean) {
  musicEnabled = enabled
  if (!enabled && music) { music.muted = true; music.pause() }
  else resumeMusic()
}

export function setSoundEffectsEnabled(enabled: boolean) {
  soundEffectsEnabled = enabled
  if (globalThis.BUNOKU_PLAYGAMA) setDiscoveryMuted(!enabled || platformMuted || adMuted || document.hidden)
  effects.forEach((audio) => { audio.muted = !enabled || platformMuted || adMuted })
}

export function setPlatformMuted(muted: boolean) {
  platformMuted = muted
  if (globalThis.BUNOKU_PLAYGAMA) setDiscoveryMuted(!soundEffectsEnabled || muted || adMuted || document.hidden)
  effects.forEach((audio) => { audio.muted = !soundEffectsEnabled || muted || adMuted })
  resumeMusic()
}

export function setAdMuted(muted: boolean) {
  adMuted = muted
  if (globalThis.BUNOKU_PLAYGAMA) setDiscoveryMuted(!soundEffectsEnabled || platformMuted || muted || document.hidden)
  effects.forEach((audio) => { audio.muted = !soundEffectsEnabled || platformMuted || muted })
  resumeMusic()
}

export function initializeAudio() {
  initialized = true
  if (globalThis.BUNOKU_PLAYGAMA) preloadDiscoveryAudio()
  const onInteraction = globalThis.BUNOKU_PLAYGAMA ? () => { resumeDiscoveryAudio(); resumeMusic() } : () => resumeMusic()
  const onVisibilityChange = globalThis.BUNOKU_PLAYGAMA ? () => { setDiscoveryMuted(!soundEffectsEnabled || platformMuted || adMuted || document.hidden); resumeMusic() } : () => resumeMusic()
  document.addEventListener('pointerdown', onInteraction, true)
  document.addEventListener('click', onInteraction, true)
  document.addEventListener('keydown', onInteraction, true)
  document.addEventListener('visibilitychange', onVisibilityChange)
  resumeMusic()
  return () => {
    initialized = false
    document.removeEventListener('pointerdown', onInteraction, true)
    document.removeEventListener('click', onInteraction, true)
    document.removeEventListener('keydown', onInteraction, true)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (music) { music.muted = true; music.pause() }
  }
}

export function playSound(name: SoundName) {
  const audio = new Audio(assetUrl(`audio/${name}.mp3`))
  audio.muted = !soundEffectsEnabled || platformMuted || adMuted
  effects.add(audio)
  const release = () => effects.delete(audio)
  audio.onended = release
  audio.onerror = release
  void audio.play().catch(release)
  return audio
}
