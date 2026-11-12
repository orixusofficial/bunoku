import { useRef, useState } from 'react'
import GameScreen from './components/GameScreen'
import HowToPlay from './components/HowToPlay'
import MainMenu from './components/MainMenu'
import './App.css'
import { playSound } from './audio'
import type { PuzzleDefinition } from './game/puzzle'
import { createPuzzleAsync } from './game/puzzleClient'

type Screen = 'menu' | 'game' | 'daily' | 'daily-game' | 'daily-error' | 'tutorial'

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [soundOn, setSoundOn] = useState(true)
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
    if (entrySound && soundOn) playSound('entery')
    try {
      if (!normalPuzzle) setNormalPuzzle(await createPuzzleAsync(4, 1, false))
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
      {screen === 'menu' && <MainMenu soundOn={soundOn} onToggleSound={() => setSoundOn((on) => !on)} onPlay={() => { void startNormal(true) }} onDaily={startDaily} onTutorial={() => setScreen('tutorial')} onSettings={() => setSettingsOpen(true)} />}
      {normalPuzzle && <div className="game-view" hidden={screen !== 'game'}><GameScreen soundOn={soundOn} onToggleSound={() => setSoundOn((on) => !on)} onMenu={() => setScreen('menu')} initialPuzzle={normalPuzzle} /></div>}
      {screen === 'daily-game' && dailyPuzzle && <GameScreen soundOn={soundOn} onToggleSound={() => setSoundOn((on) => !on)} onMenu={() => setScreen('menu')} daily initialPuzzle={dailyPuzzle} />}
      {screen === 'daily-error' && <main className="simple-screen"><AppHeader soundOn={soundOn} onToggleSound={() => setSoundOn((on) => !on)} /><section className="placeholder-card"><h1>{errorIsDaily ? 'Daily Puzzle' : 'Bunoku'}</h1><p>{dailyError || 'We couldn’t prepare the puzzle. Please try again.'}</p><button className="pill-button primary-button" onClick={() => { if (errorIsDaily) void startDaily(); else void startNormal() }}>Try Again</button><button className="text-button" onClick={() => setScreen('menu')}>Back to Menu</button></section></main>}
      {screen === 'tutorial' && <HowToPlay soundOn={soundOn} onToggleSound={() => setSoundOn((on) => !on)} onPlay={() => { void startNormal() }} onBack={() => setScreen('menu')} />}
      {screen === 'daily' && <DailyPlaceholder soundOn={soundOn} onToggleSound={() => setSoundOn((on) => !on)} onBack={() => setScreen('menu')} onPlay={() => setScreen('daily-game')} />}
      {settingsOpen && <SettingsDialog soundOn={soundOn} onToggleSound={() => setSoundOn((on) => !on)} onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

function DailyPlaceholder({ soundOn, onToggleSound, onBack, onPlay }: { soundOn: boolean; onToggleSound: () => void; onBack: () => void; onPlay: () => void }) {
  return (
    <main className="simple-screen">
      <AppHeader soundOn={soundOn} onToggleSound={onToggleSound} />
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

function AppHeader({ soundOn, onToggleSound }: { soundOn: boolean; onToggleSound: () => void }) {
  return <header className="menu-header"><a className="menu-brand" href="#menu" aria-label="Bunoku"><span className="menu-brand-mark">b</span>bunoku</a><SoundControl soundOn={soundOn} onToggle={onToggleSound} /></header>
}

function SoundControl({ soundOn, onToggle }: { soundOn: boolean; onToggle: () => void }) {
  return <button className="sound-toggle" type="button" aria-pressed={soundOn} onClick={onToggle} aria-label={`Sound ${soundOn ? 'on' : 'off'}`}><SoundGlyph muted={!soundOn} /><span>Sound {soundOn ? 'on' : 'off'}</span></button>
}

function SoundGlyph({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z" />{muted ? <path d="m17 9 5 6m0-6-5 6" /> : <><path d="M16 9a5 5 0 0 1 0 6" /><path d="M18.5 6.5a9 9 0 0 1 0 11" /></>}</svg>
}

function SettingsDialog({ soundOn, onToggleSound, onClose }: { soundOn: boolean; onToggleSound: () => void; onClose: () => void }) {
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button className="dialog-close" onClick={onClose} aria-label="Close settings">×</button><p className="screen-kicker">MAKE YOURSELF AT HOME</p><h2 id="settings-title">Settings</h2><button className="setting-row" onClick={onToggleSound} aria-pressed={soundOn}><span>Sound</span><span className={`switch ${soundOn ? 'is-on' : ''}`}><span /></span><span className="setting-state">{soundOn ? 'On' : 'Off'}</span></button><button className="pill-button primary-button settings-done" onClick={onClose}>Done</button></section></div>
}

export default App
