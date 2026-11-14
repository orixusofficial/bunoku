import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as engine from '../src/game/puzzle.ts';
import * as dragPath from '../src/game/dragPath.ts';
import {createAllowances} from '../src/game/allowances.ts';
const source=fs.readFileSync(new URL('../src/components/GameScreen.tsx',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
let fixtureId=0;
async function fixture({daily=false,level=1,storage=new Map(),adRequest=()=>Promise.resolve('unavailable')}={}){
 globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
 const allowance=createAllowances(()=>({getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}));
 const tutorial=await import('../src/game/tutorial.ts?fixture='+fixtureId++);
 const puzzle=daily?engine.createDailyPuzzle():engine.createPuzzle(level);
 let slots=[],cursor=0,clock=1000;const sounds=[],timers=[],requestedRewards=[];
 const react={useState(v){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(v){const i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i]},useEffect(){cursor++}};
 const jsx=(type,props)=>({type,props}),module={exports:{}};
 const req=n=>n==='../game/dragPath'?dragPath:n==='../game/allowances.ts'?{allowances:allowance}:n==='../crazygames.ts'?{trackGameplay:()=>()=>{},confirmDuringGameplay:()=>true,requestRewardedAd:adRequest}:n==='../assetUrl.ts'?{assetUrl:p=>'./'+p}:n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='../game/puzzle'?engine:n==='../game/tutorial'?tutorial:n==='../i18n'?{t:s=>s,translatedError:s=>s}:n==='../audio'?{playSound:n=>{sounds.push(n);return{addEventListener(){},play(){return Promise.resolve()}}}}:{saveNormalLevel(){}};
 vm.runInNewContext('(function(require,module,exports){'+js+'})',{localStorage:globalThis.localStorage,document:{elementFromPoint(){return null}},window:{confirm:()=>true},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){}})(req,module,module.exports);
 const props={initialPuzzle:puzzle,daily,onMenu(){},onRequestReward(kind){requestedRewards.push(kind)},rewardAction:null,musicOn:false,soundEffectsOn:true,onToggleMusic(){},onToggleSoundEffects(){}};
 const render=()=>{cursor=0;return module.exports.default(props)};
 function find(n,name){if(!n||typeof n!=='object')return;if(n.type?.name===name)return n;for(const c of [n.props?.children].flat(Infinity)){const found=find(c,name);if(found)return found}}
 const node=name=>find(render(),name),board=()=>node('PuzzleBoard').props,controls=()=>node('BottomControls').props;
 const ev=(type,kind)=>({type,pointerType:kind,pointerId:1,button:0,clientX:0,clientY:0,timeStamp:clock,preventDefault(){}});
 const tap=(index,kind='mouse')=>{board().onPointerStart(index,ev('pointerdown',kind));clock+=25;board().onPointerEnd(ev('pointerup',kind));clock+=60};
 const double=(index,kind='mouse')=>{tap(index,kind);tap(index,kind);if(kind==='mouse')board().onDoubleClick(index)};
 const drag=(indices,kind='mouse')=>{board().onPointerStart(indices[0],ev('pointerdown',kind));for(const index of indices.slice(1))board().onPointerEnter(index);board().onPointerEnd(ev('pointerup',kind));clock+=1000};
 render();return{puzzle,tutorial,slots,allowance,storage,sounds,timers,requestedRewards,render,node,board,controls,tap,double,drag,ev,wait(){clock+=1000}};
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

test('real Hint/Undo handlers spend only successful uses and never refund on Restart or reload', async()=>{
 const f=await fixture({level:2});
 f.controls().onUndo(); assert.equal(f.allowance.status().undoFree,5);
 for(let i=0;i<5;i++){f.controls().onHint();assert.notEqual(f.board().hintCell,null);f.controls().onRestart();assert.equal(f.allowance.status().hintFree,4-i)}
 f.controls().onHint();assert.equal(f.board().hintCell,null);assert.equal(f.allowance.status().hintFree,0);assert.deepEqual(f.requestedRewards,[]);await new Promise(setImmediate);
 for(let i=0;i<5;i++){f.tap(0);f.controls().onUndo();assert.equal(f.slots[1].cells[0],'empty');assert.equal(f.allowance.status().undoFree,4-i);f.wait()}
 f.tap(0);f.controls().onUndo();assert.equal(f.slots[1].cells[0],'mark');assert.equal(f.allowance.status().undoFree,0);
 await new Promise(setImmediate);f.controls().onRestart();const reload=await fixture({level:2,storage:f.storage});assert.equal(reload.allowance.status().hintFree,0);assert.equal(reload.allowance.status().undoFree,0);
 assert.equal(reload.allowance.grant('hint','ad'),true);reload.controls().onHint();assert.equal(reload.allowance.status().hintCredits,2);
 const daily=await fixture({daily:true});daily.tap(0);const before=[...daily.slots[1].cells];daily.controls().onRestart();assert.deepEqual(Array.from(daily.slots[1].cells),before,'Daily restart cannot replay an attempt');
});

for(const kind of ['hint','undo']) test(`${kind}: zero balance requests once, grants 3 without consuming, retries after errors`,async()=>{
 let calls=0,grant,finish
 const f=await fixture({level:2,adRequest:reward=>{calls++;grant=reward;return new Promise(resolve=>finish=resolve)}})
 for(let i=0;i<5;i++)f.allowance.consume(kind)
 const action=()=>f.controls()[kind==='hint'?'onHint':'onUndo']()
 action();action();assert.equal(calls,1)
 finish('adCooldown');await new Promise(setImmediate)
 assert.equal(f.allowance.status()[kind+'Credits'],0)
 action();assert.equal(calls,2);assert(grant());finish('rewarded');await new Promise(setImmediate)
 assert.equal(f.allowance.status()[kind+'Credits'],3);assert.equal(f.board().hintCell,null)
 assert(f.slots[1].cells.every(c=>c==='empty'))
 if(kind==='undo')f.tap(0)
 action();assert.equal(f.allowance.status()[kind+'Credits'],2)
 f.allowance.consume(kind);f.allowance.consume(kind);action();assert.equal(calls,3,'no custom cooldown blocks the next request')
 finish('unfilled');await new Promise(setImmediate)
 assert.equal(f.allowance.status()[kind+'Credits'],0)
})

// Real GameScreen handlers, with no intervening render between movement events.
// This models sparse/batched mobile input rather than calling markCell directly.
function stroke(f, indices, {kind='touch',coalesced=false,upOnly=false,cancel=false}={}) {
 const n=f.puzzle.size, point=i=>({clientX:i%n*32+14,clientY:Math.floor(i/n)*32+14})
 const cells=Array.from({length:n*n},(_,i)=>({dataset:{cellIndex:String(i)},getBoundingClientRect(){return{left:i%n*32,right:i%n*32+28,top:Math.floor(i/n)*32,bottom:Math.floor(i/n)*32+28}}}))
 const target={closest(){return{querySelectorAll(){return cells}}}}
 const event=(type,i)=>({...f.ev(type,kind),...point(i),currentTarget:target})
 const handlers=f.board()
 handlers.onPointerStart(indices[0],event('pointerdown',indices[0]))
 if(!upOnly){
   if(coalesced)handlers.onPointerMove({...event('pointermove',indices.at(-1)),nativeEvent:{getCoalescedEvents:()=>indices.slice(1,-1).map(point)}})
   else for(const i of indices.slice(1))handlers.onPointerMove(event('pointermove',i))
 }
 handlers.onPointerEnd(event(cancel?'pointercancel':'pointerup',indices.at(-1)))
}
for(const [size,config] of [[4,{level:1}],[6,{level:2}],[8,{level:5}],[9,{daily:true}]]) {
 for(const kind of ['mouse','touch'])test(`${size}x${size} ${kind}: fast row, column and both diagonal drags lose no Xs`,async()=>{
   const paths=[Array.from({length:size},(_,i)=>i),Array.from({length:size},(_,i)=>i*size),Array.from({length:size},(_,i)=>i*(size+1)),Array.from({length:size},(_,i)=>(i+1)*(size-1))]
   for(const expected of paths)for(const reverse of [false,true]){
     const f=await fixture({...config,storage:new Map([['bunoku.level1TutorialComplete','true']])})
     const path=reverse?expected.toReversed():expected
     stroke(f,[path[0],path.at(-1)],{kind})
     assert.deepEqual(Array.from(f.slots[1].cells).flatMap((c,i)=>c==='mark'?[i]:[]),expected.toSorted((a,b)=>a-b))
     assert.equal(f.sounds.filter(s=>s==='Xon').length,size)
     assert(!f.slots[1].cells.includes('rabbit'));assert.equal(f.slots[1].lives,3)
   }
 })
 test(`${size}x${size}: coalesced snake, revisits, final-up and Undo preserve every action`,async()=>{
   const f=await fixture({...config,storage:new Map([['bunoku.level1TutorialComplete','true']])})
   const snake=Array.from({length:size},(_,r)=>Array.from({length:size},(_,c)=>r*size+(r%2?size-1-c:c))).flat()
   stroke(f,[...snake,...snake.toReversed()],{coalesced:true})
   assert(f.slots[1].cells.every(c=>c==='mark'))
   assert.equal(f.sounds.filter(s=>s==='Xon').length,size*size,'one sound/history action per new cell, including revisits')
   f.controls().onUndo()
   assert.equal(f.slots[1].cells.filter(c=>c==='mark').length,size*size-1)
   const fresh=await fixture({...config,storage:new Map([['bunoku.level1TutorialComplete','true']])})
   stroke(fresh,[0,size*(size-1)],{upOnly:true})
   assert.equal(fresh.slots[1].cells.filter(c=>c==='mark').length,size,'pointerup fills final unsampled segment')
   fresh.wait();fresh.tap(1,'touch');assert.equal(fresh.slots[1].cells[1],'mark','tap following drag never places a rabbit')
 })
}
test('touch drag preserves rabbits, locked carrots and existing Xs; cancellation never places a rabbit',async()=>{
 const f=await fixture({level:2}),rabbit=f.puzzle.solution[0],row=Math.floor(rabbit/f.puzzle.size)
 f.double(rabbit,'touch');f.wait()
 const failed=row*f.puzzle.size+(rabbit%f.puzzle.size+1)%f.puzzle.size
 f.double(failed,'touch');f.wait()
 const before=Array.from(f.slots[1].cells),sounds=f.sounds.length
 stroke(f,[row*f.puzzle.size,row*f.puzzle.size+f.puzzle.size-1])
 assert.equal(f.slots[1].cells[rabbit],'rabbit');assert.equal(f.slots[1].cells[failed],'empty');assert.equal(f.slots[1].lives,2)
 assert(!f.sounds.slice(sounds).includes('failbite'))
 assert(before.every((c,i)=>c!=='mark'||i===row*f.puzzle.size||f.slots[1].cells[i]==='mark'))
 const cancelled=await fixture({level:2});stroke(cancelled,[0,5],{cancel:true});cancelled.tap(0,'touch')
 assert(!cancelled.slots[1].cells.includes('rabbit'))
})
