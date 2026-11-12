import { generateProgressivePuzzle } from './generator.ts'
import { validatePuzzle } from './puzzle.ts'
import { gridForLevel } from './levels.ts'

const worker = self as unknown as Pick<Worker, 'postMessage' | 'onmessage'>
worker.onmessage = (event: MessageEvent<{ size: number; level: number; daily: boolean }>) => {
  try {
    const { size, level, daily } = event.data
    const puzzle = generateProgressivePuzzle(daily ? size : gridForLevel(level), level, daily)
    if (!validatePuzzle(puzzle)) throw new Error('Puzzle validation failed')
    worker.postMessage({ puzzle })
  } catch (error) {
    worker.postMessage({ error: error instanceof Error ? error.message : 'Unable to prepare a puzzle. Please try again.' })
  }
}
