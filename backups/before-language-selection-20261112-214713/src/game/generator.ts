import { conflicts, simulateProgression } from './progression.ts'
import type { ProgressionStep } from './progression.ts'
import { difficultyTier } from './levels.ts'

const COLORS = ['#D9C7A3', '#C8D5B9', '#E7D9D0', '#C9D8DF', '#D8D0E5', '#E8DCA8', '#E7C8B5', '#BFD8CC', '#D4D0C4']
export type GeneratedPuzzle = {
  level: number; size: number; rabbitCount: number; regions: number[]; regionColors: string[]
  solution: number[]; startRegion: number; daily: boolean; progression: ProgressionStep[]
  difficulty: { tier: number; score: number; selectionSamples: number }
}

function shuffled<T>(values: T[], random: () => number): T[] {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]] }
  return result
}

function neighbors(size: number, cell: number): number[] {
  const row = Math.floor(cell / size), col = cell % size
  return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
    .filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size).map(([r, c]) => r * size + c)
}

function connected(size: number, cells: Set<number>): boolean {
  const first = cells.values().next().value
  if (first === undefined) return false
  const seen = new Set([first]), queue = [first]
  while (queue.length) for (const cell of neighbors(size, queue.pop()!)) if (cells.has(cell) && !seen.has(cell)) { seen.add(cell); queue.push(cell) }
  return seen.size === cells.size
}

function irregular(size: number, cells: number[]): boolean {
  if (cells.length <= 2) return false
  const rows = cells.map((cell) => Math.floor(cell / size)), cols = cells.map((cell) => cell % size)
  const height = Math.max(...rows) - Math.min(...rows) + 1, width = Math.max(...cols) - Math.min(...cols) + 1
  return height > 1 && width > 1 && height * width !== cells.length
}

function rabbitSolution(size: number, random: () => number): number[] | null {
  const placed: number[] = []
  let budget = 10_000
  const search = (row: number): boolean => {
    if (--budget < 0) return false
    if (row === size) return true
    for (const col of shuffled(Array.from({ length: size }, (_, id) => id), random)) {
      const cell = row * size + col
      if (placed.some((other) => conflicts(size, cell, other))) continue
      placed.push(cell)
      if (search(row + 1)) return true
      placed.pop()
    }
    return false
  }
  return search(0) ? placed : null
}

// Carve connected regions while preserving a connected remainder. Every filler in
// region k is already eliminated by rabbits 0..k-1, so its rabbit becomes forced.
function carveRegions(size: number, solution: number[], random: () => number): number[] | null {
  const remaining = new Set(Array.from({ length: size * size }, (_, cell) => cell))
  const regions = Array(size * size).fill(-1) as number[]
  const targets = new Set(solution)
  const anchors = solution.map((cell, stage) => stage === 0 ? -1 : cell - size)
  for (let stage = 0; stage < size - 1; stage += 1) {
    const group = [solution[stage]]
    if (stage > 0) group.push(anchors[stage])
    if (group.some((cell) => !remaining.has(cell))) return null
    group.forEach((cell) => remaining.delete(cell))
    const protectedAnchors = new Set(anchors.slice(stage + 1))
    const prior = solution.slice(0, stage)
    const absorbOrphans = (): boolean => {
      const unseen = new Set(remaining), components: number[][] = []
      while (unseen.size) {
        const first = unseen.values().next().value!
        const component = [first], queue = [first]
        unseen.delete(first)
        while (queue.length) for (const cell of neighbors(size, queue.pop()!)) if (unseen.delete(cell)) { component.push(cell); queue.push(cell) }
        components.push(component)
      }
      if (components.length === 1) return true
      if (stage === 0) return false
      const future = solution.slice(stage + 1)
      const main = components.find((component) => future.every((cell) => component.includes(cell)))
      if (!main) return false
      const orphans = components.filter((component) => component !== main).flat()
      if (orphans.some((cell) => targets.has(cell) || protectedAnchors.has(cell) || !prior.some((rabbit) => conflicts(size, rabbit, cell)))) return false
      orphans.forEach((cell) => { remaining.delete(cell); group.push(cell) })
      return true
    }
    if (!absorbOrphans()) return null
    if (stage > 0) {
      const desired = 3 + Math.floor(random() * Math.max(1, size - 1))
      while (group.length < desired && remaining.size > 3 * (size - stage - 1)) {
        const frontier = shuffled([...new Set(group.flatMap((cell) => neighbors(size, cell)))], random)
        let added = false
        for (const cell of frontier) {
          if (!remaining.has(cell) || targets.has(cell) || protectedAnchors.has(cell) || !prior.some((rabbit) => conflicts(size, rabbit, cell))) continue
          const snapshot = new Set(remaining), groupLength = group.length
          remaining.delete(cell)
          group.push(cell)
          if (!absorbOrphans() || remaining.size < 3 * (size - stage - 1)) {
            remaining.clear(); snapshot.forEach((saved) => remaining.add(saved)); group.length = groupLength; continue
          }
          added = true; break
        }
        if (!added) break
      }
      if (!irregular(size, group)) return null
    }
    group.forEach((cell) => { regions[cell] = stage })
  }
  const last = [...remaining]
  if (!irregular(size, last) || !connected(size, remaining) || !last.includes(solution[size - 1])) return null
  last.forEach((cell) => { regions[cell] = size - 1 })
  return regions
}

