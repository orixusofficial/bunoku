import test from 'node:test'
import assert from 'node:assert/strict'
import { crossedCells } from '../src/game/dragPath.ts'

const bounds = n => Array.from({length:n*n},(_,index)=>({index,left:index%n*32,right:index%n*32+28,top:Math.floor(index/n)*32,bottom:Math.floor(index/n)*32+28}))
for(const n of [4,6,8,9]) test(`${n}x${n}: sparse segments cover every horizontal, vertical and diagonal cell`,()=>{
  const cells=bounds(n), center=i=>[i%n*32+14,Math.floor(i/n)*32+14]
  for(let line=0;line<n;line++)for(const vertical of [false,true]){
    const expected=Array.from({length:n},(_,i)=>vertical?i*n+line:line*n+i)
    assert.deepEqual(crossedCells(...center(expected[0]),...center(expected.at(-1)),cells),expected)
    assert.deepEqual(crossedCells(...center(expected.at(-1)),...center(expected[0]),cells),expected.toReversed())
  }
  for(const reverse of [false,true]){
    const diagonal=Array.from({length:n},(_,r)=>r*n+(reverse?n-1-r:r))
    assert.deepEqual(crossedCells(...center(diagonal[0]),...center(diagonal.at(-1)),cells),diagonal)
  }
  // Independent dense point sampling checks slanted paths and board entry/exit.
  for(const [a,b] of [[[-20,11],[n*32+20,n*15]],[[14,-30],[n*20,n*32+30]],[[4,7],[n*32-10,n*32-19]]]){
    const expected=new Set()
    for(let step=0;step<=10000;step++){
      const x=a[0]+(b[0]-a[0])*step/10000,y=a[1]+(b[1]-a[1])*step/10000
      for(const c of cells)if(x>c.left&&x<c.right&&y>c.top&&y<c.bottom)expected.add(c.index)
    }
    assert.deepEqual(crossedCells(...a,...b,cells),[...expected])
  }
  assert.deepEqual(crossedCells(-10,-10,-10,n*32,cells),[])
})
test('gaps and corner-only contacts do not mark neighbouring cells',()=>{
  assert.deepEqual(crossedCells(30,0,30,128,bounds(4)),[])
  const cells=[{index:0,left:0,right:10,top:0,bottom:10},{index:1,left:10,right:20,top:0,bottom:10},{index:2,left:10,right:20,top:10,bottom:20}]
  assert.deepEqual(crossedCells(5,5,15,15,cells),[0,2])
})
