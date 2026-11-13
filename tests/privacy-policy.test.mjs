import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const jsx=(type,props)=>({type,props})
function load(file,req,globals={}) {
 const m={exports:{}}
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
 vm.runInNewContext('(function(require,module,exports){'+code+'})',globals)(req,m,m.exports)
 return m.exports
}
function nodes(node) {
 if(!node||typeof node!=='object')return []
 return [node,...[node.props?.children].flat(Infinity).flatMap(nodes)]
}
test('Settings opens Privacy Policy and returns without changing audio or language',()=>{
 let cursor=0,focused=0,closed=0,audioChanges=0,languageChanges=0
 const slots=[],frames=[]
 const react={useState(v){const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],v=>slots[i]=v]},useRef(v){const i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i]}}
 function Policy(){}
 const req=n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='./components/PrivacyPolicy'?{__esModule:true,default:Policy}:n==='./i18n'?{t:s=>s,useLanguage:()=>'en',setLanguage(){languageChanges++},languages:{en:'English'}}:{}
 const source=fs.readFileSync('src/App.tsx','utf8')+'\nexport { SettingsDialog };'
 const module={exports:{}},code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
 vm.runInNewContext('(function(require,module,exports){'+code+'})',{requestAnimationFrame:fn=>frames.push(fn)})(req,module,module.exports)
 const props={effectsOn:true,musicOn:false,onToggleEffects(){audioChanges++},onToggleMusic(){audioChanges++},onClose(){closed++}}
 const render=()=>{cursor=0;return module.exports.SettingsDialog(props)}
 const initial=render(),button=nodes(initial).find(n=>n.props?.className==='privacy-setting')
 assert(button);button.props.ref.current={focus(){focused++}}
 button.props.onClick()
 const opened=render(),policy=nodes(opened).find(n=>n.type===Policy)
 assert(policy);assert(!nodes(opened).some(n=>n.props?.className==='setting-row'))
 policy.props.onClose();const restored=render();frames.forEach(fn=>fn())
 assert(nodes(restored).some(n=>n.props?.className==='privacy-setting'))
 assert.equal(focused,1);assert.equal(closed,0);assert.equal(audioChanges,0);assert.equal(languageChanges,0)
 assert.deepEqual(nodes(restored).filter(n=>n.props?.className==='setting-row').map(n=>n.props['aria-pressed']),[true,false])
})
test('Policy has a scrollable English article, closes with Escape, and contains Tab focus',()=>{
 const effects=[],document={activeElement:null};let closed=0,prevented=0,stopped=0
 const react={useRef:()=>({current:null}),useEffect:fn=>effects.push(fn)}
 const req=n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='../i18n'?{t:s=>s}:{}
 const Policy=load('src/components/PrivacyPolicy.tsx',req,{document}).default
 const tree=Policy({onClose(){closed++}}),all=nodes(tree)
 const heading=all.find(n=>n.type==='h2'),article=all.find(n=>n.type==='article')
 const first={focus(){document.activeElement=first}},last={focus(){document.activeElement=last}}
 heading.props.ref.current={focus(){document.activeElement=this}}
 tree.props.ref.current={querySelectorAll(){return[first,last]}}
 effects.forEach(fn=>fn());assert.equal(document.activeElement,heading.props.ref.current)
 const key=(key,shiftKey=false)=>tree.props.onKeyDown({key,shiftKey,preventDefault(){prevented++},stopPropagation(){stopped++}})
 key('Tab',true);assert.equal(document.activeElement,last)
 key('Tab');assert.equal(document.activeElement,first)
 key('Escape');assert.equal(closed,1);assert.equal(stopped,1);assert.equal(prevented,3)
 assert.equal(article.props.lang,'en');assert.equal(article.props.dir,'ltr');assert.equal(article.props.tabIndex,0)
 const link=all.find(n=>n.type==='a');assert.equal(link.props.href,'https://www.crazygames.com/privacy-policy');assert.equal(link.props.rel,'noopener noreferrer')
 all.find(n=>n.type==='button'&&n.props.className?.includes('primary-button')).props.onClick();assert.equal(closed,2)
})
