import type { CellState } from './puzzle'

export type RegionBoard = { size: number; rabbitCount: number; regions: number[] }
export type RegionAvailability = { region: number; cells: number[] }
export type ProgressionStep = {
  cell: number
  region: number
  before: (number | null)[]
  after: (number | null)[]
  affectedRegions: number[]
  reason: 'only-remaining-box'
}

export const hasRabbit = (cell: CellState) => cell === 'rabbit' || cell === 'given' || cell === 'hint'

export function conflicts(size: number, first: number, second: number): boolean {
  const row = Math.floor(first / size), column = first % size
  const otherRow = Math.floor(second / size), otherColumn = second % size
  return row === otherRow || column === otherColumn || (Math.abs(row - otherRow) <= 1 && Math.abs(column - otherColumn) <= 1)
}

// Derived from rabbits, never from the hidden solution or the player's pencil marks.
export function automaticEliminations(board: RegionBoard, cells: CellState[]): boolean[] {
  const rabbits = cells.flatMap((cell, index) => hasRabbit(cell) ? [index] : [])
  const filledRegions = new Set(rabbits.map((cell) => board.regions[cell]))
  return cells.map((cell, index) => !hasRabbit(cell) && (filledRegions.has(board.regions[index]) || rabbits.some((rabbit) => conflicts(board.size, rabbit, index))))
}

export function availableRegions(board: RegionBoard, cells: CellState[], failed: number[] = [], includeManualMarks = true): RegionAvailability[] {
  const eliminated = automaticEliminations(board, cells)
  const solved = new Set(cells.flatMap((cell, index) => hasRabbit(cell) ? [board.regions[index]] : []))
  const failures = new Set(failed)
  return [...new Set(board.regions)].filter((region) => !solved.has(region)).map((region) => ({
    region,
    cells: board.regions.flatMap((id, index) => id === region && !hasRabbit(cells[index]) && !eliminated[index] && !failures.has(index) && (!includeManualMarks || cells[index] !== 'mark') ? [index] : []),
  })).sort((a, b) => a.cells.length - b.cells.length || a.region - b.region)
}

function counts(board: RegionBoard, cells: CellState[]): (number | null)[] {
  const result: (number | null)[] = Array(board.rabbitCount).fill(null)
  for (const region of availableRegions(board, cells)) result[region.region] = region.cells.length
  return result
}

// A singleton is a proof under one-rabbit-per-region. No two-cell guesses or search.
export function forcedVisibleMove(board: RegionBoard, cells: CellState[], excluded: number[] = []): number | null {
  // Pencil marks cannot justify a rabbit; an accidentally marked solution is still hintable.
  const forced = availableRegions(board, cells, [], false).filter((region) => region.cells.length === 1 && !excluded.includes(region.cells[0]))
  let best: number | null = null, bestReduction = -1
  for (const region of forced) {
    const next = [...cells]
    next[region.cells[0]] = 'rabbit'
    const before = counts(board, cells), after = counts(board, next)
    const reduction = before.reduce<number>((sum, count, id) => sum + (id !== region.region && count !== null && after[id] !== null ? count - after[id]! : 0), 0)
    if (reduction > bestReduction) { best = region.cells[0]; bestReduction = reduction }
  }
  return best
}

export function simulateProgression(board: RegionBoard): { solved: boolean; steps: ProgressionStep[]; cells: CellState[] } {
  const cells: CellState[] = Array(board.size * board.size).fill('empty')
  const steps: ProgressionStep[] = []
  for (let turn = 0; turn < board.rabbitCount; turn += 1) {
    if (availableRegions(board, cells).some((region) => region.cells.length === 0)) break
    const cell = forcedVisibleMove(board, cells)
    if (cell === null) break
    const before = counts(board, cells)
    cells[cell] = 'rabbit'
    const after = counts(board, cells)
    const region = board.regions[cell]
    const affectedRegions = before.flatMap((count, id) => id !== region && count !== null && after[id] !== null && after[id]! < count ? [id] : [])
    steps.push({ cell, region, before, after, affectedRegions, reason: 'only-remaining-box' })
  }
  return { solved: steps.length === board.rabbitCount, steps, cells }
}
