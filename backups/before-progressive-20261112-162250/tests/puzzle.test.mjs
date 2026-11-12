import assert from 'node:assert/strict'
import test from 'node:test'
import { attemptPlacement, createInitialState, createPuzzle, countSolutions, isComplete, isSolutionPlacement, isValidPlacement } from '../src/game/puzzle.ts'

function assertConnected(puzzle) {
  const ids = [...new Set(puzzle.regions)]
  assert.equal(ids.length, 4)
  for (const id of ids) {
    const members = puzzle.regions.flatMap((region, i) => region === id ? [i] : [])
    assert.equal(members.length, 4)
    const seen = new Set([members[0]])
    const queue = [members[0]]
    while (queue.length) {
      const at = queue.pop()
      for (const next of members) {
        const distance = Math.abs(Math.floor(at / 4) - Math.floor(next / 4)) + Math.abs(at % 4 - next % 4)
        if (distance === 1 && !seen.has(next)) { seen.add(next); queue.push(next) }
      }
    }
    assert.equal(seen.size, 4)
  }
}

test('generated 4x4 puzzle has a connected four-color layout and one unique complete solution', () => {
  const puzzle = createPuzzle(1, () => 0.6)
  assertConnected(puzzle)
  assert.equal(puzzle.regionColors.length, 4)
  assert.equal(new Set(puzzle.regionColors).size, 4)
  assert.equal(puzzle.solution.length, 4)
  assert.equal(countSolutions(puzzle.regions), 1)
  assert.equal(puzzle.solution.includes(puzzle.given), true)
  assert.equal(puzzle.regions[puzzle.given], puzzle.startRegion)
  const initial = createInitialState(puzzle)
  assert.equal(initial.cells.filter((cell) => cell === 'given').length, 1)
  assert.equal(initial.cells.filter((cell) => cell === 'rabbit' || cell === 'hint').length, 0)

  const solved = [...initial.cells]
  for (const index of puzzle.solution) {
    if (index === puzzle.given) continue
    assert.equal(isSolutionPlacement(puzzle, index), true)
    assert.equal(isValidPlacement(puzzle, solved, index), true)
    solved[index] = 'rabbit'
  }
  assert.equal(isComplete(puzzle, solved), true)

  const validWrongAlternatives = Array.from({ length: 16 }, (_, index) => index)
    .filter((index) => !puzzle.solution.includes(index) && isValidPlacement(puzzle, initial.cells, index))
  assert(validWrongAlternatives.length > 0, 'there is a locally safe but incorrect move to reject')
  assert.equal(isSolutionPlacement(puzzle, validWrongAlternatives[0]), false)
  const acceptedMove = puzzle.solution.find((index) => index !== puzzle.given)
  const correctResult = attemptPlacement(puzzle, initial, acceptedMove)
  assert.equal(correctResult.accepted, true)
  assert.equal(correctResult.state.cells[acceptedMove], 'rabbit')
  assert.equal(correctResult.state.lives, 3)
  const wrongResult = attemptPlacement(puzzle, initial, validWrongAlternatives[0])
  assert.equal(wrongResult.accepted, false)
  assert.equal(wrongResult.mistake, true)
  assert.equal(wrongResult.state.lives, 2)
  assert.equal(wrongResult.state.cells.filter((cell) => cell === 'rabbit').length, 0)
  console.log(JSON.stringify({
    regionLayout: Array.from({ length: 4 }, (_, row) => puzzle.regions.slice(row * 4, row * 4 + 4)),
    regionIds: [...new Set(puzzle.regions)],
    colors: puzzle.regionColors,
    solutionCoordinates: puzzle.solution.map((index) => [Math.floor(index / 4) + 1, index % 4 + 1]),
    startingRabbit: [Math.floor(puzzle.given / 4) + 1, puzzle.given % 4 + 1],
    validSolutionCount: countSolutions(puzzle.regions),
    locallySafeIncorrectMove: [Math.floor(validWrongAlternatives[0] / 4) + 1, validWrongAlternatives[0] % 4 + 1],
    allRulesPass: isComplete(puzzle, solved),
    correctSelectionAccepted: correctResult.accepted,
    incorrectSelectionRejected: !wrongResult.accepted && wrongResult.state.lives === 2,
  }, null, 2))
})
