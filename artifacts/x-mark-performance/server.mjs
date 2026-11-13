import { createServer } from 'vite'
import fs from 'node:fs'
const baseline = fs.readFileSync('backups/before-x-mark-performance-20261114-005539/GameScreen.tsx', 'utf8')
const server = await createServer({ server: { host: '0.0.0.0', port: 5304, strictPort: true }, plugins: [{
  name: 'qa-render-count', enforce: 'pre',
  load(id) { if (id.endsWith('/GameScreen.tsx?baseline')) return baseline },
  transform(source, id) {
    if (id.includes('/GameScreen.tsx')) return source.replace('const row = Math.floor(index / size)', 'globalThis.__cellRenders = (globalThis.__cellRenders || 0) + 1; const row = Math.floor(index / size)')
    if (id.endsWith('/PuzzleCell.tsx')) return source.replace('const row = Math.floor(index / size)', 'globalThis.__cellRenders = (globalThis.__cellRenders || 0) + 1; const row = Math.floor(index / size)')
  },
}] })
await server.listen()
console.log('QA benchmark http://127.0.0.1:5304/artifacts/x-mark-performance/index.html')

