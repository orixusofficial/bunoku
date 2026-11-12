import { validatePuzzle } from './puzzle.ts'
import type { PuzzleDefinition } from './puzzle.ts'
import { gridForLevel } from './levels.ts'

export function createNormalPuzzleAsync(level: number, signal?: AbortSignal): Promise<PuzzleDefinition> {
  return createPuzzleAsync(gridForLevel(level), level, false, signal)
}

export function createPuzzleAsync(size: number, level: number, daily: boolean, signal?: AbortSignal): Promise<PuzzleDefinition> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./puzzle.worker.ts', import.meta.url), { type: 'module' })
    const timeout = setTimeout(() => finish(new Error('Preparing the puzzle took too long. Please try again.')), 5000)
    const finish = (error?: Error, puzzle?: PuzzleDefinition) => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      worker.terminate()
      if (error) reject(error)
      else if (puzzle) resolve(puzzle)
    }
    const abort = () => finish(new Error('Puzzle generation cancelled'))
    if (signal?.aborted) { abort(); return }
    signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = (event: MessageEvent<{ puzzle?: PuzzleDefinition; error?: string }>) => {
      const { puzzle, error } = event.data
      if (error) finish(new Error(error))
      else if (!puzzle || !validatePuzzle(puzzle)) finish(new Error('We couldn’t validate this puzzle. Please try again.'))
      else finish(undefined, puzzle)
    }
    worker.onerror = (event) => {
      console.error('Bunoku puzzle worker failed:', event.message, event.filename, event.lineno)
      finish(new Error('We couldn’t prepare the puzzle. Please try again.'))
    }
    worker.postMessage({ size, level, daily })
  })
}
