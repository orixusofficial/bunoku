import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { createAllowances } from '../src/game/allowances.ts'
import { gameDistributionBuild } from '../build/gamedistribution.ts'

const gameId=JSON.parse(fs.readFileSync('gamedistribution/game.config.json','utf8')).gameId
const tick=()=>new Promise(setImmediate)
function fixture() {
 const scripts=[],calls=[],timers=[],logs=[],listeners=new Map(),data=new Map()
 let adMuted=false,platformMuted=false,inert=false,resolveAd,rejectAd
 const root={toggleAttribute(_name,value){inert=value}}
 const document={hidden:false,head:{appendChild(script){scripts.push(script)}},createElement:tag=>({tag}),getElementById:id=>id==='root'?root:scripts.find(s=>s.id===id),addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)}
 const window={confirm:()=>true,gdsdk:{preloadAd(type){calls.push(['preload',type]);return Promise.resolve()},showAd(type){calls.push(['show',type]);return new Promise((resolve,reject)=>{resolveAd=resolve;rejectAd=reject})}}}
 const source=fs.readFileSync('src/gamedistribution/platform.ts','utf8').replace(/^if \(import.meta.hot\).*$/m,'')
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,module={exports:{}}
 const audio={setAdMuted:value=>adMuted=value,setPlatformMuted:value=>platformMuted=value}
 vm.runInNewContext('(function(require,module,exports){'+js+'})',{window,document,navigator:{language:'es'},__BUNOKU_GD_GAME_ID__:gameId,console:{info:(...args)=>logs.push(args),warn:(...args)=>logs.push(args),error:(...args)=>logs.push(args)},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){}})(()=>audio,module,module.exports)
 return{api:module.exports,window,document,scripts,calls,timers,logs,data,event:(name,message)=>window.GD_OPTIONS.onEvent({name,message}),resolveAd:()=>resolveAd({}),rejectAd:()=>rejectAd(Error('unfilled')),state:()=>({adMuted,platformMuted,inert}),hide(value){document.hidden=value;listeners.get('visibilitychange')()},account:createAllowances(()=>({getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}))}
}
async function ready(f) { const p=f.api.initializeGameDistribution(); f.event('SDK_READY'); assert.equal(await p,true); await tick() }

