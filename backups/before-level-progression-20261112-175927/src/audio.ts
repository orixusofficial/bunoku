export type SoundName = 'Xon' | 'Xoff' | 'foundbunny' | 'entery' | 'nice' | 'wow' | 'excellent' | 'unrealistic' | 'failbite' | 'win' | 'fail'

export function playSound(name: SoundName) {
  const audio = new Audio(`/audio/${name}.mp3`)
  void audio.play().catch(() => {})
  return audio
}
