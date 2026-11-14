import { assetUrl } from '../assetUrl.ts'
import type { SoundName } from '../audio.ts'

type Voice = 'nice' | 'wow' | 'excellent' | 'unrealistic'
let context: AudioContext | undefined, gain: GainNode | undefined
let muted = false, nextStart = 0
let scheduling: Promise<void> | undefined
const buffers = new Map<string, Promise<AudioBuffer>>()
const sources = new Set<AudioBufferSourceNode>()

function audioContext() {
  if (!context) {
    const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Audio) throw new Error('Web Audio unavailable')
    context = new Audio(); gain = context.createGain(); gain.gain.value = muted ? 0 : 1; gain.connect(context.destination)
  }
  return context
}
function buffer(name: string) {
  if (!buffers.has(name)) buffers.set(name, fetch(assetUrl(`audio/${name}.mp3`)).then(response => {
    if (!response.ok) throw new Error(`Discovery sound unavailable: ${name}`)
    return response.arrayBuffer()
  }).then(bytes => audioContext().decodeAudioData(bytes)))
  return buffers.get(name)!
}

// Keep a short margin around the audible samples; never alter the source files.
export function audibleRange(audio: AudioBuffer) {
  let first = audio.length, last = -1
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const samples = audio.getChannelData(channel)
    for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]) > 0.001) { first = Math.min(first, i); break }
    for (let i = samples.length - 1; i >= 0; i--) if (Math.abs(samples[i]) > 0.001) { last = Math.max(last, i); break }
  }
  if (last < 0) return { offset: 0, duration: audio.duration }
  const offset = Math.max(0, first / audio.sampleRate - 0.01)
  return { offset, duration: Math.min(audio.duration, (last + 1) / audio.sampleRate + 0.03) - offset }
}
export function preloadDiscoveryAudio() {
  try { audioContext(); void Promise.all(['foundbunny', 'nice', 'wow', 'excellent', 'unrealistic'].map(buffer)).catch(error => console.warn('Discovery preload failed; using normal audio:', error)) }
  catch (error) { console.warn('Discovery preload unavailable; using normal audio:', error) }
}
export function resumeDiscoveryAudio() { if (context?.state === 'suspended') void context.resume().catch(error => console.warn('Discovery audio resume blocked:', error)) }
export function setDiscoveryMuted(value: boolean) { muted = value; if (gain) gain.gain.value = value ? 0 : 1 }

export function playDiscovery(voice: Voice, playSound: (name: SoundName) => HTMLAudioElement) {
  if (muted) return
  const fallback = () => {
    const found = playSound('foundbunny'); let played = false
    const next = () => { if (!played) { played = true; playSound(voice) } }
    found.addEventListener('ended', next, { once: true }); found.addEventListener('error', next, { once: true })
  }
  try {
    const ctx = audioContext()
    // Resume in the user's input task, before awaiting decoded assets.
    const resumed = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
    const decoded = Promise.all([resumed, buffer('foundbunny'), buffer(voice)]).then(data => ({ data, error: undefined }), error => ({ data: undefined, error }))
    scheduling = (scheduling ?? Promise.resolve()).then(async () => {
      const result = await decoded
      if (!result.data) throw result.error
      const [, found, spoken] = result.data
      if (muted) return
      const cue = audibleRange(found), word = audibleRange(spoken), start = Math.max(ctx.currentTime, nextStart)
      const schedule = (audio: AudioBuffer, time: number, range: { offset: number; duration: number }) => {
        const source = ctx.createBufferSource(); source.buffer = audio; source.connect(gain!); sources.add(source)
        source.onended = () => { sources.delete(source); source.disconnect() }
        source.start(time, range.offset, range.duration)
      }
      schedule(found, start, cue); schedule(spoken, start + cue.duration, word)
      nextStart = start + cue.duration + word.duration
      if (import.meta.env.DEV) console.info('[Bunoku discovery timing]', JSON.stringify({ cueOriginalMs: found.duration * 1000, cueAudibleMs: cue.duration * 1000, voiceLeadingSilenceMs: word.offset * 1000, voiceGapMs: 0 }))
    }).catch(error => { console.warn('Discovery playback fallback:', error); fallback() })
  } catch { fallback() }
}

if (import.meta.hot) import.meta.hot.dispose(() => { sources.forEach(source => source.stop()); void context?.close() })