test('GD initializes and preloads once with the real configured ID; no ad is shown by initialization',async()=>{
 const f=fixture(),first=f.api.initializeGameDistribution(),second=f.api.initializeGameDistribution()
 assert.equal(first,second);assert.equal(f.scripts.length,1)
 assert.equal(f.scripts[0].src,'https://html5.api.gamedistribution.com/main.min.js')
 assert.equal(f.window.GD_OPTIONS.gameId,gameId);assert.match(gameId,/^[a-f0-9]{32}$/i)
 assert.equal(f.api.adsAvailable(),false)
 f.event('SDK_READY');f.event('SDK_READY');assert.equal(await first,true)
 assert.deepEqual(f.calls,[['preload','rewarded']]);assert.equal(f.api.adsAvailable(),true)
 f.event('SDK_REWARDED_WATCH_COMPLETE');assert.equal(f.account.status().hintCredits,0)
})
test('script errors and startup timeout are non-fatal and never request ads',async()=>{
 for(const mode of ['error','timeout']) {
  const f=fixture(),p=f.api.initializeGameDistribution()
  if(mode==='error')f.scripts[0].onerror();else f.timers[0]()
  assert.equal(await p,false);assert.equal(f.api.adsAvailable(),false)
  assert.equal(await f.api.requestRewardedAd(()=>assert.fail('grant')),'unavailable')
  assert.equal(f.state().inert,false);assert.equal(f.calls.length,0)
 }
})
test('GD pause/resume, tab changes and dialogs restore audio without changing user preferences',async()=>{
 const f=fixture();await ready(f)
 f.event('SDK_GAME_PAUSE');assert.deepEqual(f.state(),{adMuted:true,platformMuted:false,inert:true})
 f.event('SDK_GAME_START');assert.deepEqual(f.state(),{adMuted:false,platformMuted:false,inert:false})
 f.hide(true);assert.equal(f.state().platformMuted,true);assert.equal(f.state().inert,true)
 f.hide(false);assert.equal(f.state().platformMuted,false)
 const resume=f.api.pauseForDialog();assert.equal(f.state().platformMuted,true)
 resume();resume();assert.equal(f.state().inert,false)
})
for(const kind of ['hint','undo']) test(`GD ${kind}: completion grants exactly 3 once, persists independently and never auto-consumes`,async()=>{
 const f=fixture();await ready(f);for(let i=0;i<5;i++)f.account.consume(kind)
 const ad=f.api.requestRewardedAd(()=>f.account.grant(kind,'completed-ad'))
 assert.deepEqual(f.calls.at(-1),['show','rewarded'],'showAd is called synchronously from the action')
 assert.equal(f.state().adMuted,false,'do not mute during a pending request before SDK_GAME_PAUSE')
 assert.equal(await f.api.requestRewardedAd(()=>assert.fail('duplicate')),'busy')
 f.event('SDK_GAME_PAUSE');assert.equal(f.state().adMuted,true)
 f.event('SDK_REWARDED_WATCH_COMPLETE');f.event('SDK_REWARDED_WATCH_COMPLETE')
 assert.equal(f.account.status()[kind+'Credits'],3)
 assert.equal(f.account.status()[kind==='hint'?'undoCredits':'hintCredits'],0)
 f.event('SDK_GAME_START');f.resolveAd();assert.equal(await ad,'rewarded')
 f.event('SDK_REWARDED_WATCH_COMPLETE');assert.equal(f.account.status()[kind+'Credits'],3)
 const restored=createAllowances(()=>({getItem:key=>f.data.get(key)??null,setItem:(key,value)=>f.data.set(key,value)}))
 assert.equal(restored.status()[kind+'Credits'],3);assert.equal(f.state().inert,false);assert.equal(f.state().adMuted,false)
})
for(const kind of ['hint','undo']) for(const outcome of ['early-close','unfilled','sdk-error','throw']) test(`GD ${kind}: ${outcome} grants zero and allows a later attempt`,async()=>{
 const f=fixture();await ready(f)
 if(outcome==='throw')f.window.gdsdk.showAd=()=>{throw Error('blocked')}
 const ad=f.api.requestRewardedAd(()=>f.account.grant(kind,'must-not-grant'))
 if(outcome==='early-close'){f.event('SDK_GAME_PAUSE');f.event('SDK_GAME_START');f.resolveAd()}
 if(outcome==='unfilled')f.rejectAd()
 if(outcome==='sdk-error'){f.event('SDK_GAME_PAUSE');f.event('SDK_ERROR','ad failed')}
 assert.equal(await ad,'unavailable');assert.equal(f.account.status()[kind+'Credits'],0)
 assert.deepEqual(f.state(),{adMuted:false,platformMuted:false,inert:false})
 f.event('SDK_REWARDED_WATCH_COMPLETE');assert.equal(f.account.status()[kind+'Credits'],0)
 f.window.gdsdk.showAd=()=>Promise.resolve({success:true})
 assert.equal(await f.api.requestRewardedAd(()=>assert.fail('a resolved promise is not proof of watching')),'unavailable')
})
test('GD promise completion cannot unmute an ad until SDK_GAME_START signals resume',async()=>{
 const f=fixture();await ready(f)
 const ad=f.api.requestRewardedAd(()=>true);f.event('SDK_GAME_PAUSE');f.event('SDK_REWARDED_WATCH_COMPLETE')
 f.resolveAd();assert.equal(await ad,'rewarded');assert.equal(f.state().adMuted,true);assert.equal(f.state().inert,true)
 f.event('SDK_GAME_START');assert.equal(f.state().adMuted,false);assert.equal(f.state().inert,false)
})
test('GD event-driven showAd without a promise finishes on resume and ignores duplicate completion',async()=>{
 const f=fixture();await ready(f);f.window.gdsdk.showAd=()=>undefined
 const ad=f.api.requestRewardedAd(()=>f.account.grant('hint','event-only'))
 f.event('SDK_GAME_PAUSE');f.event('SDK_REWARDED_WATCH_COMPLETE');f.event('SDK_GAME_START')
 assert.equal(await ad,'rewarded');assert.equal(f.account.status().hintCredits,3)
})
test('GD interstitials are explicitly requested, duplicate-proof, SDK-regulated and cannot grant rewards',async()=>{
 const f=fixture();await ready(f)
 assert(!f.calls.some(([kind])=>kind==='show'))
 const ad=f.api.showInterstitialAtBreak();assert.deepEqual(f.calls.at(-1),['show',undefined])
 assert.equal(await f.api.showInterstitialAtBreak(),'busy')
 f.event('SDK_GAME_PAUSE');f.event('SDK_REWARDED_WATCH_COMPLETE');f.event('SDK_GAME_START');f.resolveAd();await ad
 assert.equal(f.account.status().hintCredits,0)
 const second=f.api.showInterstitialAtBreak();f.rejectAd();await second
 assert.equal(f.calls.filter(([kind])=>kind==='show').length,2,'no custom cooldown')
 const end=f.api.beginLoading();assert.equal(await f.api.requestRewardedAd(()=>false),'busy');end();end()
})
test('GDPR opt-outs are respected without starting independent tracking or ads',async()=>{
 const f=fixture();await ready(f)
 for(const name of ['SDK_GDPR_TRACKING','SDK_GDPR_TARGETING','SDK_GDPR_THIRD_PARTY'])f.event(name)
 assert.deepEqual({...f.api.privacyState()},{tracking:false,targeting:false,thirdParty:false})
 assert.equal(f.calls.filter(([kind])=>kind==='show').length,0)
})
test('GD target routes both legacy platform hooks to one normalized adapter; no source rewriting',()=>{
 const plugin=gameDistributionBuild(),entry=path.resolve('src/App.tsx')
 const a=plugin.resolveId('./crazygames.ts',entry),b=plugin.resolveId('./playgama/platform.ts',entry)
 assert.equal(a,b);assert(!a.includes('\\'));assert.equal(plugin.transform,undefined)
 const context={emitFile(){}}
 plugin.generateBundle.call(context,{}, {app:{type:'chunk',modules:{[a]:{}}}})
 assert.throws(()=>plugin.generateBundle.call(context,{}, {app:{type:'chunk',modules:{[a]:{},[path.resolve('src/crazygames.ts')]:{}}}}),/leaked/)
 const html=fs.readFileSync('gamedistribution/index.html','utf8')
 assert(html.includes('/src/gamedistribution/main.ts'));assert(!html.includes('crazygames-sdk'));assert(!html.includes('playgama-bridge.js'))
})

test('GD resume event releases gameplay even if the ad promise never settles',async()=>{
 const f=fixture();await ready(f)
 const ad=f.api.requestRewardedAd(()=>assert.fail('early closure cannot grant'))
 f.event('SDK_GAME_PAUSE');f.event('SDK_GAME_START')
 assert.equal(await ad,'unavailable');assert.equal(f.state().inert,false);assert.equal(f.state().adMuted,false)
})
