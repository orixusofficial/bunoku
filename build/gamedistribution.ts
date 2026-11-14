import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePath, type Plugin } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
export function gameDistributionBuild(): Plugin {
  const platform = normalizePath(resolve(root, 'src/gamedistribution/platform.ts'))
  const routes = new Map([
    [resolve(root, 'src/crazygames.ts'), platform],
    [resolve(root, 'src/playgama/platform.ts'), platform],
    [resolve(root, 'src/playgama/storage.ts'), normalizePath(resolve(root, 'src/gamedistribution/storage.ts'))],
    [resolve(root, 'src/components/PrivacyPolicy'), normalizePath(resolve(root, 'src/gamedistribution/PrivacyPolicy.tsx'))],
  ])
  return {
    name: 'bunoku-gamedistribution', enforce: 'pre',
    resolveId(source, importer) { if (importer && source.startsWith('.')) return routes.get(resolve(dirname(importer), source)) },
    generateBundle(_options, bundle) {
      const ids = Object.values(bundle).flatMap(output => output.type === 'chunk' ? Object.keys(output.modules) : [])
      if (new Set(ids.filter(id => normalizePath(id) === platform)).size !== 1) throw new Error('GameDistribution requires exactly one SDK adapter')
      if (ids.some(id => /\/src\/(crazygames\.ts|playgama\/(platform|storage|runtime)\.ts)$/.test(normalizePath(id)))) throw new Error('Another platform SDK leaked into the GameDistribution build')
    },
  }
}
