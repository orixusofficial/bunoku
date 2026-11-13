import test from 'node:test'
import assert from 'node:assert/strict'
import { createAllowances, DAY, ALLOWANCE_KEY } from '../src/game/allowances.ts'
import { saveNormalLevel, loadNormalLevel } from '../src/game/levels.ts'

function fixture() {
  const values = new Map()
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  let wall = 1700000000000, elapsed = 0
  const reload = () => createAllowances(() => storage, () => wall, () => elapsed)
  return { values, storage, reload, get time() { return wall }, advance(ms) { wall += ms; elapsed += ms }, rollback(ms) { wall -= ms }, elapsed(ms) { elapsed += ms } }
}
test('Daily unlocks only after completing Level 10, one start per 24h across reloads and other actions', () => {
  const f = fixture(), a = f.reload()
  for (let completed = 0; completed < 10; completed++) {
    saveNormalLevel(completed + 1, f.storage)
    assert.equal(a.startDaily(loadNormalLevel(f.storage) - 1), false)
  }
  saveNormalLevel(11, f.storage)
  assert.equal(a.startDaily(loadNormalLevel(f.storage) - 1), true)
  assert.equal(a.startDaily(10), false)
  assert.equal(f.reload().startDaily(10), false)
  assert.equal(f.reload().status().dailyRemaining, DAY)
  a.consume('hint'); a.consume('undo'); a.grant('hint', 'reward-1')
  assert.equal(f.reload().status().dailyRemaining, DAY)
  f.advance(DAY - 1); assert.equal(f.reload().startDaily(10), false)
  f.advance(1); assert.equal(f.reload().startDaily(10), true)
})
test('five free uses for each action, persistent independently; each rewarded ad adds three selected uses', () => {
  const f = fixture(), a = f.reload()
  for (const kind of ['hint', 'undo']) {
    for (let i = 0; i < 5; i++) assert.equal(f.reload().consume(kind), true)
    assert.equal(a.consume(kind), false)
  }
  assert.equal(a.grant('hint', 'ad-1'), true)
  assert.equal(a.grant('hint', 'ad-1'), false)
  assert.equal(a.grant('undo', 'ad-2'), true) // SDK, not a custom timer, controls ad frequency
  assert.equal(a.status().hintCredits, 3); assert.equal(a.status().undoCredits, 3)
  for (let i=0;i<3;i++) assert.equal(f.reload().consume('hint'), true)
  assert.equal(a.consume('hint'), false)
  assert.equal(a.grant('undo', 'ad-2'), false)
  assert.equal(f.reload().status().undoCredits, 3)
  assert.equal(f.reload().status().hintFree, 0)
})
test('clock rollback cannot reset cooldown; monotonic elapsed time and high water survive reload', () => {
  const f = fixture(), a = f.reload()
  a.startDaily(10); f.advance(3600000); a.status()
  f.rollback(7200000)
  assert.equal(f.reload().status().dailyRemaining, DAY - 3600000)
  f.elapsed(3600000)
  assert.equal(a.status().dailyRemaining, DAY - 7200000)
  assert.equal(f.reload().status().dailyRemaining, DAY - 7200000)
})
test('failed writes and corrupt records never replenish allowances or grant attempts/rewards', () => {
  const f = fixture()
  f.values.set(ALLOWANCE_KEY, '{broken')
  assert.equal(f.reload().status().available, false)
  assert.equal(f.reload().consume('hint'), false)
  const a = createAllowances(() => ({ getItem: () => null, setItem() { throw Error('blocked') } }))
  assert.equal(a.consume('undo'), false); assert.equal(a.startDaily(10), false); assert.equal(a.grant('hint', 'x'), false)
})

test('legacy saved reward timestamp never blocks a new SDK-completed reward or resets balances',()=>{
 const f=fixture(),a=f.reload()
 assert(a.grant('hint','one'))
 const saved=JSON.parse(f.values.get(ALLOWANCE_KEY));saved.rewardAvailableAt=f.time+180000;f.values.set(ALLOWANCE_KEY,JSON.stringify(saved))
 assert.equal(f.reload().status().rewardRemaining,0)
 assert(f.reload().grant('undo','two'));assert.equal(a.status().hintCredits,3);assert.equal(a.status().undoCredits,3)
 assert.equal(a.grant('undo','two'),false)
})
