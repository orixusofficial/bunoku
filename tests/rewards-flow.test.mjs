import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

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
