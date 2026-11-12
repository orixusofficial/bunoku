import assert from 'node:assert/strict'
import test from 'node:test'
import { gridForLevel, difficultyTier, loadNormalLevel, saveNormalLevel } from '../src/game/levels.ts'
import { createPuzzle, createInitialState, findHint, attemptPlacement, isComplete, validatePuzzle, countSolutions } from '../src/game/puzzle.ts'
import { playSound } from '../src/audio.ts'
import { existsSync } from 'node:fs'

const seeded = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }

test('exact level schedule, including precedence at multiples of ten', () => {
  for (let level = 1; level <= 100; level++) {
    const expected = level === 1 ? 4 : level % 10 === 0 ? 9 : level % 10 === 5 ? 8 : 6
    assert.equal(gridForLevel(level), expected)
  }
  for (const invalid of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => gridForLevel(invalid))
})

for (const [level, size] of [[1, 4], [2, 6], [5, 8], [10, 9], [15, 8], [20, 9]]) {
  test(`level ${level}: 30 real ${size}x${size} puzzles finish through gameplay and hints`, () => {
    const times = []
    for (let run = 1; run <= 30; run++) {
      const start = performance.now()
      const p = createPuzzle(level, seeded(run * 617 + level))
      times.push(performance.now() - start)
      assert.equal(p.size, size)
      assert.equal(p.level, level)
      assert.equal(p.rabbitCount, size)
      assert(validatePuzzle(p))
      assert.equal(countSolutions(p.regions, 2), 1)
      let state = createInitialState(p)
      assert(state.cells.every((cell) => cell === 'empty'))
      for (let turn = 0; turn < size; turn++) {
        const cell = findHint(p, state.cells)
        assert.notEqual(cell, null)
        const result = attemptPlacement(p, state, cell)
        assert(result.accepted)
        state = result.state
      }
      assert(isComplete(p, state.cells))
      assert.equal(state.lives, 3)
      const restart = createInitialState(p)
      assert.equal(p.level, level)
      assert.equal(restart.cells.length, size * size)
      assert(restart.cells.every((cell) => cell === 'empty'))
    }
    console.log(JSON.stringify({level, size, puzzles:30, maxGenerationMs:Math.round(Math.max(...times))}))
  })
}

test('later levels select harder deduction arrangements on the same grid size', () => {
  for (const levels of [[2, 12, 22], [5, 15, 25], [10, 20, 30]]) {
    let improved = 0
    for (let seed = 1; seed <= 20; seed++) {
      const samples = levels.map((level) => createPuzzle(level, seeded(seed)))
      assert(samples.every((p) => p.size === samples[0].size))
      for (let i = 1; i < samples.length; i++) {
        assert(samples[i].difficulty.score >= samples[i-1].difficulty.score)
        if (samples[i].difficulty.score > samples[i-1].difficulty.score) improved++
        assert(samples[i].difficulty.selectionSamples > samples[i-1].difficulty.selectionSamples)
      }
    }
    assert(improved > 0, 'arrangement scoring must change actual puzzle selection')
    console.log(JSON.stringify({levels, improvedComparisons:improved, comparisons:40}))
  }
  assert.equal(difficultyTier(999), 4)
})

test('normal progress persists, is monotonic, and tolerates unavailable storage', () => {
  const data = new Map()
  const storage = { getItem:key=>data.get(key) ?? null, setItem:(key,value)=>data.set(key,value) }
  assert.equal(loadNormalLevel(storage), 1)
  saveNormalLevel(5, storage)
  assert.equal(loadNormalLevel(storage), 5)
  saveNormalLevel(2, storage)
  assert.equal(loadNormalLevel(storage), 5)
  saveNormalLevel(20, storage)
  assert.equal(loadNormalLevel(storage), 20)
  storage.setItem('bunoku.normalLevel', 'invalid')
  assert.equal(loadNormalLevel(storage), 1)
  const unavailable = { getItem:()=>{throw Error('blocked')}, setItem:()=>{throw Error('blocked')} }
  assert.equal(loadNormalLevel(unavailable), 1)
  assert.doesNotThrow(()=>saveNormalLevel(3, unavailable))
})

test('every grid uses the existing sound paths and one play per sound request', () => {
  const originalAudio = globalThis.Audio
  const played = []
  globalThis.Audio = class {
    constructor(src) { this.src = src }
    play() { played.push(this.src); return Promise.resolve() }
  }
  try {
    const names = ['Xon', 'Xoff', 'foundbunny', 'entery', 'nice', 'wow', 'excellent', 'unrealistic', 'failbite', 'win', 'fail']
    for (const size of [4, 6, 8, 9]) {
      const before = played.length
      for (const name of names) {
        assert(existsSync(new URL(`../public/audio/${name}.mp3`, import.meta.url)))
        playSound(name)
      }
      assert.deepEqual(played.slice(before), names.map((name) => `./audio/${name}.mp3`), `same sound contract at ${size}x${size}`)
    }
  } finally { globalThis.Audio = originalAudio }
})
