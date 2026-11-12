import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { attemptPlacement, createInitialState, findHint, isComplete } from '../game/puzzle'
import type { BoardState, CellState, PuzzleDefinition } from '../game/puzzle'
import { createNormalPuzzleAsync, createPuzzleAsync } from '../game/puzzleClient'
import { saveNormalLevel } from '../game/levels'
import { playSound } from '../audio'
import AudioQuickControls from './AudioQuickControls'

function Header({ musicOn, soundEffectsOn, onToggleMusic, onToggleSoundEffects, onMenu }: { musicOn: boolean; soundEffectsOn: boolean; onToggleMusic: () => void; onToggleSoundEffects: () => void; onMenu: () => void }) {
  return <header className="topbar"><div className="game-header-brand"><a className="brand" href="#game" aria-label="Bunoku"><span className="brand-mark">b</span><span>bunoku</span></a><button type="button" className="main-menu-button" onClick={onMenu}><HomeIcon /><span>Main Menu</span></button></div><AudioQuickControls musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={onToggleMusic} onToggleSoundEffects={onToggleSoundEffects}/></header>
}
function HomeIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1V10Z" /></svg> }

function LevelInfo({ level, rabbitCount, cells, lives, daily }: { level: number; rabbitCount: number; cells: CellState[]; lives: number; daily: boolean }) {
  const placed = cells.filter((cell) => cell === 'rabbit' || cell === 'given' || cell === 'hint').length
  return <section className="level-pill" aria-label={`${daily ? 'Daily puzzle' : `Level ${level}`}, ${placed} of ${rabbitCount} rabbits placed, ${lives} lives`}><img className="level-bunny" src="/bunny/bunny.svg" alt=""/><div className="level-copy"><span className="eyebrow">{daily ? 'DAILY PUZZLE' : `LEVEL ${String(level).padStart(2, '0')}`}</span><span className="placement-count">{placed}<span className="count-divider">/</span>{rabbitCount} <span className="placed-label">rabbits</span></span></div><div className="lives" aria-label={`${lives} lives remaining`}>{[0, 1, 2].map((life) => { const eaten = life < 3 - lives; return <img className={`life-carrot${eaten ? ' is-eaten' : ''}`} key={life} src={eaten ? '/bunny/carrot-life-eaten.svg' : '/bunny/carrot-life.svg'} alt=""/> })}</div></section>
}

type FailedCellAnimation = { id: number; index: number }
type Celebration = { id: number; index: number; text: string }

function PuzzleBoard({ puzzle, cells, onPointerStart, onPointerEnter, onPointerMove, onPointerEnd, onDoubleClick, hintCell, failures, celebrations, onCelebrationEnd }: { puzzle: PuzzleDefinition; cells: CellState[]; onPointerStart: (index: number, event: ReactPointerEvent<HTMLButtonElement>) => void; onPointerEnter: (index: number) => void; onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void; onPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void; onDoubleClick: (index: number) => void; hintCell: number | null; failures: FailedCellAnimation[]; celebrations: Celebration[]; onCelebrationEnd: (id: number) => void }) {
  const size = puzzle.size
  return <div className="board" role="grid" aria-label={`${size} by ${size} puzzle board`} style={{ '--board-size': size } as CSSProperties} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onPointerLeave={(event) => { if (event.buttons === 0) onPointerEnd(event) }}>{cells.map((cell, index) => {
    const row = Math.floor(index / size)
    const region = puzzle.regions[index]
    const active = region === puzzle.startRegion
    const failed = failures.some((failure) => failure.index === index)
    const marked = !failed && cell === 'mark'
    return <button key={index} type="button" role="gridcell" data-cell-index={index} data-region-id={region} className={`cell region-${region} ${active ? 'region-start' : ''} ${cell !== 'empty' ? `cell-${cell}` : ''} ${hintCell === index ? 'hint-target' : ''}`} style={{ '--region-color': puzzle.regionColors[region] } as CSSProperties} aria-label={`Row ${row + 1}, column ${index % size + 1}${puzzle.given === index ? ', given rabbit' : failed ? ', failed' : cell === 'mark' ? ', marked' : cell === 'rabbit' || cell === 'hint' || cell === 'given' ? ', rabbit' : ''}`} onPointerDown={(event) => onPointerStart(index, event)} onPointerEnter={() => onPointerEnter(index)} onDoubleClick={() => onDoubleClick(index)} disabled={puzzle.given === index || cell === 'given' || failed}>{cell === 'rabbit' || cell === 'given' || cell === 'hint' ? <img src="/bunny/bunny.svg" alt=""/> : marked ? <span className="cell-x">×</span> : null}{failures.filter((failure) => failure.index === index).map((failure) => <span className="failed-cell-bite" key={failure.id} aria-hidden="true"><img className="bite-whole" src="/bunny/carrot.svg" alt=""/><img className="bite-eaten" src="/bunny/carrot-life-eaten.svg" alt=""/></span>)}{celebrations.filter((celebration) => celebration.index === index).map((celebration) => <span className="bunny-celebration" key={celebration.id} onAnimationEnd={() => onCelebrationEnd(celebration.id)}>{celebration.text}</span>)}</button>
  })}</div>
}

