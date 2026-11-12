import { generateProgressivePuzzle } from './generator.ts'
import { availableRegions, automaticEliminations, forcedVisibleMove, simulateProgression } from './progression.ts'
import type { ProgressionStep } from './progression.ts'

export type CellState = 'empty' | 'mark' | 'rabbit' | 'given' | 'hint'
export type BoardState = { cells: CellState[]; lives: number }
export type PuzzleDefinition = {
  level: number
  size: number
  rabbitCount: number
  regions: number[]
  regionColors: string[]
  solution: number[]
  startRegion: number
  given?: number
  daily?: boolean
  progression?: ProgressionStep[]
}
export type DeductionMove = { cell: number; source: 'region' | 'row' | 'column'; unit: number }
export type DeductionReport = { solved: boolean; moves: DeductionMove[]; blockedRegions: { region: number; candidates: number[] }[] }
export type RankedRegionCandidates = { region: number; candidates: number[] }

function canShareSolution(size: number, placed: number[], candidate: number): boolean {
  const row = Math.floor(candidate / size), column = candidate % size
  return placed.every((other) => {
    const otherRow = Math.floor(other / size), otherColumn = other % size
    return row !== otherRow && column !== otherColumn && !(Math.abs(row - otherRow) <= 1 && Math.abs(column - otherColumn) <= 1)
  })
}

function canAdd(size: number, regions: number[], placed: number[], candidate: number): boolean {
  return !placed.some((other) => regions[candidate] === regions[other]) && canShareSolution(size, placed, candidate)
}

export function countSolutions(regions: number[], limit = Infinity, rabbitCount = Math.sqrt(regions.length)): number {
  const size = Math.sqrt(regions.length)
  if (!Number.isInteger(size) || !Number.isInteger(rabbitCount) || rabbitCount < 0 || rabbitCount > size) return 0
  let count = 0
  const placed: number[] = []
  const search = (row: number) => {
    if (placed.length === rabbitCount) { count += 1; return }
    if (row === size || placed.length + size - row < rabbitCount) return
    search(row + 1)
    if (count >= limit) return
    for (let column = 0; column < size; column += 1) {
      const index = row * size + column
      if (!canAdd(size, regions, placed, index)) continue
      placed.push(index); search(row + 1); placed.pop()
      if (count >= limit) return
    }
  }
  search(0)
  return count
}

function isConnectedRegion(size: number, regions: number[], id: number): boolean {
  const cells = regions.flatMap((region, index) => region === id ? [index] : [])
  if (!cells.length) return false
  const visited = new Set([cells[0]]), queue = [cells[0]]
  while (queue.length) {
    const current = queue.pop()!
    for (const next of cells) if (Math.abs(Math.floor(current / size) - Math.floor(next / size)) + Math.abs(current % size - next % size) === 1 && !visited.has(next)) { visited.add(next); queue.push(next) }
  }
  return visited.size === cells.length
}

export function validatePuzzle(puzzle: PuzzleDefinition): boolean {
  const { size, rabbitCount, regions, regionColors, solution } = puzzle
  if (!Number.isInteger(size) || size < 1 || !Number.isInteger(rabbitCount) || rabbitCount < 1 || rabbitCount > size || regions.length !== size * size) return false
  const ids = [...new Set(regions)]
  const regionCount = regionColors.length
  if (regionCount !== rabbitCount || ids.length !== regionCount || ids.some((id) => !Number.isInteger(id) || id < 0 || id >= regionCount) || new Set(regionColors).size !== regionCount) return false
  if (!ids.every((id) => isConnectedRegion(size, regions, id))) return false
  if (solution.length !== rabbitCount || new Set(solution).size !== rabbitCount || !solution.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < size * size)) return false
  for (let i = 0; i < solution.length; i += 1) if (!canAdd(size, regions, solution.slice(0, i), solution[i])) return false
  if (new Set(solution.map((cell) => regions[cell])).size !== rabbitCount) return false
  if (!ids.includes(puzzle.startRegion)) return false
  if (puzzle.given !== undefined && (!solution.includes(puzzle.given) || regions[puzzle.given] !== puzzle.startRegion)) return false
  if (puzzle.given === undefined && regions.filter((id) => id === puzzle.startRegion).length > 2) return false
  return true
}

