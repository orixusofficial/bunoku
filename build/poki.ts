import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePath, type Plugin } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))

// Use platform module aliases only. Shared gameplay source stays intact and
// the standard, Playgama, and GameDistribution builds do not load this plugin.
export function pokiBuild(): Plugin {
  const platform = normalizePath(resolve(root, 'src/poki/platform.ts'))
  const routes = new Map([
    [resolve(root, 'src/crazygames.ts'), platform],
    [resolve(root, 'src/playgama/platform.ts'), platform],
    [resolve(root, 'src/playgama/storage.ts'), normalizePath(resolve(root, 'src/poki/storage.ts'))],
    [resolve(root, 'src/components/PrivacyPolicy'), normalizePath(resolve(root, 'src/poki/PrivacyPolicy.tsx'))],
    [resolve(root, 'src/components/GameScreen'), normalizePath(resolve(root, 'src/poki/GameScreen.tsx'))],
  ])
  return {
    name: 'bunoku-poki',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer && source.startsWith('.')) return routes.get(resolve(dirname(importer), source))
    },
    generateBundle(_options, bundle) {
      const ids = Object.values(bundle).flatMap(output => output.type === 'chunk' ? Object.keys(output.modules).map(normalizePath) : [])
      if (new Set(ids.filter(id => id === platform)).size !== 1) throw new Error('Poki build must contain exactly one Poki SDK adapter')
      if (ids.some(id => /\/src\/(crazygames\.ts|gamedistribution\/platform\.ts|playgama\/(platform|storage|runtime)\.ts)$/.test(id))) {
        throw new Error('Another platform SDK or storage adapter leaked into the Poki build')
      }
    },
  }
}