function ControlIcon({ name }: { name: 'hint' | 'undo' | 'restart' }) {
  if (name === 'hint') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6m-5 3h4m-2-20a7 7 0 0 0-4 12.75c.6.42 1 1 1 1.75h6c0-.75.4-1.33 1-1.75A7 7 0 0 0 12 1Z"/></svg>
  if (name === 'undo') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 1-2.35-5.65L20 7"/><path d="M20 3v4h-4"/></svg>
}
function BottomControls({ onHint, onUndo, onRestart, canUndo }: { onHint: () => void; onUndo: () => void; onRestart: () => void; canUndo: boolean }) {
  return <nav className="controls" aria-label="Puzzle controls"><button className="control-button" onClick={onHint}><ControlIcon name="hint"/><span>Hint</span></button><button className="control-button" onClick={onUndo} disabled={!canUndo}><ControlIcon name="undo"/><span>Undo</span></button><button className="control-button" onClick={onRestart}><ControlIcon name="restart"/><span>Restart</span></button></nav>
}

export default function GameScreen({ musicOn, soundEffectsOn, onToggleMusic, onToggleSoundEffects, onMenu, daily = false, initialPuzzle }: { musicOn: boolean; soundEffectsOn: boolean; onToggleMusic: () => void; onToggleSoundEffects: () => void; onMenu: () => void; daily?: boolean; initialPuzzle: PuzzleDefinition }) {
  const [puzzle, setPuzzle] = useState(initialPuzzle)
  const [board, setBoard] = useState<BoardState>(() => createInitialState(puzzle))
  const [history, setHistory] = useState<BoardState[]>([])
  const [failureHistory, setFailureHistory] = useState<FailedCellAnimation[][]>([])
  const [notice, setNotice] = useState('')
  const [hintCell, setHintCell] = useState<number | null>(null)
  const [usedHints, setUsedHints] = useState<number[]>([])
  const [failures, setFailures] = useState<FailedCellAnimation[]>([])
  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  const celebrationId = useRef(0)
  const combo = useRef(0)
  const drawing = useRef<{ pointerId: number; visited: Set<number>; touch: boolean; index: number; x: number; y: number; dragged: boolean } | null>(null)
  const lastTouchTap = useRef<{ index: number; time: number } | null>(null)
  const touchInput = useRef(false)
  const failureId = useRef(0)
  const failureTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const failureAudios = useRef<Set<HTMLAudioElement>>(new Set())
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [endScreenReady, setEndScreenReady] = useState(false)
  const [preparingPuzzle, setPreparingPuzzle] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const generationAbort = useRef<AbortController | null>(null)
  const level = puzzle.level
  const completed = isComplete(puzzle, board.cells)
  const gameOver = board.lives === 0

  useEffect(() => () => {
    failureTimers.current.forEach(clearTimeout)
    failureAudios.current.forEach((audio) => { audio.pause(); audio.src = '' })
    if (endTimer.current) clearTimeout(endTimer.current)
    generationAbort.current?.abort()
  }, [])

  const triggerFailureFeedback = (index: number) => {
    if (failures.some((failure) => failure.index === index)) return
    const id = ++failureId.current
    setFailures((current) => [...current, { id, index }])
    combo.current = 0
    const audio = playSound('failbite')
    failureAudios.current.add(audio)
    const releaseAudio = () => failureAudios.current.delete(audio)
    audio.addEventListener('ended', releaseAudio, { once: true })
    audio.addEventListener('error', releaseAudio, { once: true })
    void audio.play().catch(releaseAudio)
  }

  const commit = (next: BoardState) => { setHistory((items) => [...items, board]); setFailureHistory((items) => [...items, [...failures]]); setBoard(next); setHintCell(null); setNotice('') }
  const placeRabbit = (index: number) => {
    if (endTimer.current) return
    if (failures.some((failure) => failure.index === index)) return
    if (board.cells[index] === 'given' || board.cells[index] === 'rabbit' || board.cells[index] === 'hint' || gameOver || completed) return
    const result = attemptPlacement(puzzle, board, index)
    if (!result.accepted) {
      if (!result.mistake) return
      triggerFailureFeedback(index)
      const cells = [...result.state.cells]
      cells[index] = 'empty'
      commit({ ...result.state, cells })
      if (result.state.lives === 0 && !endTimer.current) { playSound('fail'); endTimer.current = setTimeout(() => { endTimer.current = null; setEndScreenReady(true) }, 500) }
      setNotice(result.state.lives === 0 ? 'Oh no, out of carrots!' : 'That rabbit is not part of this puzzle solution.')
      return
    }
    const sequence = ['nice', 'wow', 'excellent', 'unrealistic'] as const
    const found = playSound('foundbunny')
    const voice = sequence[combo.current % sequence.length]
    const labels = { nice: 'NICE! ✨', wow: 'WOW! ✨', excellent: 'EXCELLENT! ✨', unrealistic: 'UNREALISTIC! ✨' } as const
    const celebration = { id: ++celebrationId.current, index, text: labels[voice] }
    setCelebrations((items) => [...items, celebration])
    combo.current += 1
    let played = false
    const playVoice = () => { if (played) return; played = true; void playSound(voice) }
    found.addEventListener('ended', playVoice, { once: true })
    found.addEventListener('error', playVoice, { once: true })
    if (isComplete(puzzle, result.state.cells) && !endTimer.current) { playSound('win'); endTimer.current = setTimeout(() => { endTimer.current = null; setEndScreenReady(true) }, 500); if (!daily) saveNormalLevel(level + 1) }
    commit(result.state)
  }
  const markCell = (index: number, drawingAcross = false) => {
    if (endTimer.current) return
    if (failures.some((failure) => failure.index === index)) return
    if (gameOver || completed || board.cells[index] === 'given' || board.cells[index] === 'rabbit' || board.cells[index] === 'hint') return
    if (drawingAcross && board.cells[index] !== 'empty') return
    const cells = [...board.cells]
    const removing = cells[index] === 'mark'
    cells[index] = cells[index] === 'mark' ? 'empty' : 'mark'
    playSound(removing ? 'Xoff' : 'Xon')
    commit({ cells, lives: board.lives })
  }
  const onPointerStart = (index: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    if (endTimer.current) return
    touchInput.current = event.pointerType === 'touch'
    drawing.current = { pointerId: event.pointerId, visited: new Set([index]), touch: touchInput.current, index, x: event.clientX, y: event.clientY, dragged: false }
    markCell(index)
  }
  const onPointerEnter = (index: number) => {
    if (!drawing.current || drawing.current.visited.has(index)) return
    drawing.current.dragged = true
    lastTouchTap.current = null
    drawing.current.visited.add(index)
    markCell(index, true)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawing.current || drawing.current.pointerId !== event.pointerId) return
    if (drawing.current.touch && Math.hypot(event.clientX - drawing.current.x, event.clientY - drawing.current.y) > 8) {
      drawing.current.dragged = true
      lastTouchTap.current = null
    }
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-cell-index]')
    const index = cell?.dataset.cellIndex
    if (index !== undefined) onPointerEnter(Number(index))
  }
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = drawing.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    drawing.current = null
    if (!gesture.touch) return
    if (event.type !== 'pointerup' || gesture.dragged) { lastTouchTap.current = null; return }
    const previous = lastTouchTap.current
    // Recognize completed taps, never pointer-downs that may become drags.
    // This window classifies taps; single-tap marking is still immediate.
    if (previous?.index === gesture.index && event.timeStamp - previous.time <= 300) {
      lastTouchTap.current = null
      placeRabbit(gesture.index)
    } else lastTouchTap.current = { index: gesture.index, time: event.timeStamp }
  }
  const onHint = () => {
    if (gameOver || completed || endTimer.current) return
    const index = findHint(puzzle, board.cells, usedHints)
    if (index === null) { setNotice('No safe next move is available. Try undoing a rabbit.'); return }
    setUsedHints((items) => [...items, index])
    setHintCell(index)
    setNotice('A safe rabbit spot is highlighted!')
  }
  const onUndo = () => {
    if (endTimer.current) return
    if (!history.length) return
    setBoard(history[history.length - 1])
    setHistory((items) => items.slice(0, -1))
    setFailures(failureHistory[failureHistory.length - 1] ?? [])
    setFailureHistory((items) => items.slice(0, -1))
    setHintCell(null)
    setNotice('Undone.')
  }
  const onRestart = () => {
    if (endTimer.current) return
    if (!window.confirm('Restart this puzzle? Your rabbits and marks will be cleared.')) return
    setBoard(createInitialState(puzzle)); setHistory([]); setFailureHistory([]); setHintCell(null); setUsedHints([]); setNotice(''); setFailures([]); drawing.current = null
  }
  const startOver = () => { if (endTimer.current) clearTimeout(endTimer.current); endTimer.current = null; setEndScreenReady(false); setBoard(createInitialState(puzzle)); setHistory([]); setFailureHistory([]); setHintCell(null); setUsedHints([]); setNotice(''); setFailures([]) }
  const nextPuzzle = async () => {
    if (generationAbort.current) return
    const controller = new AbortController()
    generationAbort.current = controller
    setPreparingPuzzle(true); setGenerationError('')
    try {
      const next = daily ? await createPuzzleAsync(9, 0, true, controller.signal) : await createNormalPuzzleAsync(level + 1, controller.signal)
      if (controller.signal.aborted) return
      if (!daily) saveNormalLevel(next.level)
      setEndScreenReady(false); setPuzzle(next); setBoard(createInitialState(next)); setHistory([]); setFailureHistory([]); setHintCell(null); setUsedHints([]); setNotice(''); setFailures([]); setCelebrations([])
    } catch (error) {
      if (!controller.signal.aborted) setGenerationError(error instanceof Error ? error.message : 'Please try preparing the next puzzle again.')
    } finally {
      if (!controller.signal.aborted) { generationAbort.current = null; setPreparingPuzzle(false) }
    }
  }

  return <main className="game-shell" id="game"><Header musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={onToggleMusic} onToggleSoundEffects={onToggleSoundEffects} onMenu={onMenu}/><div className={`game-content${(gameOver || completed) && endScreenReady ? ' game-ended' : ''}`}><LevelInfo level={level} rabbitCount={puzzle.rabbitCount} cells={board.cells} lives={board.lives} daily={daily}/>{gameOver && endScreenReady ? <section className="game-result"><div className="out-of-carrots-art" aria-hidden="true">{[0, 1, 2].map((carrot) => <img src="/bunny/carrot-life-eaten.svg" alt="" key={carrot}/>)}</div><h1>Out of Carrots</h1><p>Take a breath and give this puzzle another try.</p><p>Oh no, out of carrots!</p><button className="pill-button primary-button" onClick={startOver}>Restart</button><button className="text-button" onClick={onMenu}>Main Menu</button></section> : completed && endScreenReady ? <section className="game-result"><img src="/bunny/bunny.svg" alt=""/><h1>Puzzle Complete!</h1><p>You solved the Bunoku puzzle with {board.lives} carrots left.</p><button className="pill-button primary-button" onClick={nextPuzzle} disabled={preparingPuzzle}>Next!</button>{generationError && <p role="alert">{generationError}</p>}<button className="text-button" onClick={onMenu}>Main Menu</button></section> : <><PuzzleBoard puzzle={puzzle} cells={board.cells} onPointerStart={onPointerStart} onPointerEnter={onPointerEnter} onPointerMove={onPointerMove} onPointerEnd={onPointerEnd} onDoubleClick={(index) => { if (!touchInput.current) placeRabbit(index) }} hintCell={hintCell} failures={failures} celebrations={celebrations} onCelebrationEnd={(id) => setCelebrations((items) => items.filter((item) => item.id !== id))}/><div className="game-feedback" aria-live="polite">{notice || (board.cells.every((cell) => cell !== 'rabbit' && cell !== 'given' && cell !== 'hint') ? <span className="starting-color">Start with this color <span className="starting-color-swatch" style={{ backgroundColor: puzzle.regionColors[puzzle.startRegion] }} aria-label="Outlined starting region" /></span> : '')}</div><BottomControls onHint={onHint} onUndo={onUndo} onRestart={onRestart} canUndo={history.length > 0}/></>}</div></main>
}
