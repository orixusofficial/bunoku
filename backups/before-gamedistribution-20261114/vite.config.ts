import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  if (mode !== 'playgama') return { base: './', define: { 'globalThis.BUNOKU_PLAYGAMA': false }, plugins: [react()] }
  const [{ playgamaBridge }, { playgamaBuild }] = await Promise.all([import('@playgama/bridge/vite'), import('./build/playgama.ts')])
  return { root: resolve('playgama'), publicDir: resolve('public'), base: './', resolve: { alias: { '/src': resolve('src') } }, define: { 'globalThis.BUNOKU_PLAYGAMA': true }, plugins: [react(), playgamaBuild(), playgamaBridge({ mode: 'local' })], build: { outDir: resolve('dist-playgama'), emptyOutDir: true } }
})
