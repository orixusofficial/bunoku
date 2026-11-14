import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  if (mode !== 'playgama') return { base: './', plugins: [react()] }
  const [{ playgamaBridge }, { playgamaBuild }] = await Promise.all([import('@playgama/bridge/vite'), import('./build/playgama.ts')])
  return { base: './', plugins: [react(), playgamaBuild(), playgamaBridge({ mode: 'local' })], build: { outDir: 'dist-playgama' } }
})
