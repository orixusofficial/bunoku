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
  given: number
  daily?: boolean
}
export type DeductionMove = { cell: number; source: 'region' | 'row' | 'column'; unit: number }
export type DeductionReport = { solved: boolean; moves: DeductionMove[]; blockedRegions: { region: number; candidates: number[] }[] }
export type RankedRegionCandidates = { region: number; candidates: number[] }

const NORMAL_COLORS = ['#D9C7A3', '#C8D5B9', '#E7D9D0', '#C9D8DF']
const DAILY_COLORS = ['#D9C7A3', '#C8D5B9', '#E7D9D0', '#C9D8DF', '#D8D0E5', '#E8DCA8', '#E7C8B5', '#BFD8CC', '#D4D0C4']
const NORMAL_REGIONS = [0,0,0,0, 1,1,1,1, 2,2,2,3, 2,3,3,3]
const NORMAL_SOLUTION = [1,7,8,14]

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
  if (ids.length !== regionCount || ids.some((id) => !Number.isInteger(id) || id < 0 || id >= regionCount) || new Set(regionColors).size !== regionCount) return false
  if (size * size % regionCount !== 0 || ids.some((id) => regions.filter((region) => region === id).length !== size * size / regionCount)) return false
  if (!ids.every((id) => isConnectedRegion(size, regions, id))) return false
  if (solution.length !== rabbitCount || new Set(solution).size !== rabbitCount || !solution.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < size * size)) return false
  for (let i = 0; i < solution.length; i += 1) if (!canAdd(size, regions, solution.slice(0, i), solution[i])) return false
  if (new Set(solution.map((cell) => regions[cell])).size !== rabbitCount) return false
  if (!solution.includes(puzzle.given) || regions[puzzle.given] !== puzzle.startRegion) return false
  return true
}

export function getRegionCandidates(puzzle: PuzzleDefinition, cells: CellState[]): RankedRegionCandidates[] {
  const regionCount = puzzle.regionColors.length
  return Array.from({ length: regionCount }, (_, region) => ({
    region,
    candidates: puzzle.regions.flatMap((id, cell) => id === region && (cells[cell] === 'empty' || cells[cell] === 'mark') && isValidPlacement(puzzle, cells, cell) ? [cell] : []),
  })).filter(({ region }) => !cells.some((cell, index) => region === puzzle.regions[index] && (cell === 'rabbit' || cell === 'given' || cell === 'hint')))
}

export function rankRegionCandidates(puzzle: PuzzleDefinition, cells: CellState[]): RankedRegionCandidates[] {
  return getRegionCandidates(puzzle, cells).sort((first, second) => first.candidates.length - second.candidates.length || first.region - second.region)
}

type CompletionSearch = { found: boolean; complete: boolean }

function hasValidCompletion(puzzle: PuzzleDefinition, cells: CellState[], nodeBudget: { remaining: number }): CompletionSearch {
  const state = [...cells]
  const search = (): CompletionSearch => {
    if (nodeBudget.remaining <= 0) return { found: false, complete: false }
    nodeBudget.remaining -= 1
    const placed = state.filter((cell) => cell === 'rabbit' || cell === 'given' || cell === 'hint').length
    if (placed === puzzle.rabbitCount) return { found: true, complete: true }
    const ranked = rankRegionCandidates(puzzle, state)
    if (!ranked.length || ranked[0].candidates.length === 0) return { found: false, complete: true }
    if (puzzle.rabbitCount === puzzle.regionColors.length && ranked.some(({ candidates }) => candidates.length === 0)) return { found: false, complete: true }
    const next = ranked.find(({ candidates }) => candidates.length > 0)
    if (!next) return { found: false, complete: true }
    for (const candidate of next.candidates) {
      state[candidate] = 'rabbit'
      const result = search()
      state[candidate] = cells[candidate]
      if (result.found || !result.complete) return result
    }
    return { found: false, complete: true }
  }
  return search()
}

