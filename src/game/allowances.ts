export type RewardKind = 'hint' | 'undo'
import { validDailyProgress } from './dailyState.ts'
import { gameStorage } from '../playgama/storage.ts'
import type { DailyProgress } from './dailyState.ts'
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
export const ALLOWANCE_KEY = 'bunoku.allowances.v1'
export const DAY = 24 * 60 * 60 * 1000
type Ledger = {
  hintUsed: number; undoUsed: number; hintCredits: number; undoCredits: number
  dailyStarted: number; clock: number; lastRewardId: string; rewardAvailableAt: number
  dailyAttempt?: DailyProgress
}
const fresh = (): Ledger => ({ hintUsed: 0, undoUsed: 0, hintCredits: 0, undoCredits: 0, dailyStarted: 0, clock: 0, lastRewardId: '', rewardAvailableAt: 0 })

// Injected storage and clocks let tests reload real records without changing game state.
export function createAllowances(storage: () => StorageLike, wall = Date.now, monotonic = () => performance.now()) {
  let anchor = wall(), elapsedAnchor = monotonic()
  const listeners = new Set<() => void>()
  const read = (): Ledger => {
    const raw = storage().getItem(ALLOWANCE_KEY)
    if (raw === null) return fresh()
    const data = JSON.parse(raw) as Ledger
    for (const key of ['hintUsed', 'undoUsed', 'hintCredits', 'undoCredits', 'dailyStarted', 'clock', 'rewardAvailableAt'] as const) {
      if (!Number.isSafeInteger(data[key]) || data[key] < 0) throw Error('Invalid saved allowances')
    }
    if (data.hintUsed > 5 || data.undoUsed > 5 || typeof data.lastRewardId !== 'string') throw Error('Invalid saved allowances')
    return data
  }
  const now = (data: Ledger) => {
    const elapsed = Math.max(0, monotonic() - elapsedAnchor)
    anchor = Math.max(anchor + elapsed, wall(), data.clock)
    elapsedAnchor = monotonic()
    return Math.floor(anchor)
  }
  const update = (change: (data: Ledger, time: number) => boolean) => {
    try {
      const data = read(), time = now(data)
      if (!change(data, time)) return false
      data.clock = time
      const serialized = JSON.stringify(data)
      storage().setItem(ALLOWANCE_KEY, serialized)
      if (storage().getItem(ALLOWANCE_KEY) !== serialized) return false
      listeners.forEach(listener => listener())
      return true
    } catch { return false } // Failed saves never grant a use, a reward or a Daily attempt.
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    status() {
      try {
        const data = read(), time = now(data)
        // Retain elapsed time during clock rollback across reloads. Never move the clock backward.
        if (time - data.clock >= 60000) { data.clock = time; storage().setItem(ALLOWANCE_KEY, JSON.stringify(data)) }
        return { available: true, hintFree: 5 - data.hintUsed, undoFree: 5 - data.undoUsed, hintCredits: data.hintCredits, undoCredits: data.undoCredits, dailyRemaining: data.dailyStarted ? Math.max(0, data.dailyStarted + DAY - time) : 0, rewardRemaining: 0 }
      } catch { return { available: false, hintFree: 0, undoFree: 0, hintCredits: 0, undoCredits: 0, dailyRemaining: 0, rewardRemaining: 0 } }
    },
    consume(kind: RewardKind) {
      return update(data => {
        const used = kind === 'hint' ? 'hintUsed' : 'undoUsed', credits = kind === 'hint' ? 'hintCredits' : 'undoCredits'
        if (data[used] < 5) data[used]++
        else if (data[credits] > 0) data[credits]--
        else return false
        return true
      })
    },
    dailyAttempt() {
      try { const data = read(); return data.dailyAttempt && data.dailyAttempt.started === data.dailyStarted && validDailyProgress(data.dailyAttempt) ? data.dailyAttempt : null } catch { return null }
    },
    saveDaily(attempt: DailyProgress) {
      return update(data => {
        if (!data.dailyAttempt || data.dailyStarted !== attempt.started || data.dailyAttempt.finished || !validDailyProgress(attempt)) return false
        data.dailyAttempt = attempt
        return true
      })
    },
    startDaily(completedLevels: number, attempt?: DailyProgress) {
      return update((data, time) => {
        if (data.dailyAttempt && !data.dailyAttempt.finished) return false
        if (completedLevels < 10 || (data.dailyStarted && time < data.dailyStarted + DAY)) return false
        if (attempt && !validDailyProgress(attempt)) return false
        data.dailyStarted = time
        data.dailyAttempt = attempt ? { ...attempt, started: time } : undefined
        return true
      })
    },
    grant(kind: RewardKind, id: string) {
      return update((data) => {
        if (!id || data.lastRewardId === id) return false
        data[kind === 'hint' ? 'hintCredits' : 'undoCredits'] += 3
        data.lastRewardId = id
        data.rewardAvailableAt = 0
        return true
      })
    },
  }
}
export const allowances = createAllowances(() => (globalThis.BUNOKU_PLAYGAMA || globalThis.BUNOKU_GAMEDISTRIBUTION) ? gameStorage : globalThis.localStorage)
export function countdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':')
}
