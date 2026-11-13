import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

test('public asset URLs stay inside root, nested and configured hosting directories', () => {
  const source = fs.readFileSync(new URL('../src/assetUrl.ts', import.meta.url), 'utf8')
  for (const base of ['./', '/', '/games/bunoku/']) {
    const module = { exports: {} }
    const code = ts.transpileModule(source.replace('import.meta.env?.BASE_URL', JSON.stringify(base)), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
    vm.runInNewContext('(function(exports){' + code + '})', {})(module.exports)
    for (const documentUrl of ['https://host.test/', 'https://host.test/games/bunoku/index.html']) {
      for (const file of ['bunny/bunny.svg', 'audio/Xon.mp3', 'audio/music.mp3']) {
        const url = new URL(module.exports.assetUrl(file), documentUrl)
        const expected = new URL(base, documentUrl)
        assert.equal(url.pathname, expected.pathname + file)
        assert.equal(module.exports.assetUrl('/' + file), module.exports.assetUrl(file))
      }
    }
  }
})

test('production entry, font and worker remain portable without external font requests', () => {
  const dist = new URL('../dist/', import.meta.url)
  const html = fs.readFileSync(new URL('index.html', dist), 'utf8')
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(url => !url.startsWith('https://sdk.crazygames.com/'))
  assert(references.every(url => url.startsWith('./')), 'all built entry URLs must be relative')
  for (const ref of references) assert(fs.existsSync(new URL(ref, dist)), ref)
  const css = fs.readFileSync(new URL(references.find(ref => ref.endsWith('.css')), dist), 'utf8')
  assert(!/fonts\.googleapis|fonts\.gstatic/.test(css))
  const font = css.match(/url\(["']?(\.\/Nunito[^)"']+)["']?\)/)?.[1]
  assert(font, 'bundled Nunito font URL')
  assert(fs.existsSync(new URL('assets/' + font, dist)))
  assert(fs.existsSync(new URL('fonts/Nunito-OFL.txt', dist)))
  const js = fs.readFileSync(new URL(references.find(ref => ref.endsWith('.js')), dist), 'utf8')
  assert(/new URL\([`"']puzzle\.worker-[^`"']+[`"'],import\.meta\.url\)/.test(js), 'worker remains relative to its bundle')
})
