import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Plugin } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const config = JSON.stringify({ advertisement: { interstitial: { placements: [{ id: 'bunoku_break' }] }, rewarded: { placements: [{ id: 'bunoku_help' }] } } })

// Module substitution only: no rewriting or slicing of shared source code.
// The default build does not load this plugin or the Bridge script.
export function playgamaBuild(): Plugin {
  const modules = new Map([
    [resolve(root, 'src/crazygames.ts'), resolve(root, 'src/playgama/platform.ts')],
    [resolve(root, 'src/components/PrivacyPolicy'), resolve(root, 'src/playgama/PrivacyPolicy.tsx')],
  ])
  return {
    name: 'bunoku-playgama', enforce: 'pre',
    resolveId(source, importer) {
      if (importer && source.startsWith('.')) return modules.get(resolve(dirname(importer), source))
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'playgama-bridge-config.json', source: config })
      this.emitFile({ type: 'asset', fileName: 'playgama-bridge.LICENSE.txt', source: readFileSync(resolve(root, 'node_modules/@playgama/bridge/LICENSE')) })
    },
    configureServer(server) {
      server.middlewares.use('/playgama-bridge-config.json', (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(config) })
    },
  }
}
