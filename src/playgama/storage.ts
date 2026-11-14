import { bridge } from './runtime.ts'

export const SAVE_KEYS = ['bunoku.normalLevel', 'bunoku.level1TutorialComplete', 'bunoku.language', 'bunoku.musicEnabled', 'bunoku.soundEffectsEnabled', 'bunoku.allowances.v1']
const cache = new Map<string, string>()
const dirty = new Map<string, string>()
let ready = false
let failed = false
let scheduled: ReturnType<typeof setTimeout> | undefined
let saving: Promise<void> | undefined

export async function initializeStorage() {
  const data = await bridge().storage.get(SAVE_KEYS, false)
  if (!Array.isArray(data) || data.length !== SAVE_KEYS.length) throw new Error('Invalid Bridge save response')
  SAVE_KEYS.forEach((key, i) => { if (data[i] !== null && data[i] !== undefined) cache.set(key, typeof data[i] === 'string' ? data[i] : JSON.stringify(data[i])) })
  ready = true
  window.addEventListener('pagehide', saveOnLeave)
  document.addEventListener('visibilitychange', saveOnLeave)
}

// The existing synchronous game model reads an in-memory snapshot. Only Bridge
// loads/persists it; rapid pencil marks are batched, never written per frame.
export const gameStorage = {
  getItem(key: string) {
    if (!ready || failed) throw new Error('Bridge storage unavailable')
    return cache.get(key) ?? null
  },
  setItem(key: string, value: string) {
    if (!ready || failed) throw new Error('Bridge storage unavailable')
    if (cache.get(key) === value) return
    cache.set(key, value); dirty.set(key, value)
    if (!scheduled) scheduled = setTimeout(() => { scheduled = undefined; void flushStorage().catch(reportFailure) }, 500)
  },
}

function reportFailure(error: unknown) {
  console.error('Bunoku Bridge save failed:', error)
  window.dispatchEvent(new Event('storage'))
}
function saveOnLeave(event: Event) {
  if (event.type === 'pagehide' || document.hidden) void flushStorage().catch(reportFailure)
}
export async function flushStorage(): Promise<void> {
  if (scheduled) { clearTimeout(scheduled); scheduled = undefined }
  if (saving) { await saving; if (dirty.size) return flushStorage(); return }
  if (!dirty.size) return
  const batch = [...dirty]
  dirty.clear()
  saving = (async () => {
    try {
      await bridge().storage.set(batch.map(([key]) => key), batch.map(([, value]) => value))
      await bridge().storage.flush()
      failed = false
    } catch (error) {
      for (const [key, value] of batch) if (!dirty.has(key)) dirty.set(key, value)
      failed = true
      throw error
    } finally { saving = undefined }
  })()
  await saving
  if (dirty.size) await flushStorage()
}

if (import.meta.hot) import.meta.hot.dispose(() => {
  if (scheduled) clearTimeout(scheduled)
  window.removeEventListener('pagehide', saveOnLeave)
  document.removeEventListener('visibilitychange', saveOnLeave)
})