export function generateProgressivePuzzle(size: number, level = 1, daily = false, random: () => number = Math.random): GeneratedPuzzle {
  if (![4, 6, 8, 9].includes(size)) throw new Error('Unsupported Bunoku board size')
  const tier = daily ? 0 : difficultyTier(level)
  const sampleTarget = 1 + tier * 4
  let best: GeneratedPuzzle | null = null, accepted = 0
  for (let attempt = 0; attempt < Math.min(1024, 256 * sampleTarget); attempt += 1) {
    const solution = rabbitSolution(size, random)
    if (!solution) continue
    const regions = carveRegions(size, solution, random)
    if (!regions) continue
    const turns = Math.floor(random() * 4), reflect = random() < 0.5
    const transform = (cell: number) => {
      let row = Math.floor(cell / size), col = cell % size
      if (reflect) col = size - 1 - col
      for (let turn = 0; turn < turns; turn += 1) [row, col] = [col, size - 1 - row]
      return row * size + col
    }
    const ids = shuffled(Array.from({ length: size }, (_, id) => id), random)
    const layout = Array(size * size).fill(-1) as number[]
    regions.forEach((region, cell) => { layout[transform(cell)] = ids[region] })
    const puzzle = { level, size, rabbitCount: size, regions: layout, regionColors: shuffled(COLORS, random).slice(0, size), solution: solution.map(transform), startRegion: ids[0], daily }
    const replay = simulateProgression(puzzle)
    if (!replay.solved || replay.steps.some((step) => !puzzle.solution.includes(step.cell))) continue
    if (replay.steps.slice(0, -1).some((step) => step.affectedRegions.length === 0)) continue
    // Compare same-size puzzles by their deduction paths, not their cell counts.
    // Fewer simultaneous singles require more comparison; more remaining boxes
    // require more elimination tracking. Boundary turns add spatial complexity.
    const pathScore = replay.steps.slice(1, -1).reduce((score, step) => {
      const counts = step.before.filter((count): count is number => count !== null)
      return score + 2 / counts.filter((count) => count === 1).length + counts.reduce((sum, count) => sum + count - 1, 0) / (size * size)
    }, 0) / size
    const boundaryTurns = layout.reduce((sum, region, cell) => {
      const row = Math.floor(cell / size), col = cell % size
      return sum + Number(row + 1 < size && col + 1 < size && layout[cell + 1] !== region && layout[cell + size] !== region)
    }, 0) / (size * size)
    const score = pathScore + boundaryTurns
    accepted += 1
    if (!best || score > best.difficulty.score) best = { ...puzzle, progression: replay.steps, difficulty: { tier, score, selectionSamples: accepted } }
    if (accepted >= sampleTarget) break
  }
  if (best) { best.difficulty.selectionSamples = accepted; return best }
  throw new Error('We couldn’t prepare a puzzle with a complete logical progression. Please try again.')
}
