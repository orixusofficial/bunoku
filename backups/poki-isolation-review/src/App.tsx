import { initialDailyProgress } from './game/dailyState.ts'
import type { DailyProgress } from './game/dailyState.ts'
import { allowances } from './game/allowances.ts'
import { t, useLanguage, setLanguage, languages, translatedError } from './i18n'
import { useEffect, useRef, useState } from 'react'
import GameScreen from './components/GameScreen'
import HowToPlay from './components/HowToPlay'
import MainMenu from './components/MainMenu'
import AudioQuickControls from './components/AudioQuickControls'
import PrivacyPolicy from './components/PrivacyPolicy'
import './App.css'
import { initializeAudio, playSound, setMusicEnabled, setSoundEffectsEnabled } from './audio'
import type { PuzzleDefinition } from './game/puzzle'
import { createNormalPuzzleAsync, createPuzzleAsync } from './game/puzzleClient'
import { loadNormalLevel } from './game/levels'
import { gameStorage } from './playgama/storage.ts'
import { showInterstitialAtBreak } from './playgama/platform.ts'

type Screen = 'menu' | 'game' | 'daily' | 'daily-game' | 'daily-error' | 'tutorial'
const MUSIC_PREF = 'bunoku.musicEnabled'
const EFFECTS_PREF = 'bunoku.soundEffectsEnabled'
function loadAudioPreference(key: string, fallback: boolean) {
  try { const value = ((globalThis.BUNOKU_PLAYGAMA || globalThis.BUNOKU_GAMEDISTRIBUTION || globalThis.BUNOKU_POKI) ? gameStorage : localStorage).getItem(key); return value === null ? fallback : value === 'true' } catch { return fallback }
}
function saveAudioPreference(key: string, enabled: boolean) {
  try { ((globalThis.BUNOKU_PLAYGAMA || globalThis.BUNOKU_GAMEDISTRIBUTION || globalThis.BUNOKU_POKI) ? gameStorage : localStorage).setItem(key, String(enabled)) } catch { /* Preferences remain active for this app session. */ }
}

