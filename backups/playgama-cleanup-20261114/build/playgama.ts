import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const platform = resolve(root, 'src/playgama/platform.ts')
const storageFiles = new Set(['App.tsx', 'i18n.ts', 'game/allowances.ts', 'game/levels.ts', 'game/tutorial.ts'])
function replace(source: string, before: string, after: string) {
  if (!source.includes(before)) throw new Error(`Playgama adapter needs updating: missing ${before}`)
  return source.replaceAll(before, after)
}

// Deliberately build-only. Shared gameplay source and the default bundle stay
// unchanged; failures are explicit if a shared integration point moves.
export function playgamaBuild(): Plugin {
  return {
    name: 'bunoku-playgama', enforce: 'pre',
    resolveId(source, importer) {
      if (!importer?.replaceAll('\\', '/').includes('/src/')) return
      if (/\/?crazygames(?:\.ts)?$/.test(source)) return platform
      if (source === './components/PrivacyPolicy') return resolve(root, 'src/playgama/PrivacyPolicy.tsx')
    },
    transformIndexHtml: { order: 'pre', handler(html) {
      return replace(html.replace(/\s*<script id="crazygames-sdk"[^>]*><\/script>/, ''), '/src/main.tsx', '/src/playgama/main.ts')
    } },
    transform(source, id) {
      const relative = id.replaceAll('\\', '/').split('/src/')[1]?.split('?')[0]
      if (!relative || relative.startsWith('playgama/')) return
      if (storageFiles.has(relative)) {
        source = source.replace(/\bglobalThis\.localStorage\b/g, 'gameStorage').replace(/\blocalStorage\b/g, 'gameStorage')
        source = `import { gameStorage } from ${JSON.stringify(resolve(root, 'src/playgama/storage.ts'))};\n${source}`
      }
      if (relative === 'game/keyboard.ts') source = replace(source, "const key = event.key.toLowerCase()", "const key = event.key.toLowerCase(); if (key === 'escape') return")
      if (relative === 'components/HowToPlay.tsx') {
        source = replace(source, 'keyboardControls.map(', "keyboardControls.filter(([key]) => key !== 'Esc').map(")
        const start = source.indexOf('  useEffect(() => {'), end = source.indexOf('  return <main', start)
        if (start < 0 || end < 0) throw new Error('How to Play Escape adapter needs updating')
        source = source.slice(0, start) + source.slice(end)
      }
      if (relative === 'App.tsx') {
        source = `import { showInterstitialAtBreak } from ${JSON.stringify(platform)};\n${source}`
        source = replace(source, "onMenu={() => setScreen('menu')}", "onMenu={() => { setScreen('menu'); void showInterstitialAtBreak() }}")
      }
      if (relative === 'components/MainMenu.tsx') source = replace(source, '{t("Settings")}</button>', '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></svg>{t("Settings")}</button>')
      if (relative === 'components/GameScreen.tsx') {
        source = `import { isPlatformPaused, adsAvailable, showInterstitialAtBreak, reportLevelStart, reportOutcome } from ${JSON.stringify(platform)};\n${source}`
        source = replace(source, 'if (menuConfirmation || rewardPending.current) return', 'if (menuConfirmation || rewardPending.current || isPlatformPaused()) return')
        source = replace(source, 'enabled: () => !!gameRoot.current', 'enabled: () => !isPlatformPaused() && !!gameRoot.current')
        source = replace(source, 'hint: onHint, undo: onUndo,', "hint: () => { const b = allowances.status(); if (b.hintFree + b.hintCredits > 0) onHint() }, undo: () => { const b = allowances.status(); if (b.undoFree + b.undoCredits > 0) onUndo() },")
        source = replace(source, '  const level = puzzle.level', '  const level = puzzle.level\n  useEffect(() => { if (active) reportLevelStart(puzzle.level) }, [puzzle])')
        source = replace(source, "playSound('win'); endTimer.current", "reportOutcome('win', level); playSound('win'); endTimer.current")
        source = replace(source, "playSound('fail'); endTimer.current", "reportOutcome('fail', level); playSound('fail'); endTimer.current")
        source = replace(source, "    setPreparingPuzzle(true); setGenerationError('')", "    setPreparingPuzzle(true); setGenerationError(''); await showInterstitialAtBreak()")
        source = replace(source, 'const startOver = () => { if (daily) return;', 'const startOver = async () => { if (daily || isPlatformPaused()) return; await showInterstitialAtBreak();')
        source = replace(source, 'const onRestart = () => {', 'const onRestart = async () => {')
        source = replace(source, "    if (tutorialStep >= 1 && tutorialStep <= 4) setTutorialProgress(1)", "    await showInterstitialAtBreak()\n    if (tutorialStep >= 1 && tutorialStep <= 4) setTutorialProgress(1)")
        source = replace(source, '<span>{t("Hint")}</span>', '<span>{balance.hintFree + balance.hintCredits === 0 && adsAvailable() ? t("Watch ad: +3 Hints") : t("Hint")}</span>')
        source = replace(source, '<span>{t("Undo")}</span>', '<span>{balance.undoFree + balance.undoCredits === 0 && adsAvailable() ? t("Watch ad: +3 Undos") : t("Undo")}</span>')
        source = replace(source, ': <RewardIcon/>', ': adsAvailable() ? <RewardIcon/> : <span className="control-count">0</span>')
        source = replace(source, 'disabled={tutorialStep >= 1 && tutorialStep <= 3}', 'disabled={(tutorialStep >= 1 && tutorialStep <= 3) || (balance.hintFree + balance.hintCredits === 0 && !adsAvailable())}')
        source = replace(source, 'disabled={!canUndo && balance.undoFree + balance.undoCredits > 0}', 'disabled={(!canUndo && balance.undoFree + balance.undoCredits > 0) || (balance.undoFree + balance.undoCredits === 0 && !adsAvailable())}')
        source = source.replaceAll('Please check browser storage.', 'Please try again later.')
      }
      return { code: source, map: null }
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'playgama-bridge-config.json', source: JSON.stringify({ advertisement: { interstitial: { placements: [{ id: 'bunoku_break' }] }, rewarded: { placements: [{ id: 'bunoku_help' }] } } }) })
      this.emitFile({ type: 'asset', fileName: 'playgama-bridge.LICENSE.txt', source: readFileSync(resolve(root, 'node_modules/@playgama/bridge/LICENSE')) })
    },
    configureServer(server) {
      server.middlewares.use('/playgama-bridge-config.json', (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{}') })
    },
  }
}
