import assert from 'node:assert/strict';import test from 'node:test';
import {keyboardHandlers}from'../src/game/keyboard.ts';
import {createPuzzle,createDailyPuzzle,createInitialState,attemptPlacement,findHint}from'../src/game/puzzle.ts';
function fixture(puzzle){let selected=0,state=createInitialState(puzzle),history=[],menu=false,active=true,counts={hint:0,undo:0,restart:0,menu:0};const brush={held:false,visited:new Set()};
const commit=next=>{history.push(state);state=next};
const h=keyboardHandlers({size:puzzle.size,enabled:()=>active&&!menu,selected:()=>selected,select:i=>selected=i,place:i=>{const r=attemptPlacement(puzzle,state,i);commit(r.state)},mark:(i,drawing)=>{if(!['empty','mark'].includes(state.cells[i])||(drawing&&state.cells[i]!=='empty'))return;const cells=[...state.cells];cells[i]=cells[i]==='mark'?'empty':'mark';commit({...state,cells})},hint:()=>{counts.hint++;findHint(puzzle,state.cells)},undo:()=>{counts.undo++;if(history.length)state=history.pop()},restart:()=>{counts.restart++;state=createInitialState(puzzle)},menu:()=>{counts.menu++;menu=true},brushEnd(){}},brush);
const key=(key,repeat=false)=>h.keydown({key,repeat,preventDefault(){},ctrlKey:false,altKey:false,metaKey:false});
return{key,up:()=>h.keyup({key:' '}),h,brush,get selected(){return selected},set selected(i){selected=i},get state(){return state},counts,stay(){menu=false},set active(v){active=v}};
}
for(const daily of[false,true])test((daily?'Daily':'Normal')+' every mapping, boundaries, rabbit/X, brush, repeat and modal gating',()=>{
const p=daily?createDailyPuzzle():createPuzzle(2),f=fixture(p),n=p.size;
for(const key of['w','ArrowUp','a','ArrowLeft']){f.selected=0;f.key(key);assert.equal(f.selected,0)}
for(const key of['s','ArrowDown','d','ArrowRight']){f.selected=n*n-1;f.key(key);assert.equal(f.selected,n*n-1)}
f.selected=n+1;f.key('w');assert.equal(f.selected,1);f.key('d');assert.equal(f.selected,2);f.key('s');assert.equal(f.selected,n+2);f.key('a');assert.equal(f.selected,n+1);
f.key('ArrowUp');f.key('ArrowRight');f.key('ArrowDown');f.key('ArrowLeft');assert.equal(f.selected,n+1);
f.selected=p.solution[0];f.key(' ');assert.equal(f.state.cells[f.selected],'mark');f.key(' ',true);assert.equal(f.state.cells[f.selected],'mark');f.up();f.key(' ');assert.equal(f.state.cells[f.selected],'empty');f.up();f.key(' ');f.up();f.key('Enter');assert.equal(f.state.cells[f.selected],'rabbit');
f.key('e');assert.equal(f.state.cells[f.selected],'mark');f.key('q');assert.equal(f.counts.hint,1);f.key('r');assert(f.state.cells.every(c=>c==='empty'));assert.equal(f.counts.restart,1);
f.selected=0;f.key(' ');f.key('d');f.key('ArrowRight');f.key('ArrowLeft');f.key('Enter');assert(!f.state.cells.includes('rabbit'));assert(f.state.cells.slice(0,3).every(c=>c==='mark'));f.up();
f.key('Escape');f.key('Escape',true);f.key('Escape');f.key('q');assert.equal(f.counts.menu,1);assert.equal(f.counts.hint,1);f.stay();f.key('q');assert.equal(f.counts.hint,2);
f.active=false;const before=f.selected;f.key('d');f.key('r');assert.equal(f.selected,before);assert.equal(f.counts.restart,1);f.active=true;f.key(' ');f.h.blur();assert.equal(f.brush.held,false);
});import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as engine from '../src/game/puzzle.ts';
test('actual GameScreen keyboard listeners, form/settings guards, Stay/Main Menu and repeat popup',()=>{
 const puzzle=createPuzzle(2),listeners=new Map(),slots=[];let cursor=0,effects=[],cleanups=[],modal=false,settings=false,hidden=false,menuCalls=0,confirmCalls=0;
 class Element {constructor(kind='body'){this.kind=kind}closest(selector){if(selector==='[hidden]')return hidden?this:null;if(selector.includes('input')&&this.kind==='input')return this;if(selector.includes('button:not')&&this.kind==='button')return this;return null}}
 const react={useState(v){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(v){const i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i]},useEffect(fn,deps){const i=cursor++;if(!deps||!(i in slots)){slots[i]=true;effects.push(fn)}}};
 const jsx=(type,props)=>({type,props}),window={confirm(){confirmCalls++;return true},addEventListener(n,fn){if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(fn)},removeEventListener(n,fn){listeners.get(n)?.delete(fn)}};
 const document={hidden:false,querySelector(){return modal||settings?{}:null}};
 const req=n=>n==='./MainMenuConfirmation'?{__esModule:true,default:confirmation}:n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='../game/keyboard'?{keyboardHandlers}:n==='../game/puzzle'?engine:n==='../game/tutorial'?{startingTutorialStep:()=>0,tutorialBlockedCells:()=>[],tutorialTarget:()=>undefined,saveTutorialComplete(){}}:n==='../i18n'?{t:s=>s,translatedError:s=>s}:n==='../audio'?{playSound:()=>({addEventListener(){},play(){return Promise.resolve()}})}:{saveNormalLevel(){}};
 function confirmation(props){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(new URL('../src/components/MainMenuConfirmation.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext('(function(require,module,exports){'+code+'})',{})(req,m,m.exports);return m.exports.default(props)}
 const source=fs.readFileSync(new URL('../src/components/GameScreen.tsx',import.meta.url),'utf8'),js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,module={exports:{}};
 vm.runInNewContext('(function(require,module,exports){'+js+'})',{window,document,HTMLElement:Element,setTimeout:()=>1,clearTimeout(){}})(req,module,module.exports);
 function find(n,match){if(!n||typeof n!=='object')return;if(match(n))return n;if(n.type===confirmation)return find(n.type(n.props),match);for(const c of[n.props?.children].flat(Infinity)){const found=find(c,match);if(found)return found}}
 let tree;const render=()=>{for(const c of cleanups)c();cleanups=[];cursor=0;tree=module.exports.default({initialPuzzle:puzzle,onMenu(){menuCalls++},onToggleMusic(){},onToggleSoundEffects(){}});tree.props.ref.current=new Element();modal=!!find(tree,n=>n.props?.role==='dialog');for(const effect of effects){const cleanup=effect();if(cleanup)cleanups.push(cleanup)}effects=[];return tree};
 const fire=(key,{target=new Element(),repeat=false}={})=>{for(const fn of[...listeners.get('keydown')??[]])fn({key,target,repeat,preventDefault(){},ctrlKey:false,altKey:false,metaKey:false});render()};
 const board=()=>find(tree,n=>n.type?.name==='PuzzleBoard').props;
 render();fire('d');assert.equal(board().keyboardSelection,1);fire(' ');assert.equal(slots[1].cells[1],'mark');for(const fn of listeners.get('keyup'))fn({key:' '});fire('e');assert.equal(slots[1].cells[1],'empty');
 fire('q');assert.notEqual(board().hintCell,null);fire('r');assert.equal(confirmCalls,1);assert(slots[1].cells.every(c=>c==='empty'));
 for(const letter of ['d',' ','Enter','q','e','r','Escape'])fire(letter,{target:new Element('input')});assert.equal(board().keyboardSelection,1);assert.equal(confirmCalls,1);assert(!modal);
 settings=true;fire('d');fire('Escape');assert(!modal);settings=false;hidden=true;fire('d');assert.equal(board().keyboardSelection,1);hidden=false;
 fire('Escape');assert(modal);const popup=find(tree,n=>n.props?.role==='dialog');fire('Escape',{repeat:true});assert.equal(find(tree,n=>n.props?.role==='dialog').type,popup.type);
 fire(' ');assert.equal(slots[1].cells[1],'empty');
 const stay=find(tree,n=>n.type==='button'&&n.props?.children==='Stay');assert(stay.props.autoFocus);stay.props.onClick();render();assert(!modal);fire('d');assert.equal(board().keyboardSelection,2);
 fire('Escape');find(find(tree,n=>n.props?.role==='dialog'),n=>n.type==='button'&&n.props?.children==='Main Menu').props.onClick();render();assert.equal(menuCalls,1);assert(!modal);
});