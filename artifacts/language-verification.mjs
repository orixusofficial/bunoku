import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire}from'node:module';import * as engine from '../src/game/puzzle.ts';
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const store=new Map();const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
const cache=new Map();let stateIndex=0,mode='normal',puzzle;
const react={...React,useSyncExternalStore:(_s,get)=>get(),useState(init){let value=typeof init==='function'?init():init;const i=stateIndex++;if(i===1&&mode==='win')value={cells:puzzle.regions.map((_,i)=>puzzle.solution.includes(i)?'rabbit':'empty'),lives:2};if(i===1&&mode==='fail')value={cells:Array(puzzle.size**2).fill('empty'),lives:0};if(i===9&&mode!=='normal')value=true;return[value,()=>{}]},useRef:v=>({current:v}),useEffect:()=>{}};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);let source=fs.readFileSync(file,'utf8');const sourceFile=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);if(file.endsWith('App.tsx'))source+='\nexport { SettingsDialog as TestSettings }';
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const req=n=>n==='react'?react:n==='react/jsx-runtime'?require(n):n.endsWith('.css')?{}:n.includes('game/puzzleClient')?{}:n.includes('game/levels')?{loadNormalLevel:()=>1,saveNormalLevel(){}}:n.includes('game/puzzle')?engine:n.endsWith('/audio')?{}:load(path.resolve(path.dirname(file),n)+(n.endsWith('.ts')?'':fs.existsSync(path.resolve(path.dirname(file),n)+'.tsx')?'.tsx':'.ts'));
vm.runInNewContext('(function(require,module,exports){'+js+'})',{localStorage:storage,console,document:{hidden:false},setTimeout,clearTimeout})(req,module,module.exports);return module.exports;
}
const i18n=load('src/i18n.ts'),dictionary=load('src/translations.ts').translations;
for(const [key,values]of Object.entries(dictionary)){assert.equal(values.length,3);for(const value of values){assert(value);assert.deepEqual([...value.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort(),[...key.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort())}}
const App=load('src/App.tsx'),Menu=load('src/components/MainMenu.tsx').default,Tutorial=load('src/components/HowToPlay.tsx').default,Game=load('src/components/GameScreen.tsx').default;
const props={musicOn:false,soundEffectsOn:true,onToggleMusic(){},onToggleSoundEffects(){},onSettings(){},onMenu(){},onPlay(){},onDaily(){},onTutorial(){},onBack(){}};
for(const lang of ['en','es','ar','hi']){
i18n.setLanguage(lang);mode='normal';stateIndex=0;
const menu=renderToStaticMarkup(React.createElement(Menu,props));assert(menu.includes(i18n.t('Welcome to Bunoku!')));assert(menu.includes('Bunoku'));assert(menu.includes(i18n.t('Daily Puzzle')));
const tutorial=renderToStaticMarkup(React.createElement(Tutorial,props));assert(tutorial.includes(i18n.t('Every colored region must contain exactly one rabbit.')));
for(const daily of [false,true]){puzzle=daily?engine.createDailyPuzzle():engine.createPuzzle(1);stateIndex=0;const markup=renderToStaticMarkup(React.createElement(Game,{...props,daily,initialPuzzle:puzzle}));assert(markup.includes(i18n.t('Hint')));assert(markup.includes(i18n.t('Restart')));assert.equal((markup.match(/role="gridcell"/g)||[]).length,daily?81:16)}
stateIndex=0;const settings=renderToStaticMarkup(React.createElement(App.TestSettings,{effectsOn:true,musicOn:false,onToggleEffects(){},onToggleMusic(){},onClose(){}}));assert(settings.includes(i18n.t('Language')));assert.equal((settings.match(/<option/g)||[]).length,4);
puzzle=engine.createPuzzle(1);mode='win';stateIndex=0;const win=renderToStaticMarkup(React.createElement(Game,{...props,initialPuzzle:puzzle}));assert(win.includes(i18n.t('Puzzle Complete!')));assert(win.includes(i18n.t('You solved the Bunoku puzzle with {count} carrots left.',{count:2})));assert(!win.includes('class="controls"'));
mode='fail';stateIndex=0;const fail=renderToStaticMarkup(React.createElement(Game,{...props,initialPuzzle:puzzle}));assert(fail.includes(i18n.t('Out of Carrots')));assert(fail.includes(i18n.t('Oh no, out of carrots!')));assert(!fail.includes('class="controls"'));console.log('PASS '+lang+': menu, tutorial, Settings, normal 4x4, Daily 9x9, win and fail');
}
assert.equal(store.get('bunoku.language'),'hi');
for(const file of ['src/App.tsx','src/components/GameScreen.tsx','src/components/MainMenu.tsx','src/components/HowToPlay.tsx','src/components/AudioQuickControls.tsx']){
const text=fs.readFileSync(file,'utf8'),sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function v(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='t'&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])){const s=n.arguments[0].text;assert(s in dictionary,'Missing translations: '+s)}if(ts.isJsxText(n)&&n.text.trim())assert(['b','bunoku','Bunoku','/','×','→','🥕'].includes(n.text.trim()),'Untranslated JSX text: '+n.text);ts.forEachChild(n,v)}v(sf);
}
console.log('PASS translation coverage, parameter parity, saved language, and unchanged grid cell counts');