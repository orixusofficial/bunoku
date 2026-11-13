import { Profiler } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import GameScreen from '../../src/components/GameScreen'
import Baseline from '../../src/components/GameScreen.tsx?baseline'
import { createPuzzle, createDailyPuzzle } from '../../src/game/puzzle'
import { allowances } from '../../src/game/allowances'
import { initialDailyProgress } from '../../src/game/dailyState'
import { setSoundEffectsEnabled } from '../../src/audio'
import '../../src/index.css'
import '../../src/App.css'

const params = new URLSearchParams(location.search), daily = params.has('daily')
const gridSize = Number(params.get('size') || 9)
localStorage.setItem('bunoku.level1TutorialComplete','true')
const puzzle = daily ? createDailyPuzzle() : createPuzzle(gridSize === 4 ? 1 : gridSize === 6 ? 2 : gridSize === 8 ? 5 : 10)
let saved
if (daily) { localStorage.removeItem('bunoku.allowances.v1'); allowances.startDaily(10, initialDailyProgress(puzzle)); saved = allowances.dailyAttempt() }
const Component = params.has('baseline') ? Baseline : GameScreen
const samples = [], renders = [], handlers = []
let measuring = false
const props = { initialPuzzle:puzzle, daily, initialDailyProgress:saved, musicOn:false, soundEffectsOn:true, onToggleMusic(){},onToggleSoundEffects(){},onMenu(){} }
createRoot(document.getElementById('root')!).render(<Profiler id="game" onRender={(_id,_phase,duration)=>{if(measuring)samples.push(duration)}}><Component {...props}/></Profiler>)
const panel = document.createElement('aside')
panel.style.cssText='position:fixed;top:0;left:0;z-index:9999;background:white;color:#333;font:12px monospace;padding:4px;max-width:220px'
panel.innerHTML='<button id="run">Measure 162 marks/removals</button><button id="burst">Burst drag 81 cells</button><pre id="result"></pre>'
document.body.append(panel)
const result = (data) => document.getElementById('result')!.textContent=JSON.stringify(data,null,2)
const cell = (i) => document.querySelector('[data-cell-index="'+i+'"]')!
const event = (type, i, touch=false) => cell(i).dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1,pointerType:touch?'touch':'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:10,clientY:10}))
document.getElementById('run')!.onclick=async()=>{
  samples.length=0;renders.length=0;handlers.length=0; measuring=true
  for(let round=0;round<2;round++)for(let i=0;i<81;i++){
    const before=globalThis.__cellRenders||0, start=performance.now()
    flushSync(()=>{event('pointerdown',i,params.has('touch'));event('pointerup',i,params.has('touch'))})
    handlers.push(performance.now()-start);renders.push((globalThis.__cellRenders||0)-before)
    await new Promise(requestAnimationFrame)
  }
  measuring=false
  const stats=(a)=>{const b=[...a].sort((x,y)=>x-y);return {total:+a.reduce((s,n)=>s+n,0).toFixed(2),median:+b[Math.floor(b.length*.5)].toFixed(3),p95:+b[Math.floor(b.length*.95)].toFixed(3),max:+b.at(-1).toFixed(3)}}
  result({variant:params.has('baseline')?'before':'after',daily,touch:params.has('touch'),events:162,commits:samples.length,cellRenders:renders.reduce((a,b)=>a+b,0),reactMs:stats(samples),eventMs:stats(handlers),marks:document.querySelectorAll('.cell-mark').length})
}
document.getElementById('burst')!.onclick=()=>{
  flushSync(()=>{
    event('pointerdown',0,true)
    for(let i=1;i<81;i++)event('pointerover',i,true)
    event('pointerup',80,true)
  })
  result({burst:true,marks:document.querySelectorAll('.cell-mark').length,rabbits:document.querySelectorAll('.cell-rabbit').length})
}


const pathButton = document.createElement('button')
pathButton.textContent = 'Test sparse drag path'
panel.prepend(pathButton)
pathButton.onclick = () => {
 const n=puzzle.size, direction=params.get('direction')||'horizontal'
 const indices=Array.from({length:n},(_,i)=>direction==='vertical'?i*n:direction==='diagonal'?i*(n+1):direction==='anti'? (i+1)*(n-1):i)
 const center=i=>{const r=cell(i).getBoundingClientRect();return {clientX:r.x+r.width/2,clientY:r.y+r.height/2}}
 const fire=(type,i)=>cell(indices[0]).dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:71,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,...center(i)}))
 flushSync(()=>{fire('pointerdown',indices[0]);fire('pointermove',indices.at(-1));fire('pointerup',indices.at(-1))})
 const actual=[...document.querySelectorAll('.cell-mark')].map(c=>Number(c.dataset.cellIndex))
 result({size:n,direction,expected:indices,actual,pass:JSON.stringify(indices.toSorted((a,b)=>a-b))===JSON.stringify(actual),rabbits:document.querySelectorAll('.cell-rabbit').length})
}