export function getForcedDeduction(puzzle: PuzzleDefinition, cells: CellState[]): DeductionMove | null {
  const regions = rankRegionCandidates(puzzle, cells)
  const forcedRegion = puzzle.rabbitCount === puzzle.regionColors.length
    ? regions.find(({ candidates }) => candidates.length === 1)
    : undefined
  if (forcedRegion) return { cell: forcedRegion.candidates[0], source: 'region', unit: forcedRegion.region }
  const placed = cells.flatMap((cell, index) => cell === 'rabbit' || cell === 'given' || cell === 'hint' ? [index] : [])
  for (const axis of ['row', 'column'] as const) for (let unit = 0; unit < puzzle.size; unit += 1) {
    const indices = Array.from({ length: puzzle.size * puzzle.size }, (_, index) => index).filter((index) => (axis === 'row' ? Math.floor(index / puzzle.size) : index % puzzle.size) === unit)
    if (indices.some((index) => placed.includes(index))) continue
    const candidates = indices.filter((index) => (cells[index] === 'empty' || cells[index] === 'mark') && isValidPlacement(puzzle, cells, index))
    if (candidates.length === 1) return { cell: candidates[0], source: axis, unit }
  }

  if (puzzle.rabbitCount !== puzzle.regionColors.length) return null
  const remaining = { remaining: 2_000 }
  for (const region of regions.filter(({ candidates }) => candidates.length > 1)) {
    const supported: number[] = []
    for (const candidate of region.candidates) {
      const candidateState = [...cells]
      candidateState[candidate] = 'rabbit'
      const result = hasValidCompletion(puzzle, candidateState, remaining)
      if (!result.complete) return null
      if (result.found) supported.push(candidate)
      if (supported.length > 1) break
    }
    if (supported.length === 1) return { cell: supported[0], source: 'region', unit: region.region }
  }
  return null
}

export function solveByDeduction(puzzle: PuzzleDefinition): DeductionReport {
  const state = createInitialState(puzzle)
  const moves: DeductionMove[] = []
  const limit = puzzle.size * puzzle.rabbitCount
  while (moves.length < limit) {
    const placed = state.cells.filter((cell) => cell === 'rabbit' || cell === 'given' || cell === 'hint').length
    if (placed === puzzle.rabbitCount) return { solved: true, moves, blockedRegions: [] }
    const deduction = getForcedDeduction(puzzle, state.cells)
    if (!deduction) break
    state.cells[deduction.cell] = 'rabbit'
    moves.push(deduction)
  }
  return { solved: isComplete(puzzle, state.cells), moves, blockedRegions: getRegionCandidates(puzzle, state.cells) }
}

export function createPuzzle(level = 1, random: () => number = Math.random): PuzzleDefinition {
  const startRegion = Math.min(3, Math.floor(random() * 4))
  const given = NORMAL_SOLUTION.find((cell) => NORMAL_REGIONS[cell] === startRegion)!
  const puzzle: PuzzleDefinition = { level, size: 4, rabbitCount: 4, regions: [...NORMAL_REGIONS], regionColors: NORMAL_COLORS, solution: [...NORMAL_SOLUTION], startRegion, given }
  if (!validatePuzzle(puzzle) || countSolutions(puzzle.regions, 2) !== 1) throw new Error('Unable to generate a valid unique Bunoku 4x4 puzzle')
  return puzzle
}

function shuffled<T>(values: T[], random: () => number): T[] {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]] }
  return result
}

function generateRabbitSolution(regions: number[], random: () => number): number[] | null {
  const size = 9
  const placed: number[] = []
  let searchBudget = 1_000_000
  const search = (row: number): boolean => {
    if (--searchBudget < 0) return false
    if (row === size) return true
    for (const col of shuffled(Array.from({ length: size }, (_, index) => index), random)) {
      const cell = row * size + col
      if (!canAdd(size, regions, placed, cell)) continue
      placed.push(cell)
      if (search(row + 1)) return true
      placed.pop()
    }
    return false
  }
  return search(0) ? [...placed] : null
}

