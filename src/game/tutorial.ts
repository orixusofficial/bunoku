import type { PuzzleDefinition } from './puzzle'
import { conflicts } from './progression.ts'
import { gameStorage } from '../playgama/storage.ts'

export type TutorialStep = 0 | 1 | 2 | 3 | 4 | 5
const KEY = 'bunoku.level1TutorialComplete'
let completedThisSession = false
export function tutorialComplete() {
  try { return completedThisSession || ((globalThis.BUNOKU_PLAYGAMA || globalThis.BUNOKU_GAMEDISTRIBUTION) ? gameStorage : localStorage).getItem(KEY) === 'true' } catch { return completedThisSession }
}
export function saveTutorialComplete() {
  completedThisSession = true
  try { ((globalThis.BUNOKU_PLAYGAMA || globalThis.BUNOKU_GAMEDISTRIBUTION) ? gameStorage : localStorage).setItem(KEY, 'true') } catch { /* Keep completion for this session. */ }
}
export function startingTutorialStep(puzzle: PuzzleDefinition, daily: boolean): TutorialStep {
  return !daily && puzzle.level === 1 && puzzle.size === 4 && !tutorialComplete() && tutorialTarget(puzzle) !== undefined ? 1 : 0
}
export function tutorialTarget(puzzle: PuzzleDefinition) {
  return puzzle.solution.find((index) => puzzle.regions[index] === puzzle.startRegion)
}
export function tutorialBlockedCells(puzzle: PuzzleDefinition): number[] {
  const target = tutorialTarget(puzzle)
  return target === undefined ? [] : puzzle.regions.flatMap((_, index) => index !== target && conflicts(puzzle.size, target, index) ? [index] : [])
}
