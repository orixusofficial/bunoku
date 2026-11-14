import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { normalizePath, type Plugin } from 'vite'

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
      if (importer && source.startsWith('.')) {
        const target = modules.get(resolve(dirname(importer), source))
        // Vite uses forward-slash IDs on Windows too. Mixed IDs create two
        // adapter instances: the game would call one that was never initialized.
        if (target) return normalizePath(target)
      }
    },
    generateBundle(_options, bundle) {
      const adapters = new Set(Object.values(bundle).flatMap(output => output.type === 'chunk' ? Object.keys(output.modules) : [])
        .filter(id => normalizePath(id) === normalizePath(resolve(root, 'src/playgama/platform.ts'))))
      if (adapters.size !== 1) throw new Error(`Expected one Playgama adapter instance, found ${adapters.size}`)
      this.emitFile({ type: 'asset', fileName: 'playgama-bridge-config.json', source: config })
      this.emitFile({ type: 'asset', fileName: 'playgama-bridge.LICENSE.txt', source: readFileSync(resolve(root, 'node_modules/@playgama/bridge/LICENSE')) })
    },
    configureServer(server) {
      server.middlewares.use('/playgama-bridge-config.json', (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(config) })
    },
  }
}