function makeBlockRegions(): number[] {
  return Array.from({ length: 81 }, (_, index) => Math.floor(Math.floor(index / 9) / 3) * 3 + Math.floor((index % 9) / 3))
}

function irregularizeRegions(regions: number[], solution: number[], random: () => number): number[] {
  const size = 9, result = [...regions]
  for (let accepted = 0, attempts = 0; accepted < 60 && attempts < 5000; attempts += 1) {
    const first = Math.floor(random() * 81)
    if (solution.includes(first)) continue
    const second = Math.floor(random() * 81)
    if (first === second || solution.includes(second) || result[second] === result[first]) continue
    const firstRegion = result[first], secondRegion = result[second]
    result[first] = secondRegion; result[second] = firstRegion
    if (isConnectedRegion(size, result, firstRegion) && isConnectedRegion(size, result, secondRegion)) accepted += 1
    else { result[first] = firstRegion; result[second] = secondRegion }
  }
  return result
}

function chooseStartingClue(regions: number[], solution: number[], colors: string[]): number {
  let bestCell = solution[0]
  let bestScore = Number.POSITIVE_INFINITY
  for (const given of solution) {
    const puzzle: PuzzleDefinition = { level: 0, size: 9, rabbitCount: 9, regions, regionColors: colors, solution, startRegion: regions[given], given, daily: true }
    const counts = rankRegionCandidates(puzzle, createInitialState(puzzle).cells).map(({ candidates }) => candidates.length)
    const score = (counts[0] ?? 9) * 100 + counts.slice(1, 4).reduce((sum, count) => sum + Math.min(count, 9), 0)
    if (score < bestScore) { bestCell = given; bestScore = score }
  }
  return bestCell
}

function transformCell(index: number, turns: number, reflect: boolean): number {
  let row = Math.floor(index / 9), col = index % 9
  if (reflect) col = 8 - col
  for (let turn = 0; turn < turns; turn += 1) [row, col] = [col, 8 - row]
  return row * 9 + col
}

function transformBoard(regions: number[], solution: number[], turns: number, reflect: boolean): { regions: number[]; solution: number[] } {
  const transformed = Array(81).fill(0)
  regions.forEach((id, index) => { transformed[transformCell(index, turns, reflect)] = id })
  return { regions: transformed, solution: solution.map((cell) => transformCell(cell, turns, reflect)) }
}

export function createDailyPuzzle(random: () => number = Math.random): PuzzleDefinition {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let regions = makeBlockRegions()
    const solution = generateRabbitSolution(regions, random)
    if (!solution) continue
    regions = irregularizeRegions(regions, solution, random)
    const colors = shuffled(DAILY_COLORS, random)
    const turns = Math.floor(random() * 4), reflect = random() < 0.5
    const transformed = transformBoard(regions, solution, turns, reflect)
    const given = chooseStartingClue(transformed.regions, transformed.solution, colors)
    const startRegion = transformed.regions[given]
    const puzzle: PuzzleDefinition = { level: 0, size: 9, rabbitCount: 9, regions: transformed.regions, regionColors: colors, solution: transformed.solution, startRegion, given, daily: true }
    if (validatePuzzle(puzzle)) return puzzle
  }
  throw new Error('Unable to generate a valid Bunoku 9x9 daily puzzle')
}

export function createInitialState(puzzle: PuzzleDefinition): BoardState {
  const cells: CellState[] = Array(puzzle.size * puzzle.size).fill('empty')
  cells[puzzle.given] = 'given'
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
  const deductions = [...cells]
  for (const index of excluded) if (isValidPlacement(puzzle, deductions, index)) deductions[index] = 'rabbit'
  return getForcedDeduction(puzzle, deductions)?.cell ?? null
}
