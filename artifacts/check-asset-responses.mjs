import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const origin = process.argv[2] || 'http://localhost:5197/package/bunoku/'
const remote = origin.startsWith('https:')
const results = []
const checked = new Set()
async function check(url, expected) {
  if (checked.has(url)) return
  checked.add(url)
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  assert.equal(response.status, 200, url)
  const bytes = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type')
  assert(bytes.length > 0, url)
  if (!url.endsWith('.html') && url !== origin) assert(!contentType?.includes('text/html'), `HTML fallback instead of asset: ${url}`)
  if (expected) assert.equal(createHash('sha256').update(bytes).digest('hex'), createHash('sha256').update(expected).digest('hex'), `Changed asset content: ${url}`)
  results.push({ url, status: response.status, bytes: bytes.length, contentType })
  return bytes.toString()
}
const html = await check(origin)
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])
for (const file of walk('public')) {
  const relative = path.relative('public', file).replaceAll('\\', '/')
  if (remote && relative === 'fonts/Nunito-OFL.txt') continue // Not deployed yet.
  await check(new URL(relative, origin).href, fs.readFileSync(file))
}
const built = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m => new URL(m[1], origin).href)
for (const url of built) {
  const source = await check(url)
  if (url.endsWith('.css')) {
    const references = [...source.matchAll(/url\(["']?([^\s)"']+)["']?\)/g), ...source.matchAll(/@import\s*["']([^"']+)["']/g)]
    for (const match of references) {
      if (!match[1].startsWith('data:')) {
        const fontUrl = new URL(match[1], url).href
        const fontCss = await check(fontUrl)
        if (fontUrl.includes('fonts.googleapis.com')) for (const f of fontCss.matchAll(/url\(([^)]+)\)/g)) await check(f[1])
      }
    }
  } else {
    const worker = source.match(/(?:\.\/|\/assets\/)?puzzle\.worker-[\w-]+\.js/)
    assert(worker, 'Worker URL missing')
    await check(new URL(worker[0], url).href)
  }
}
const report = { target: origin, patchedDeployment: !remote, checked: results.length, results }
fs.writeFileSync(remote ? 'artifacts/assets-vercel-responses.json' : 'artifacts/assets-local-responses.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
