export type SoundName = 'Xon' | 'Xoff' | 'foundbunny' | 'entery' | 'nice' | 'wow' | 'excellent' | 'unrealistic' | 'failbite' | 'win' | 'fail'

let soundEnabled = true
let interacted = false
let music: HTMLAudioElement | null = null
const effects = new Set<HTMLAudioElement>()

function resumeMusic() {
  if (!soundEnabled || !interacted) return
  if (!music) {
    music = new Audio('/audio/music.mp3')
    music.loop = true
    music.volume = 0.06
  }
  music.muted = false
  if (music.paused) void music.play().catch(() => {
    // A later user interaction retries blocked playback.
  })
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled
  effects.forEach((audio) => { audio.muted = !enabled })
  if (!enabled && music) { music.muted = true; music.pause() }
  else resumeMusic()
}

export function initializeAudio() {
  const onInteraction = () => { interacted = true; resumeMusic() }
  document.addEventListener('pointerdown', onInteraction, true)
  document.addEventListener('keydown', onInteraction, true)
  return () => {
    document.removeEventListener('pointerdown', onInteraction, true)
    document.removeEventListener('keydown', onInteraction, true)
    music?.pause()
  }
}

export function playSound(name: SoundName) {
  const audio = new Audio(`/audio/${name}.mp3`)
  audio.muted = !soundEnabled
  effects.add(audio)
  const release = () => effects.delete(audio)
  audio.onended = release
  audio.onerror = release
  void audio.play().catch(release)
  return audio
}
