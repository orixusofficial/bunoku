import { useEffect, useRef, useState } from 'react'
import GameScreen from './components/GameScreen'
import HowToPlay from './components/HowToPlay'
import MainMenu from './components/MainMenu'
import './App.css'
import { initializeAudio, playSound, setMusicEnabled, setSoundEffectsEnabled } from './audio'
import type { PuzzleDefinition } from './game/puzzle'
import { createNormalPuzzleAsync, createPuzzleAsync } from './game/puzzleClient'
import { loadNormalLevel } from './game/levels'

type Screen = 'menu' | 'game' | 'daily' | 'daily-game' | 'daily-error' | 'tutorial'

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [soundEffectsOn, setSoundEffectsOn] = useState(false)
  const [musicOn, setMusicOn] = useState(false)
  useEffect(() => initializeAudio(), [])
  useEffect(() => { setSoundEffectsEnabled(soundEffectsOn) }, [soundEffectsOn])
  useEffect(() => { setMusicEnabled(musicOn) }, [musicOn])
  const toggleEffects = () => { const enabled = !soundEffectsOn; setSoundEffectsEnabled(enabled); setSoundEffectsOn(enabled) }
  const toggleMusic = () => { const enabled = !musicOn; setMusicEnabled(enabled); setMusicOn(enabled) }
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dailyPuzzle, setDailyPuzzle] = useState<PuzzleDefinition | null>(null)
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
      if (!normalPuzzle) setNormalPuzzle(await createNormalPuzzleAsync(loadNormalLevel()))
      setScreen('game')
    } catch (error) {
      setErrorIsDaily(false)
      setDailyError(error instanceof Error ? error.message : 'Please try opening the puzzle again.')
      setScreen('daily-error')
    } finally { normalStarting.current = false }
  }
  const startDaily = async () => {
    if (dailyStarting.current) return
    dailyStarting.current = true
    try {
      setDailyPuzzle(await createPuzzleAsync(9, 0, true))
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
      {screen === 'menu' && <MainMenu soundOn={soundEffectsOn} onToggleSound={toggleEffects} onPlay={() => { void startNormal(true) }} onDaily={startDaily} onTutorial={() => setScreen('tutorial')} onSettings={() => setSettingsOpen(true)} />}
      {normalPuzzle && <div className="game-view" hidden={screen !== 'game'}><GameScreen onSettings={() => setSettingsOpen(true)} onMenu={() => setScreen('menu')} initialPuzzle={normalPuzzle} /></div>}
      {screen === 'daily-game' && dailyPuzzle && <GameScreen onSettings={() => setSettingsOpen(true)} onMenu={() => setScreen('menu')} daily initialPuzzle={dailyPuzzle} />}
      {screen === 'daily-error' && <main className="simple-screen"><AppHeader onSettings={() => setSettingsOpen(true)} /><section className="placeholder-card"><h1>{errorIsDaily ? 'Daily Puzzle' : 'Bunoku'}</h1><p>{dailyError || 'We couldn’t prepare the puzzle. Please try again.'}</p><button className="pill-button primary-button" onClick={() => { if (errorIsDaily) void startDaily(); else void startNormal() }}>Try Again</button><button className="text-button" onClick={() => setScreen('menu')}>Back to Menu</button></section></main>}
      {screen === 'tutorial' && <HowToPlay soundOn={soundEffectsOn} onToggleSound={toggleEffects} onPlay={() => { void startNormal() }} onBack={() => setScreen('menu')} />}
      {screen === 'daily' && <DailyPlaceholder onSettings={() => setSettingsOpen(true)} onBack={() => setScreen('menu')} onPlay={() => setScreen('daily-game')} />}
      {settingsOpen && <SettingsDialog effectsOn={soundEffectsOn} musicOn={musicOn} onToggleEffects={toggleEffects} onToggleMusic={toggleMusic} onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

function DailyPlaceholder({ onSettings, onBack, onPlay }: { onSettings: () => void; onBack: () => void; onPlay: () => void }) {
  return (
    <main className="simple-screen">
      <AppHeader onSettings={onSettings} />
      <section className="placeholder-card">
        <div className="placeholder-art" aria-hidden="true">🥕</div>
        <p className="screen-kicker">A LITTLE SOMETHING SPECIAL</p>
        <h1>Daily Puzzle</h1>
        <p>Today’s puzzle is still being tucked into its burrow.</p>
        <button className="pill-button primary-button" onClick={onPlay}>Play a puzzle</button>
        <button className="text-button" onClick={onBack}>Back to Menu</button>
      </section>
    </main>
  )
}

function AppHeader({ onSettings }: { onSettings: () => void }) {
  return <header className="menu-header"><a className="menu-brand" href="#menu" aria-label="Bunoku"><span className="menu-brand-mark">b</span>bunoku</a><button className="settings-trigger" onClick={onSettings}>Settings</button></header>
}

function SettingsDialog({ effectsOn, musicOn, onToggleEffects, onToggleMusic, onClose }: { effectsOn: boolean; musicOn: boolean; onToggleEffects: () => void; onToggleMusic: () => void; onClose: () => void }) {
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button className="dialog-close" onClick={onClose} aria-label="Close settings">×</button><p className="screen-kicker">MAKE YOURSELF AT HOME</p><h2 id="settings-title">Settings</h2><button className="setting-row" onClick={onToggleEffects} aria-pressed={effectsOn}><span>Sound Effects</span><span className={`switch ${effectsOn ? 'is-on' : ''}`}><span /></span><span className="setting-state">{effectsOn ? 'On' : 'Off'}</span></button><button className="setting-row" onClick={onToggleMusic} aria-pressed={musicOn}><span>Music</span><span className={`switch ${musicOn ? 'is-on' : ''}`}><span /></span><span className="setting-state">{musicOn ? 'On' : 'Off'}</span></button><button className="pill-button primary-button settings-done" onClick={onClose}>Done</button></section></div>
}

export default App
