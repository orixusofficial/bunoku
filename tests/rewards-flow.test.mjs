import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createAllowances } from '../src/game/allowances.ts'

function fixture(initialKind = null) {
  const store = new Map(), ledger = createAllowances(() => ({ getItem: k => store.get(k) ?? null, setItem: (k,v) => store.set(k,v) }))
  let cursor = 0, effects = [], timers = new Map(), timerId = 0, request, calls = 0, returned = 0, menus = 0
  const slots = [], jsx = (type, props) => ({ type, props })
  const react = {
    useState(v) { const i = cursor++; if (!(i in slots)) slots[i] = typeof v === 'function' ? v() : v; return [slots[i], v => slots[i] = v] },
    useRef(v) { const i = cursor++; if (!(i in slots)) slots[i] = { current: v }; return slots[i] },
    useEffect(fn) { cursor++; effects.push(fn) },
  }
  const code = ts.transpileModule(fs.readFileSync('src/components/Rewards.tsx','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  const require = n => n === 'react' ? react : n === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : n.includes('crazygames') ? { adsAvailable: () => true, requestRewardedAd(grant) { calls++; return new Promise(resolve => { request = success => resolve(success ? (grant() ? 'rewarded' : 'save-error') : 'unavailable') }) } } : n.includes('allowances.ts') ? { allowances: ledger, countdown: () => '00:00:01' } : n.includes('useAllowances') ? { useAllowances: () => ledger.status() } : n.includes('levels') ? { loadNormalLevel: () => 2 } : n.includes('i18n') ? { t: s => s } : { assetUrl: s => s }
  vm.runInNewContext('(function(require,module,exports){'+code+'})', { setTimeout(fn) { timers.set(++timerId,fn); return timerId }, clearTimeout(id) { timers.delete(id) } })(require,module,module.exports)
  const render = () => { cursor=0; effects=[]; return module.exports.default({ initialKind, onBack() { menus++ }, onRewardGranted() { returned++ } }) }
  const find = (node, predicate) => { if (!node || typeof node !== 'object') return; if (predicate(node)) return node; for (const child of [node.props?.children].flat(Infinity)) { const hit=find(child,predicate); if(hit)return hit } }
  return { ledger, render, find, get calls(){return calls}, get returned(){return returned}, get menus(){return menus}, finish: async success => { request(success); await Promise.resolve(); await Promise.resolve() }, effects: () => effects.map(fn => fn()), runTimers() { for(const fn of timers.values())fn(); timers.clear() } }
}
for (const kind of ['hint','undo']) test(`${kind} card requests directly; duplicates ignored; success saves one unused credit`, async () => {
  const f=fixture(), tree=f.render(), card=f.find(tree,n=>n.type==='button' && n.props.className?.includes('reward-'+kind))
  assert(card); card.props.onClick(); card.props.onClick(); assert.equal(f.calls,1)
  await f.finish(true)
  assert.equal(f.ledger.status()[kind+'Credits'],1)
  assert.equal(f.ledger.status()[(kind==='hint'?'undo':'hint')+'Credits'],0)
  assert.equal(f.returned,1)
  assert(!f.find(tree,n=>n.props?.className?.includes('reward-watch')))
  f.find(tree,n=>n.props?.className?.includes('rewards-back')).props.onClick(); assert.equal(f.menus,1)
})
for (const kind of ['hint','undo']) test(`${kind} transition requests once after mounting and StrictMode cleanup; failed ad grants nothing and permits retry`, async () => {
  const f=fixture(kind), tree=f.render()
  assert(!f.find(tree,n=>n.props?.className==='reward-cards'))
  const cleanups=f.effects(); cleanups.forEach(fn=>fn?.()); f.render(); f.effects(); f.runTimers()
  assert.equal(f.calls,1); await f.finish(false)
  assert.equal(f.ledger.status()[kind+'Credits'],0); assert.equal(f.returned,0)
  const retry=f.find(f.render(),n=>n.type==='button'&&n.props.children==='Try Again')
  assert(retry); retry.props.onClick(); assert.equal(f.calls,2)
  await f.finish(true); assert.equal(f.ledger.status()[kind+'Credits'],1); assert.equal(f.returned,1)
})

test('game button badges include rewarded uses, independently, and return to video icons at zero', () => {
  let balance = { hintFree: 5, undoFree: 5, hintCredits: 0, undoCredits: 0 }
  const jsx = (type,props) => ({type,props}), module = {exports:{}}
  const source = fs.readFileSync('src/components/GameScreen.tsx','utf8') + '\nexport { BottomControls };'
  const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
  const req = n => n.includes('useAllowances') ? {useAllowances:()=>balance} : n==='react/jsx-runtime' ? {jsx,jsxs:jsx} : n.includes('i18n') ? {t:s=>s} : {}
  vm.runInNewContext('(function(require,module,exports){'+code+'})',{})(req,module,module.exports)
  const buttons = () => module.exports.BottomControls({onHint(){},onUndo(){},onRestart(){},canUndo:true,restoreKeyboardFocus(){}}).props.children
  const badge = i => buttons()[i].props.children.at(-1)
  for(let count=5;count>0;count--) { balance.hintFree=count; assert.equal(badge(0).props.children,count); assert.equal(badge(1).props.children,5) }
  balance.hintFree=0; assert.notEqual(badge(0).props.className,'control-count')
  for(let count=1;count<=4;count++) { balance.hintCredits=count; assert.equal(badge(0).props.children,count); assert.equal(badge(1).props.children,5) }
  balance.hintCredits=0; balance.undoFree=0; balance.undoCredits=1
  assert.notEqual(badge(0).props.className,'control-count'); assert.equal(badge(1).props.children,1)
  balance.undoCredits=0; assert.notEqual(badge(1).props.className,'control-count')
})
