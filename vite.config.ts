import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  if (mode === 'poki') {
    const { pokiBuild } = await import('./build/poki.ts')
    return { root: resolve('poki'), publicDir: resolve('public'), base: './', resolve: { alias: { '/src': resolve('src') } }, define: { 'globalThis.BUNOKU_PLAYGAMA': true, 'globalThis.BUNOKU_GAMEDISTRIBUTION': false }, plugins: [react(), pokiBuild()], build: { outDir: resolve('dist-poki'), emptyOutDir: true } }
  }
  if (mode === 'gamedistribution') {
    const { gameId } = JSON.parse(readFileSync(new URL('./gamedistribution/game.config.json', import.meta.url), 'utf8')) as { gameId?: string }
    if (!gameId || !/^[a-f0-9]{32}$/i.test(gameId)) throw new Error('Provide Bunoku’s real GameDistribution Game ID in gamedistribution/game.config.json before building.')
    const { gameDistributionBuild } = await import('./build/gamedistribution.ts')
    return { root: resolve('gamedistribution'), publicDir: resolve('public'), base: './', resolve: { alias: { '/src': resolve('src') } }, define: { 'globalThis.BUNOKU_PLAYGAMA': false, 'globalThis.BUNOKU_GAMEDISTRIBUTION': true, __BUNOKU_GD_GAME_ID__: JSON.stringify(gameId) }, plugins: [react(), gameDistributionBuild()], build: { outDir: resolve('dist-gamedistribution'), emptyOutDir: true } }
  }
  if (mode !== 'playgama') return { base: './', define: { 'globalThis.BUNOKU_PLAYGAMA': false, 'globalThis.BUNOKU_GAMEDISTRIBUTION': false }, plugins: [react()] }
  const [{ playgamaBridge }, { playgamaBuild }] = await Promise.all([import('@playgama/bridge/vite'), import('./build/playgama.ts')])
  return { root: resolve('playgama'), publicDir: resolve('public'), base: './', resolve: { alias: { '/src': resolve('src') } }, define: { 'globalThis.BUNOKU_PLAYGAMA': true, 'globalThis.BUNOKU_GAMEDISTRIBUTION': false }, plugins: [react(), playgamaBuild(), playgamaBridge({ mode: 'local' })], build: { outDir: resolve('dist-playgama'), emptyOutDir: true } }
})
