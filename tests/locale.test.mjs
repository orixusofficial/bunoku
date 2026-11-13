import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { translations } from '../src/translations.ts'
test('SDK locale chooses all supported languages; explicit manual preference survives SDK changes and reload',()=>{
  const values=new Map(), storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}
  const load=()=>{const m={exports:{}};const code=ts.transpileModule(fs.readFileSync('src/i18n.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext('(function(require,module,exports){'+code+'})',{localStorage:storage})(n=>n==='react'?{useSyncExternalStore:(_s,get)=>get()}:{translations},m,m.exports);return m.exports}
  const api=load()
  for(const locale of ['en-US','es-ES','ar-SA','hi-IN']){api.initializeLanguage(locale);assert.equal(api.useLanguage(),locale.slice(0,2));assert(api.t('Main Menu'))}
  api.initializeLanguage('xx');assert.equal(api.useLanguage(),'en')
  api.initializeLanguage('es');api.setLanguage('es');assert.equal(values.get('bunoku.language'),'es')
  const reloaded=load();reloaded.initializeLanguage('ar');assert.equal(reloaded.useLanguage(),'es')
})