function App() {
  const language = useLanguage()
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr' }, [language])
  const [screen, setScreen] = useState<Screen>('menu')
  const [soundEffectsOn, setSoundEffectsOn] = useState(() => loadAudioPreference(EFFECTS_PREF, true))
  const [musicOn, setMusicOn] = useState(() => loadAudioPreference(MUSIC_PREF, false))
  useEffect(() => initializeAudio(), [])
  useEffect(() => { setSoundEffectsEnabled(soundEffectsOn) }, [soundEffectsOn])
  useEffect(() => { setMusicEnabled(musicOn) }, [musicOn])
  const toggleEffects = () => { const enabled = !soundEffectsOn; saveAudioPreference(EFFECTS_PREF, enabled); setSoundEffectsEnabled(enabled); setSoundEffectsOn(enabled) }
  const toggleMusic = () => { const enabled = !musicOn; saveAudioPreference(MUSIC_PREF, enabled); setMusicEnabled(enabled); setMusicOn(enabled) }
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dailyPuzzle, setDailyPuzzle] = useState<PuzzleDefinition | null>(null)
  const [dailyResume, setDailyResume] = useState<DailyProgress | null>(null)
  const [normalPuzzle, setNormalPuzzle] = useState<PuzzleDefinition | null>(null)
  const [errorIsDaily, setErrorIsDaily] = useState(true)
  const [dailyError, setDailyError] = useState('')
  const dailyStarting = useRef(false)
  const normalStarting = useRef(false)
  const startNormal = async (entrySound = false) => {
    if (normalStarting.current) return
    normalStarting.current = true
    if (entrySound && soundEffectsOn) playSound('entery')
    try {
      if (globalThis.BUNOKU_GAMEDISTRIBUTION || globalThis.BUNOKU_POKI) await showInterstitialAtBreak()
      if (!normalPuzzle) setNormalPuzzle(await createNormalPuzzleAsync(loadNormalLevel()))
      setScreen('game')
    } catch (error) {
      setErrorIsDaily(false)
      setDailyError(error instanceof Error ? error.message : 'Please try opening the puzzle again.')
      setScreen('daily-error')
    } finally { normalStarting.current = false }
  }
  const startDaily = async () => {
    const saved = allowances.dailyAttempt()
    if (saved && !saved.finished) { if (globalThis.BUNOKU_GAMEDISTRIBUTION || globalThis.BUNOKU_POKI) { if (dailyStarting.current) return; dailyStarting.current = true; try { await showInterstitialAtBreak() } finally { dailyStarting.current = false } } setDailyResume(saved); setDailyPuzzle(saved.puzzle); setScreen('daily-game'); return }
    if (dailyStarting.current || loadNormalLevel() < 11 || !allowances.status().available || allowances.status().dailyRemaining > 0) return
    dailyStarting.current = true
    try {
      if (globalThis.BUNOKU_GAMEDISTRIBUTION || globalThis.BUNOKU_POKI) await showInterstitialAtBreak()
      const next = await createPuzzleAsync(9, 0, true)
      const claim = () => allowances.startDaily(loadNormalLevel() - 1, initialDailyProgress(next))
      const claimed = navigator.locks ? await navigator.locks.request('bunoku.daily-start', claim) : claim()
      if (!claimed) { setErrorIsDaily(true); setDailyError('Daily Puzzle is unavailable. Please return to the menu.'); setScreen('daily-error'); return }
      if (soundEffectsOn) playSound('entery')
      setDailyResume(allowances.dailyAttempt())
      setDailyPuzzle(next)
      setDailyError('')
      setScreen('daily-game')
    } catch (error) {
      setErrorIsDaily(true)
      setDailyError(error instanceof Error ? error.message : 'Please try opening the Daily Puzzle again.')
      setScreen('daily-error')
    } finally {
      dailyStarting.current = false
    }
  }

  return (
    <>
      {screen === 'menu' && <MainMenu musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={toggleMusic} onToggleSoundEffects={toggleEffects} onPlay={() => { void startNormal(true) }} onDaily={startDaily} onTutorial={() => setScreen('tutorial')} onSettings={() => setSettingsOpen(true)} />}
      {normalPuzzle && <div className="game-view" hidden={screen !== 'game'}><GameScreen active={screen === 'game' && !settingsOpen} musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={toggleMusic} onToggleSoundEffects={toggleEffects} onMenu={(globalThis.BUNOKU_PLAYGAMA || globalThis.BUNOKU_GAMEDISTRIBUTION) ? () => { setScreen('menu'); void showInterstitialAtBreak() } : () => setScreen('menu')} initialPuzzle={normalPuzzle} /></div>}
      {dailyPuzzle && screen === 'daily-game' && <div className="game-view" hidden={screen !== 'daily-game'}><GameScreen active={screen === 'daily-game' && !settingsOpen} musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={toggleMusic} onToggleSoundEffects={toggleEffects} onMenu={(globalThis.BUNOKU_PLAYGAMA || globalThis.BUNOKU_GAMEDISTRIBUTION) ? () => { setScreen('menu'); void showInterstitialAtBreak() } : () => setScreen('menu')} daily initialDailyProgress={dailyResume} initialPuzzle={dailyPuzzle} /></div>}
      {screen === 'daily-error' && <main className="simple-screen"><AppHeader musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={toggleMusic} onToggleSoundEffects={toggleEffects} onSettings={() => setSettingsOpen(true)} /><section className="placeholder-card"><h1>{errorIsDaily ? 'Daily Puzzle' : 'Bunoku'}</h1><p>{translatedError(dailyError)}</p><button className="pill-button primary-button" onClick={() => { if (errorIsDaily) void startDaily(); else void startNormal() }}>{t("Try Again")}</button><button className="text-button" onClick={() => setScreen('menu')}>{t("Back to Menu")}</button></section></main>}
      {screen === 'tutorial' && <HowToPlay musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={toggleMusic} onToggleSoundEffects={toggleEffects} onPlay={() => { void startNormal() }} onBack={() => setScreen('menu')} />}
      {screen === 'daily' && <DailyPlaceholder musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={toggleMusic} onToggleSoundEffects={toggleEffects} onSettings={() => setSettingsOpen(true)} onBack={() => setScreen('menu')} onPlay={() => setScreen('daily-game')} />}
      {settingsOpen && <SettingsDialog effectsOn={soundEffectsOn} musicOn={musicOn} onToggleEffects={toggleEffects} onToggleMusic={toggleMusic} onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

function DailyPlaceholder({ musicOn, soundEffectsOn, onToggleMusic, onToggleSoundEffects, onSettings, onBack, onPlay }: { musicOn: boolean; soundEffectsOn: boolean; onToggleMusic: () => void; onToggleSoundEffects: () => void; onSettings: () => void; onBack: () => void; onPlay: () => void }) {
  return (
    <main className="simple-screen">
      <AppHeader musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={onToggleMusic} onToggleSoundEffects={onToggleSoundEffects} onSettings={onSettings} />
      <section className="placeholder-card">
        <div className="placeholder-art" aria-hidden="true">🥕</div>
        <p className="screen-kicker">{t("A LITTLE SOMETHING SPECIAL")}</p>
        <h1>{t("Daily Puzzle")}</h1>
        <p>{t("Today’s puzzle is still being tucked into its burrow.")}</p>
        <button className="pill-button primary-button" onClick={onPlay}>{t("Play a puzzle")}</button>
        <button className="text-button" onClick={onBack}>{t("Back to Menu")}</button>
      </section>
    </main>
  )
}

function AppHeader({ musicOn, soundEffectsOn, onToggleMusic, onToggleSoundEffects, onSettings }: { musicOn: boolean; soundEffectsOn: boolean; onToggleMusic: () => void; onToggleSoundEffects: () => void; onSettings: () => void }) {
  return <header className="menu-header"><a className="menu-brand" href="#menu" aria-label="Bunoku"><span className="menu-brand-mark">b</span>bunoku</a><div className="menu-header-actions"><AudioQuickControls musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={onToggleMusic} onToggleSoundEffects={onToggleSoundEffects}/><button className="settings-trigger" onClick={onSettings}>{t("Settings")}</button></div></header>
}

function SettingsDialog({ effectsOn, musicOn, onToggleEffects, onToggleMusic, onClose }: { effectsOn: boolean; musicOn: boolean; onToggleEffects: () => void; onToggleMusic: () => void; onClose: () => void }) {
  const language = useLanguage()
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const privacyButton = useRef<HTMLButtonElement>(null)
  const closePrivacy = () => {
    setPrivacyOpen(false)
    requestAnimationFrame(() => privacyButton.current?.focus())
  }
  if (privacyOpen) return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closePrivacy() }}><PrivacyPolicy onClose={closePrivacy}/></div>
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="settings-dialog settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button className="dialog-close" onClick={onClose} aria-label={t("Close settings")}>×</button><p className="screen-kicker">{t("MAKE YOURSELF AT HOME")}</p><h2 id="settings-title">{t("Settings")}</h2><button className="setting-row" onClick={onToggleEffects} aria-pressed={effectsOn}><span>{t("Sound Effects")}</span><span className={`switch ${effectsOn ? 'is-on' : ''}`}><span /></span><span className="setting-state">{t(effectsOn ? 'On' : 'Off')}</span></button><button className="setting-row" onClick={onToggleMusic} aria-pressed={musicOn}><span>{t("Music")}</span><span className={`switch ${musicOn ? 'is-on' : ''}`}><span /></span><span className="setting-state">{t(musicOn ? 'On' : 'Off')}</span></button><label className="language-setting"><span>{t("Language")}</span><select value={language} onChange={(event) => setLanguage(event.target.value as keyof typeof languages)}>{Object.entries(languages).map(([code, name]) => <option key={code} value={code} lang={code}>{name}</option>)}</select></label><button ref={privacyButton} className="privacy-setting" onClick={() => setPrivacyOpen(true)}>{t("Privacy Policy")}<span aria-hidden="true">→</span></button><button className="pill-button primary-button settings-done" onClick={onClose}>{t("Done")}</button></section></div>
}

export default App
