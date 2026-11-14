import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, require, globals) {
 const source=fs.readFileSync(file,'utf8').replace(/^if \(import.meta.hot\).*$/m,'').replaceAll('import.meta.env.DEV','true')
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,module={exports:{}}
 vm.runInNewContext('(function(require,module,exports){'+js+'})',{console,...globals})(require,module,module.exports)
 return module.exports
}
const tick=()=>new Promise(setImmediate)
function audioFixture({unavailable=false}={}) {
 const requests=[],scheduled=[],fallback=[],contexts=[]
 const decoded=name=>{
  const samples=new Float32Array(name==='foundbunny'?1000:2000)
  samples.fill(0.1,name==='foundbunny'?100:500,name==='foundbunny'?300:900)
  return {duration:samples.length/1000,length:samples.length,sampleRate:1000,numberOfChannels:1,getChannelData:()=>samples}
 }
 class AudioContext {
  constructor(){this.currentTime=10;this.state='suspended';this.resumes=0;contexts.push(this)}
  createGain(){return this.gain={gain:{value:1},connect(){}}}
  resume(){this.resumes++;this.state='running';return Promise.resolve()}
  decodeAudioData(bytes){return Promise.resolve(decoded(bytes.name))}
  createBufferSource(){const source={connect(){},disconnect(){},start(time,offset,duration){scheduled.push({source,time,offset,duration})}};return source}
 }
 const fetch=async url=>{requests.push(url);return{ok:!unavailable,arrayBuffer:async()=>({name:url.split('/').at(-1).replace('.mp3','')})}}
 const api=load('src/playgama/discoveryAudio.ts',()=>({assetUrl:p=>'./'+p}),{window:{AudioContext},fetch})
 const playSound=name=>{const handlers={};fallback.push({name,handlers});return{addEventListener:(event,fn)=>handlers[event]=fn}}
 return{api,requests,scheduled,fallback,contexts,playSound}
}
test('preloaded discovery schedules cue and voice contiguously, trimming only edge silence',async()=>{
 const f=audioFixture();f.api.preloadDiscoveryAudio();await tick()
 assert.equal(f.requests.length,5)
 f.api.playDiscovery('nice',f.playSound)
 assert.equal(f.contexts[0].resumes,1,'resume is requested synchronously in the input task')
 await tick();assert.equal(f.requests.length,5,'no new network request at rabbit placement')
 assert.equal(f.scheduled.length,2);const[cue,voice]=f.scheduled
 assert.equal(cue.time,10);assert(Math.abs(cue.offset-0.09)<1e-6)
 assert(Math.abs(cue.duration-0.24)<1e-6);assert(Math.abs(voice.offset-0.49)<1e-6)
 assert.equal(voice.time,cue.time+cue.duration,'no ended event or timer gap')
 assert.equal(f.fallback.length,0)
 f.api.playDiscovery('wow',f.playSound);await tick()
 assert.equal(f.scheduled.length,4)
 assert.equal(f.scheduled[2].time,voice.time+voice.duration,'rapid discoveries cannot overlap')
})
test('Sound Effects/platform mute silences the discovery channel and prevents new queued speech',async()=>{
 const f=audioFixture();f.api.preloadDiscoveryAudio();await tick()
 f.api.setDiscoveryMuted(true);assert.equal(f.contexts[0].gain.gain.value,0)
 f.api.playDiscovery('nice',f.playSound);await tick();assert.equal(f.scheduled.length,0)
 f.api.setDiscoveryMuted(false);assert.equal(f.contexts[0].gain.gain.value,1)
 f.api.playDiscovery('nice',f.playSound);await tick();assert.equal(f.scheduled.length,2)
})
test('audio decode/network failure safely uses the existing sequential player once',async()=>{
 const f=audioFixture({unavailable:true});f.api.playDiscovery('excellent',f.playSound);await tick()
 assert.deepEqual(f.fallback.map(s=>s.name),['foundbunny'])
 f.fallback[0].handlers.ended();f.fallback[0].handlers.error()
 assert.deepEqual(f.fallback.map(s=>s.name),['foundbunny','excellent'])
})
test('iframe-safe Reset confirmation supports Stay, focus, duplicate clicks and confirm without browser modals',()=>{
 let document,pauses=0,confirmed=0
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attributes={}}
  append(...children){for(const child of children){this.children.push(child);child.parent=this}}
  setAttribute(key,value){this.attributes[key]=value}
  focus(){document.activeElement=this}
  remove(){this.parent.children=this.parent.children.filter(e=>e!==this)}
 }
 document={body:new Element('body'),createElement:tag=>new Element(tag),activeElement:new Element('button')}
 const original=document.activeElement
 const api=load('src/playgama/resetConfirmation.ts',()=>({pauseForDialog(){pauses++;let released=false;return()=>{if(!released){released=true;pauses--}}}}),{document})
 const open=()=>api.confirmPuzzleReset('Restart this puzzle?','Stay','Restart',()=>confirmed++)
 open();open();assert.equal(document.body.children.length,1);assert.equal(pauses,1)
 let panel=document.body.children[0].children[0],cancel=panel.children[1]
 assert.equal(panel.attributes.role,'dialog');assert.equal(document.activeElement,cancel)
 cancel.onclick();assert.equal(confirmed,0);assert.equal(pauses,0);assert.equal(document.activeElement,original)
 open();panel=document.body.children[0].children[0]
 let prevented=0;panel.onkeydown({key:'Tab',preventDefault(){prevented++}})
 assert.equal(prevented,1);assert.equal(document.activeElement,panel.children[2])
 const confirm=panel.children[2];confirm.onclick();confirm.onclick()
 assert.equal(confirmed,1);assert.equal(pauses,0);assert.equal(document.body.children.length,0)
})
