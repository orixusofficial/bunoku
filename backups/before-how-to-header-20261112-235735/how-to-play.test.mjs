import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
test('How to Play lists every binding, preserves rules, and handles Escape and navigation safely',()=>{
 let value=false,queued=[],cleanup=[],tree,back=0,play=0,otherModal=false;
 const listeners=new Set(),jsx=(type,props)=>({type,props});
 class Element{constructor(editable=false){this.editable=editable}closest(){return this.editable?this:null}}
 const react={useState:()=>[value,v=>value=v],useEffect:fn=>queued.push(fn)};
 const modules=new Map();
 function load(file){if(modules.has(file))return modules.get(file).exports;const m={exports:{}};modules.set(file,m);const js=ts.transpileModule(fs.readFileSync(new URL('../src/components/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const req=n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='../i18n'?{t:s=>s}:n==='./MainMenuConfirmation'?{__esModule:true,default:load('MainMenuConfirmation.tsx').default}:{__esModule:true,default:()=>null};
 vm.runInNewContext('(function(require,module,exports){'+js+'})',{HTMLElement:Element,document:{hidden:false,querySelector:()=>otherModal?{}:null},window:{addEventListener:(n,f)=>listeners.add(f),removeEventListener:(n,f)=>listeners.delete(f)}})(req,m,m.exports);return m.exports}
 const Page=load('HowToPlay.tsx').default,Dialog=load('MainMenuConfirmation.tsx').default;
 function nodes(n){if(!n||typeof n!=='object')return[];if(typeof n.type==='function')return nodes(n.type(n.props));return[n,...[n.props?.children].flat(Infinity).flatMap(nodes)]}
 function render(){cleanup.forEach(fn=>fn());cleanup=[];tree=Page({onBack:()=>back++,onPlay:()=>play++,onToggleMusic(){},onToggleSoundEffects(){},musicOn:false,soundEffectsOn:true});for(const fn of queued)cleanup.push(fn());queued=[];assert.equal(listeners.size,1)}
 function text(n){if(typeof n==='string'||typeof n==='number')return String(n);if(!n||typeof n!=='object')return'';if(typeof n.type==='function')return text(n.type(n.props));return[n.props?.children].flat(Infinity).map(text).join(' ')}
 function press(key,repeat=false,editable=false){let prevented=false,stopped=false;for(const fn of listeners)fn({key,repeat,target:new Element(editable),preventDefault(){prevented=true},stopPropagation(){stopped=true}});return{prevented,stopped}}
 render();const content=text(tree);
 for(const item of ['W / A / S / D','Arrow keys','Enter','Space','Hold Space + movement','Q','E','R','Esc','Move up','Move down','Move left','Move right','Select/place rabbit','Mark or remove X','Open Main Menu confirmation','Every colored region must contain exactly one rabbit.','Mouse and touch'])assert(content.includes(item),item);
 for(const key of ['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter',' ','q','e','r'])assert.equal(press(key).prevented,false);
 press('Escape',false,true);assert(!value);otherModal=true;press('Escape');assert(!value);otherModal=false;
 assert.deepEqual(press('Escape'),{prevented:true,stopped:true});render();assert.equal(nodes(tree).filter(n=>n.props?.role==='dialog').length,1);press('Escape',true);render();assert.equal(nodes(tree).filter(n=>n.props?.role==='dialog').length,1);
 nodes(tree).find(n=>n.type==='button'&&text(n)==='Stay').props.onClick();render();assert(!value);assert.equal(back,0);
 press('Escape');render();nodes(tree).find(n=>n.props?.role==='dialog').props;nodes(tree).filter(n=>n.type==='button'&&text(n)==='Main Menu').at(0).props.onClick();assert.equal(back,1);
 value=false;render();nodes(tree).find(n=>n.type==='button'&&text(n)==='Main Menu').props.onClick();assert.equal(back,2);
 nodes(tree).find(n=>n.type==='button'&&text(n)==='Back to Menu').props.onClick();assert.equal(back,3);
 nodes(tree).find(n=>n.type==='button'&&text(n)==='Let’s Play!').props.onClick();assert.equal(play,1);
 cleanup.forEach(fn=>fn());assert.equal(listeners.size,0);
});