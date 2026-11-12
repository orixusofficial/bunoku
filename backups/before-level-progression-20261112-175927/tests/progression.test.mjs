import assert from 'node:assert/strict'
import test from 'node:test'
import { generateProgressivePuzzle } from '../src/game/generator.ts'
import { availableRegions, automaticEliminations, simulateProgression } from '../src/game/progression.ts'

export function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
}

function referenceBlocked(p, placed, cell) {
  const row = Math.floor(cell / p.size), col = cell % p.size
  return placed.some((other) => {
    const r = Math.floor(other / p.size), c = other % p.size
    return p.regions[cell] === p.regions[other] || row === r || col === c || (Math.abs(row - r) <= 1 && Math.abs(col - c) <= 1)
  })
}

function assertConnected(p, id) {
  const members = p.regions.flatMap((region, cell) => region === id ? [cell] : [])
  const queue = [members[0]], visited = new Set(queue)
  while (queue.length) {
    const from = queue.pop()
    for (const cell of members) if (!visited.has(cell) && Math.abs(Math.floor(from / p.size) - Math.floor(cell / p.size)) + Math.abs(from % p.size - cell % p.size) === 1) { visited.add(cell); queue.push(cell) }
  }
  assert.equal(visited.size, members.length)
}

// Independent enumeration by row, rather than replaying the generator's certificate.
function independentSolutionCount(p) {
  const singletons = p.regions.flatMap((id, cell) => p.regions.filter((other) => other === id).length === 1 ? [cell] : [])
  const fixedRows = new Map(singletons.map((cell) => [Math.floor(cell / p.size), cell % p.size]))
  let count = 0, nodes = 0
  const usedCols = new Set(), usedRegions = new Set()
  const search = (row, previousCol) => {
    assert(++nodes < 1_000_000, 'independent validation stays bounded')
    if (row === p.size) { count++; return }
    const choices = fixedRows.has(row) ? [fixedRows.get(row)] : Array.from({ length: p.size }, (_, col) => col)
    for (const col of choices) {
      const region = p.regions[row * p.size + col]
      if (usedCols.has(col) || usedRegions.has(region) || (row > 0 && Math.abs(previousCol - col) <= 1)) continue
      usedCols.add(col); usedRegions.add(region)
      search(row + 1, col)
      usedCols.delete(col); usedRegions.delete(region)
      if (count >= 2) return
    }
  }
  search(0, -99)
  return count
}

for (const size of [4, 6, 8, 9]) test(`${size}x${size}: 100 boards have complete, independently verified visible progressions`, () => {
  const layouts = new Set(), solutions = new Set(), times = []
  for (let seed = 1; seed <= 100; seed++) {
    const start = performance.now()
    const p = generateProgressivePuzzle(size, 1, size === 9, seeded(seed * 103 + size))
    times.push(performance.now() - start)
    layouts.add(p.regions.join(',')); solutions.add([...p.solution].sort((a, b) => a - b).join(','))
    assert.equal(new Set(p.regions).size, size)
    assert.equal(new Set(p.regionColors).size, size)
    assert.equal(p.solution.length, size)
    assert.equal(new Set(p.solution.map((cell) => Math.floor(cell / size))).size, size)
    assert.equal(new Set(p.solution.map((cell) => cell % size)).size, size)
    assert.equal(new Set(p.solution.map((cell) => p.regions[cell])).size, size)
    for (let a = 0; a < size; a++) for (let b = a + 1; b < size; b++) {
      assert(Math.abs(Math.floor(p.solution[a] / size) - Math.floor(p.solution[b] / size)) > 1 || Math.abs(p.solution[a] % size - p.solution[b] % size) > 1)
    }
    for (let id = 0; id < size; id++) assertConnected(p, id)
    assert.equal(p.regions.filter((id) => id === p.startRegion).length, 1)
    assert.equal(independentSolutionCount(p), 1)
    const replay = simulateProgression(p)
    assert(replay.solved)
    assert.deepEqual(replay.steps, p.progression)
    const placed = []
    for (const step of replay.steps) {
      const solved = new Set(placed.map((cell) => p.regions[cell]))
      const counts = Array.from({ length: size }, (_, id) => solved.has(id) ? null : p.regions.filter((region, cell) => region === id && !referenceBlocked(p, placed, cell)).length)
      assert.deepEqual(step.before, counts)
      assert.equal(counts[step.region], 1)
      assert(p.solution.includes(step.cell))
      if (placed.length < size - 1) assert(step.affectedRegions.length > 0, 'every nonfinal placement helps another color')
      placed.push(step.cell)
    }
    assert.deepEqual([...placed].sort((a, b) => a - b), [...p.solution].sort((a, b) => a - b))
  }
  assert(layouts.size >= 10, 'at least 10 genuinely different region memberships')
  // Only two non-touching full rabbit permutations exist on a 4x4 board.
  assert(solutions.size >= (size === 4 ? 2 : 10))
  console.log(JSON.stringify({ size, boards: 100, distinctLayouts: layouts.size, distinctSolutions: solutions.size, maxMs: Math.round(Math.max(...times)), averageMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length) }))
})

test('visible pencil counts are distinct from rule deductions and automatic Xs are reversible', () => {
  const p = generateProgressivePuzzle(4, 1, false, seeded(27))
  const cells = Array(16).fill('empty')
  const first = p.progression[0].cell
  assert.equal(automaticEliminations(p, cells).filter(Boolean).length, 0)
  cells[first] = 'mark'
  assert.equal(availableRegions(p, cells).find((region) => region.region === p.startRegion).cells.length, 0)
  assert.equal(availableRegions(p, cells, [], false).find((region) => region.region === p.startRegion).cells.length, 1)
  cells[first] = 'rabbit'
  assert(automaticEliminations(p, cells).some(Boolean))
  cells[first] = 'empty'
  assert.equal(automaticEliminations(p, cells).filter(Boolean).length, 0)
})
