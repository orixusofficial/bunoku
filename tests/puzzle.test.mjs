import assert from 'node:assert/strict'
import test from 'node:test'
import { attemptPlacement, automaticEliminations, createInitialState, createPuzzle, createDailyPuzzle, countSolutions, findHint, isComplete, validatePuzzle } from '../src/game/puzzle.ts'
import { availableRegions } from '../src/game/progression.ts'

function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
}

for (const [name, create] of [['normal', () => createPuzzle(1, seeded(71))], ['daily', () => createDailyPuzzle(seeded(83))]]) {
  test(`${name}: real game adapter starts hidden and finishes using real hints and placements`, () => {
    const puzzle = create()
    assert(validatePuzzle(puzzle))
    assert.equal(puzzle.given, undefined)
    assert.equal(countSolutions(puzzle.regions, 2), 1)
    let state = createInitialState(puzzle)
    assert(state.cells.every((cell) => cell === 'empty'))
    assert.equal(state.lives, 3)
    assert.equal(automaticEliminations(puzzle, state.cells).filter(Boolean).length, 0)
    const initialHint = findHint(puzzle, state.cells)
    assert.equal(puzzle.regions[initialHint], puzzle.startRegion)
    for (let turn = 0; turn < puzzle.rabbitCount; turn++) {
      const snapshot = structuredClone(state)
      const index = findHint(puzzle, state.cells)
      assert.notEqual(index, null)
      assert(availableRegions(puzzle, state.cells, [], false).some((region) => region.cells.length === 1 && region.cells[0] === index))
      const repeatedPreview = findHint(puzzle, state.cells, [index])
      assert(availableRegions(puzzle, state.cells, [], false).some((region) => region.cells.length === 1 && region.cells[0] === repeatedPreview))
      assert.deepEqual(state, snapshot, 'hint previews never change actual game state')
      state.cells[index] = 'mark'
      assert.equal(findHint(puzzle, state.cells), index, 'a pencil X cannot hide a proved hint')
      const before = structuredClone(state)
      const result = attemptPlacement(puzzle, state, index)
      assert(result.accepted)
      assert.equal(result.state.lives, 3)
      assert(automaticEliminations(puzzle, result.state.cells).some(Boolean))
      assert.deepEqual(state, before, 'placement never mutates history snapshots')
      assert.equal(automaticEliminations(puzzle, before.cells)[index], false)
      state = result.state
    }
    assert(isComplete(puzzle, state.cells))
    assert.equal(findHint(puzzle, state.cells), null)
    const restarted = createInitialState(puzzle)
    assert(restarted.cells.every((cell) => cell === 'empty'))
    assert.equal(automaticEliminations(puzzle, restarted.cells).filter(Boolean).length, 0)
  })
}

test('mistakes retain life semantics; history restores manual marks and derived eliminations', () => {
  const puzzle = createPuzzle(1, seeded(95))
  const state = createInitialState(puzzle)
  const wrong = state.cells.findIndex((_, cell) => !puzzle.solution.includes(cell))
  state.cells[wrong] = 'mark'
  const history = structuredClone(state)
  const failed = attemptPlacement(puzzle, state, wrong)
  assert(failed.mistake)
  assert.equal(failed.state.lives, 2)
  assert.equal(failed.accepted, false)
  assert.deepEqual(state, history)
  assert.deepEqual(automaticEliminations(puzzle, history.cells), Array(16).fill(false))
  const first = findHint(puzzle, history.cells)
  const placed = attemptPlacement(puzzle, history, first)
  assert(placed.accepted)
  assert(automaticEliminations(puzzle, placed.state.cells).some(Boolean))
  assert.equal(history.cells[wrong], 'mark')
  assert.deepEqual(automaticEliminations(puzzle, history.cells), Array(16).fill(false), 'Undo restores manual state and removes rabbit-derived Xs')
  let losing = state
  for (let mistake = 0; mistake < 3; mistake++) losing = attemptPlacement(puzzle, losing, wrong).state
  assert.equal(losing.lives, 0)
  assert.equal(losing.cells.filter((cell) => cell === 'rabbit').length, 0)
})

test('rabbit placement leaves eliminated cells unmarked while logical counts and validation stay correct', () => {
  const puzzle = createPuzzle(1, seeded(111))
  const initial = createInitialState(puzzle)
  const first = findHint(puzzle, initial.cells)
  const placed = attemptPlacement(puzzle, initial, first).state
  assert.equal(placed.cells.filter((cell) => cell === 'mark').length, 0)
  assert(placed.cells.every((cell, index) => index === first ? cell === 'rabbit' : cell === 'empty'))
  const blocked = automaticEliminations(puzzle, placed.cells)
  const index = blocked.findIndex(Boolean)
  assert(index >= 0)
  const counts = availableRegions(puzzle, placed.cells).map((region) => [region.region, region.cells.length])
  assert(availableRegions(puzzle, placed.cells).every((region) => !region.cells.includes(index)))
  assert.equal(attemptPlacement(puzzle, placed, index).accepted, false)
  const hint = findHint(puzzle, placed.cells)
  const manuallyMarked = { ...placed, cells: [...placed.cells] }
  manuallyMarked.cells[index] = 'mark'
  assert.deepEqual(availableRegions(puzzle, manuallyMarked.cells).map((region) => [region.region, region.cells.length]), counts)
  assert.equal(findHint(puzzle, manuallyMarked.cells), hint)
  assert.equal(attemptPlacement(puzzle, manuallyMarked, index).accepted, false)
  manuallyMarked.cells[index] = 'empty'
  assert.deepEqual(automaticEliminations(puzzle, manuallyMarked.cells), blocked)
  assert.deepEqual(initial.cells, Array(16).fill('empty'))
})