export function getRegionCandidates(puzzle: PuzzleDefinition, cells: CellState[]): RankedRegionCandidates[] {
  return availableRegions(puzzle, cells, [], false).map(({ region, cells: candidates }) => ({ region, candidates }))
}

export function rankRegionCandidates(puzzle: PuzzleDefinition, cells: CellState[]): RankedRegionCandidates[] {
  return getRegionCandidates(puzzle, cells)
}

export function getForcedDeduction(puzzle: PuzzleDefinition, cells: CellState[]): DeductionMove | null {
  const cell = forcedVisibleMove(puzzle, cells)
  return cell === null ? null : { cell, source: 'region', unit: puzzle.regions[cell] }
}

export function solveByDeduction(puzzle: PuzzleDefinition): DeductionReport {
  const replay = simulateProgression(puzzle)
  return { solved: replay.solved, moves: replay.steps.map(({ cell, region }) => ({ cell, source: 'region', unit: region })), blockedRegions: replay.solved ? [] : getRegionCandidates(puzzle, replay.cells) }
}

export function createPuzzle(level = 1, random: () => number = Math.random): PuzzleDefinition {
  const puzzle = generateProgressivePuzzle(4, level, false, random)
  if (!validatePuzzle(puzzle)) throw new Error('Generated Bunoku puzzle failed validation')
  return puzzle
}

export function createDailyPuzzle(random: () => number = Math.random): PuzzleDefinition {
  const puzzle = generateProgressivePuzzle(9, 0, true, random)
  if (!validatePuzzle(puzzle)) throw new Error('Generated Daily Puzzle failed validation')
  return puzzle
}

export { automaticEliminations }

export function createInitialState(puzzle: PuzzleDefinition): BoardState {
  const cells: CellState[] = Array(puzzle.size * puzzle.size).fill('empty')
  if (puzzle.given !== undefined) cells[puzzle.given] = 'given'
  return { cells, lives: 3 }
}

export function isValidPlacement(puzzle: PuzzleDefinition, cells: CellState[], index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= cells.length || (cells[index] !== 'empty' && cells[index] !== 'mark')) return false
  const rabbits = cells.flatMap((cell, i) => cell === 'rabbit' || cell === 'given' || cell === 'hint' ? [i] : [])
  return rabbits.length < puzzle.rabbitCount && canAdd(puzzle.size, puzzle.regions, rabbits, index)
}

export function isSolutionPlacement(puzzle: PuzzleDefinition, index: number): boolean { return puzzle.solution.includes(index) }
export function attemptPlacement(puzzle: PuzzleDefinition, state: BoardState, index: number): { state: BoardState; accepted: boolean; mistake: boolean } {
  if (state.cells[index] === 'given' || state.cells[index] === 'rabbit' || state.cells[index] === 'hint') return { state, accepted: false, mistake: false }
  if (!isSolutionPlacement(puzzle, index) || !isValidPlacement(puzzle, state.cells, index)) return { state: { cells: [...state.cells], lives: Math.max(0, state.lives - 1) }, accepted: false, mistake: true }
  const cells = [...state.cells]; cells[index] = 'rabbit'
  return { state: { cells, lives: state.lives }, accepted: true, mistake: false }
}
export function isComplete(puzzle: PuzzleDefinition, cells: CellState[]): boolean {
  const placed = cells.flatMap((cell, index) => cell === 'rabbit' || cell === 'given' || cell === 'hint' ? [index] : [])
  return placed.length === puzzle.rabbitCount && placed.every((index, i) => placed.slice(i + 1).every((other) => canAdd(puzzle.size, puzzle.regions, [index], other)))
}
export function findHint(puzzle: PuzzleDefinition, cells: CellState[], excluded: number[] = []): number | null {
  // A preview is not a placed rabbit. Recalculate only from the real board.
  return forcedVisibleMove(puzzle, cells, excluded) ?? forcedVisibleMove(puzzle, cells)
}
