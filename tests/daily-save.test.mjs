import test from 'node:test'
import assert from 'node:assert/strict'
import { createAllowances, DAY } from '../src/game/allowances.ts'
import { initialDailyProgress, validDailyProgress } from '../src/game/dailyState.ts'
import { createDailyPuzzle, attemptPlacement } from '../src/game/puzzle.ts'

test('Daily start, full progress, Undo history and cooldown survive reload; unfinished attempt cannot be replaced', () => {
  const values=new Map(), storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}
  let time=1700000000000
  const reload=()=>createAllowances(()=>storage,()=>time,()=>0)
  const a=reload(), initial=initialDailyProgress(createDailyPuzzle())
  assert(a.startDaily(10,initial));const save=a.dailyAttempt(); assert(save)
  const previous=structuredClone(save.board)
  save.board=attemptPlacement(save.puzzle,save.board,save.puzzle.solution[0]).state
  save.history=[previous];save.failureHistory=[[]];save.combo=1
  const bad=save.board.cells.findIndex((c,i)=>c==='empty'&&!save.puzzle.solution.includes(i))
  save.board.cells[bad]='mark';save.hintCell=save.puzzle.solution[1];save.usedHints=[save.hintCell]
  assert(a.saveDaily(save));assert.deepEqual(reload().dailyAttempt(),save)
  assert.equal(reload().status().dailyRemaining,DAY)
  time+=DAY+1;assert.equal(reload().startDaily(10,initial),false,'unfinished puzzle survives cooldown expiry')
  const resumed=reload().dailyAttempt();resumed.board.cells[bad]='empty';resumed.board.lives=0;resumed.failures=[{id:1,index:bad}];resumed.finished=true
  assert(reload().saveDaily(resumed));assert.equal(reload().dailyAttempt().finished,true)
  assert.equal(reload().saveDaily(save),false,'stale save cannot reopen a finished attempt')
  assert(reload().startDaily(10,initial))
})
test('invalid Daily data and blocked saves cannot consume or replace a valid attempt',()=>{
  const initial=initialDailyProgress(createDailyPuzzle());initial.board.cells.pop()
  assert.equal(validDailyProgress(initial),false)
  const a=createAllowances(()=>({getItem:()=>null,setItem(){throw Error('blocked')}}))
  assert.equal(a.startDaily(10,initialDailyProgress(createDailyPuzzle())),false)
  assert.equal(a.dailyAttempt(),null)
})
