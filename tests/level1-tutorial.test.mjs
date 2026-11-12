import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as engine from '../src/game/puzzle.ts';
const source=fs.readFileSync(new URL('../src/components/GameScreen.tsx',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
let fixtureId=0;
async function fixture({daily=false,level=1,storage=new Map()}={}){
 globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
 const tutorial=await import('../src/game/tutorial.ts?fixture='+fixtureId++);
 const puzzle=daily?engine.createDailyPuzzle():engine.createPuzzle(level);
 let slots=[],cursor=0,clock=1000;const sounds=[],timers=[];
 const react={useState(v){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(v){const i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i]},useEffect(){cursor++}};
 const jsx=(type,props)=>({type,props}),module={exports:{}};
 const req=n=>n==='../assetUrl.ts'?{assetUrl:p=>'./'+p}:n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='../game/puzzle'?engine:n==='../game/tutorial'?tutorial:n==='../i18n'?{t:s=>s,translatedError:s=>s}:n==='../audio'?{playSound:n=>{sounds.push(n);return{addEventListener(){},play(){return Promise.resolve()}}}}:{saveNormalLevel(){}};
 vm.runInNewContext('(function(require,module,exports){'+js+'})',{localStorage:globalThis.localStorage,document:{elementFromPoint(){return null}},window:{confirm:()=>true},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){}})(req,module,module.exports);
 const props={initialPuzzle:puzzle,daily,onMenu(){},musicOn:false,soundEffectsOn:true,onToggleMusic(){},onToggleSoundEffects(){}};
 const render=()=>{cursor=0;return module.exports.default(props)};
 function find(n,name){if(!n||typeof n!=='object')return;if(n.type?.name===name)return n;for(const c of [n.props?.children].flat(Infinity)){const found=find(c,name);if(found)return found}}
 const node=name=>find(render(),name),board=()=>node('PuzzleBoard').props,controls=()=>node('BottomControls').props;
 const ev=(type,kind)=>({type,pointerType:kind,pointerId:1,button:0,clientX:0,clientY:0,timeStamp:clock,preventDefault(){}});
 const tap=(index,kind='mouse')=>{board().onPointerStart(index,ev('pointerdown',kind));clock+=25;board().onPointerEnd(ev('pointerup',kind));clock+=60};
 const double=(index,kind='mouse')=>{tap(index,kind);tap(index,kind);if(kind==='mouse')board().onDoubleClick(index)};
 const drag=(indices,kind='mouse')=>{board().onPointerStart(indices[0],ev('pointerdown',kind));for(const index of indices.slice(1))board().onPointerEnter(index);board().onPointerEnd(ev('pointerup',kind));clock+=1000};
 render();return{puzzle,tutorial,slots,storage,sounds,timers,render,node,board,controls,tap,double,drag,wait(){clock+=1000}};
}
for(const kind of ['mouse','touch'])test(kind+': complete fresh-player steps 1–5 and finish the real puzzle',async()=>{
 const f=await fixture(),target=f.tutorial.tutorialTarget(f.puzzle),blocked=f.tutorial.tutorialBlockedCells(f.puzzle);
 assert.equal(f.board().tutorialStep,1);const other=(target+1)%16;f.tap(other,kind);assert.equal(f.slots[1].cells[other],'empty');f.double(other,kind);assert.equal(f.slots[1].lives,3);
 f.double(target,kind);assert.equal(f.slots[1].cells[target],'rabbit');assert.equal(f.board().tutorialStep,2);f.wait();
 f.tap(blocked[0],kind);assert.equal(f.slots[1].cells[blocked[0]],'mark');assert.equal(f.board().tutorialStep,3);f.wait();
 f.drag([blocked[0]],kind);assert.equal(f.board().tutorialStep,3);
 f.drag([blocked[0],blocked[1],blocked[2]],kind);assert.equal(f.board().tutorialStep,4);assert.equal(f.controls().tutorialStep,4);
 if(kind==='mouse')f.node('TutorialPrompt').props.onContinue();else f.controls().onHint();
 assert.equal(f.board().tutorialStep,5);assert.equal(f.storage.get('bunoku.level1TutorialComplete'),'true');
 while(!engine.isComplete(f.puzzle,f.slots[1].cells)){const next=engine.findHint(f.puzzle,f.slots[1].cells);assert.notEqual(next,null);f.wait();f.double(next,kind)}
 assert.equal(f.slots[1].lives,3);assert.equal(f.sounds.filter(s=>s==='foundbunny').length,4);assert.equal(f.sounds.filter(s=>s==='win').length,1);
 const returnVisit=await fixture({storage:f.storage});assert.equal(returnVisit.board().tutorialStep,0);
});
test('Undo/Restart/Skip and already-marked drag never trap the guide',async()=>{
 const f=await fixture(),target=f.tutorial.tutorialTarget(f.puzzle),blocked=f.tutorial.tutorialBlockedCells(f.puzzle);
 f.double(target);assert.equal(f.board().tutorialStep,2);f.controls().onUndo();assert.equal(f.board().tutorialStep,1);
 f.wait();f.double(target);f.wait();f.tap(blocked[0]);assert.equal(f.board().tutorialStep,3);
 for(const index of blocked){f.wait();if(f.slots[1].cells[index]==='empty')f.tap(index)}
 f.wait();f.drag([blocked[0],blocked[1],blocked[2]]);assert.equal(f.board().tutorialStep,4);
 f.controls().onRestart();assert.equal(f.board().tutorialStep,1);assert(f.slots[1].cells.every(c=>c==='empty'));
 f.node('TutorialPrompt').props.onSkip();assert.equal(f.board().tutorialStep,0);assert.equal(f.storage.get('bunoku.level1TutorialComplete'),'true');f.controls().onRestart();assert.equal(f.board().tutorialStep,0);
});
test('Level 2 and Daily remain unrestricted and do not save tutorial completion',async()=>{
 for(const config of [{level:2},{daily:true}]){const f=await fixture(config);assert.equal(f.board().tutorialStep,0);const target=f.puzzle.solution[0];f.double(target);assert.equal(f.slots[1].cells[target],'rabbit');assert.equal(f.storage.has('bunoku.level1TutorialComplete'),false)}
});
test('blocked tutorial highlights correspond only to actual row/column/touch conflicts',async()=>{
 for(let i=0;i<30;i++){const f=await fixture(),target=f.tutorial.tutorialTarget(f.puzzle);assert(f.puzzle.solution.includes(target));for(const index of f.tutorial.tutorialBlockedCells(f.puzzle))assert(!f.puzzle.solution.includes(index));assert(f.tutorial.tutorialBlockedCells(f.puzzle).length>=3)}
});