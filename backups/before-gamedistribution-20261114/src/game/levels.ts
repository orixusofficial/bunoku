import { gameStorage } from '../playgama/storage.ts'
const PROGRESS_KEY = 'bunoku.normalLevel'
type ProgressStorage = Pick<Storage, 'getItem' | 'setItem'>

export function gridForLevel(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1) throw new Error('Invalid Bunoku level')
  if (level === 1) return 4
  if (level % 10 === 0) return 9
  if (level % 10 === 5) return 8
  return 6
}

export function difficultyTier(level: number): number {
  gridForLevel(level)
  return Math.min(4, Math.floor((level - 1) / 10))
}

export function loadNormalLevel(storage?: ProgressStorage): number {
  try {
    const value = Number((storage ?? (globalThis.BUNOKU_PLAYGAMA ? gameStorage : globalThis.localStorage)).getItem(PROGRESS_KEY))
    return Number.isSafeInteger(value) && value > 0 ? value : 1
  } catch { return 1 }
}

export function saveNormalLevel(level: number, storage?: ProgressStorage): void {
  gridForLevel(level)
  try {
    const target = storage ?? (globalThis.BUNOKU_PLAYGAMA ? gameStorage : globalThis.localStorage)
    target.setItem(PROGRESS_KEY, String(Math.max(loadNormalLevel(target), level)))
  } catch { /* Gameplay remains usable when browser storage is unavailable. */ }
}
