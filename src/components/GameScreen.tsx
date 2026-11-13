import RewardIcon from './RewardIcon'
import type { DailyProgress } from '../game/dailyState.ts'
import { DailyCountdown } from './DailyAccess'
import { trackGameplay, confirmDuringGameplay, requestRewardedAd, logAdDiagnostic } from '../crazygames.ts'
import { allowances } from '../game/allowances.ts'
import { useAllowances } from '../useAllowances'
import { assetUrl } from '../assetUrl.ts'
import MainMenuConfirmation from './MainMenuConfirmation'
import { t, translatedError } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { attemptPlacement, createInitialState, findHint, isComplete } from '../game/puzzle'
import type { BoardState, CellState, PuzzleDefinition } from '../game/puzzle'
import { createNormalPuzzleAsync, createPuzzleAsync } from '../game/puzzleClient'
import { saveNormalLevel } from '../game/levels'
import { playSound } from '../audio'
import AudioQuickControls from './AudioQuickControls'
import { saveTutorialComplete, startingTutorialStep, tutorialBlockedCells, tutorialTarget } from '../game/tutorial'
import type { TutorialStep } from '../game/tutorial'
import { keyboardHandlers } from '../game/keyboard'

function Header({ musicOn, soundEffectsOn, onToggleMusic, onToggleSoundEffects, onMenu }: { musicOn: boolean; soundEffectsOn: boolean; onToggleMusic: () => void; onToggleSoundEffects: () => void; onMenu: () => void }) {
  return <header className="topbar"><div className="game-header-brand"><a className="brand" href="#game" aria-label="Bunoku"><span className="brand-mark">b</span><span>bunoku</span></a><button type="button" className="main-menu-button" onClick={onMenu}><HomeIcon /><span>{t("Main Menu")}</span></button></div><AudioQuickControls musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={onToggleMusic} onToggleSoundEffects={onToggleSoundEffects}/></header>
}
function HomeIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1V10Z" /></svg> }

function LevelInfo({ level, rabbitCount, cells, lives, daily }: { level: number; rabbitCount: number; cells: CellState[]; lives: number; daily: boolean }) {
  const placed = cells.filter((cell) => cell === 'rabbit' || cell === 'given' || cell === 'hint').length
  return <section className="level-pill" aria-label={t("{level}, {placed} of {total} rabbits placed, {lives} lives", { level: daily ? t("Daily puzzle") : t("Level {level}", { level }), placed, total: rabbitCount, lives })}><img className="level-bunny" src={assetUrl('bunny/bunny.svg')} alt=""/><div className="level-copy"><span className="eyebrow">{daily ? t("DAILY PUZZLE") : t("LEVEL {level}", { level: String(level).padStart(2, "0") })}</span><span className="placement-count">{placed}<span className="count-divider">/</span>{rabbitCount} <span className="placed-label">{t("rabbits")}</span></span></div><div className="lives" aria-label={t("{count} lives remaining", { count: lives })}>{[0, 1, 2].map((life) => { const eaten = life < 3 - lives; return <img className={`life-carrot${eaten ? ' is-eaten' : ''}`} key={life} src={assetUrl(eaten ? 'bunny/carrot-life-eaten.svg' : 'bunny/carrot-life.svg')} alt=""/> })}</div></section>
}

type FailedCellAnimation = { id: number; index: number }
type Celebration = { id: number; index: number; text: string }

function PuzzleBoard({ puzzle, cells, onPointerStart, onPointerEnter, onPointerMove, onPointerEnd, onDoubleClick, hintCell, failures, celebrations, onCelebrationEnd, tutorialStep = 0, keyboardSelection = null }: { puzzle: PuzzleDefinition; cells: CellState[]; onPointerStart: (index: number, event: ReactPointerEvent<HTMLButtonElement>) => void; onPointerEnter: (index: number) => void; onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void; onPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void; onDoubleClick: (index: number) => void; hintCell: number | null; failures: FailedCellAnimation[]; celebrations: Celebration[]; onCelebrationEnd: (id: number) => void; tutorialStep?: TutorialStep; keyboardSelection?: number | null }) {
  const size = puzzle.size
  return <div className="board" role="grid" aria-label={t("{size} by {size} puzzle board", { size })} style={{ '--board-size': size } as CSSProperties} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onPointerLeave={(event) => { if (event.buttons === 0) onPointerEnd(event) }}>{cells.map((cell, index) => {
    const row = Math.floor(index / size)
    const region = puzzle.regions[index]
    const active = region === puzzle.startRegion
    const failed = failures.some((failure) => failure.index === index)
    const marked = !failed && cell === 'mark'
    const tutorialClass = tutorialStep === 1 ? (index === tutorialTarget(puzzle) ? ' tutorial-target' : active ? ' tutorial-region' : ' tutorial-dim') : (tutorialStep === 2 || tutorialStep === 3) && tutorialBlockedCells(puzzle).includes(index) ? ' tutorial-blocked' : ''
    return <button key={index} type="button" role="gridcell" data-cell-index={index} data-region-id={region} className={`cell${tutorialClass}${keyboardSelection === index ? ' keyboard-selected' : ''} region-${region} ${active ? 'region-start' : ''} ${cell !== 'empty' ? `cell-${cell}` : ''} ${hintCell === index ? 'hint-target' : ''}`} style={{ '--region-color': puzzle.regionColors[region], '--reveal-delay': `${240 * index / Math.max(1, cells.length - 1)}ms` } as CSSProperties} aria-label={t("Row {row}, column {column}{state}", { row: row + 1, column: index % size + 1, state: t(puzzle.given === index ? ", given rabbit" : failed ? ", failed" : cell === "mark" ? ", marked" : cell === "rabbit" || cell === "hint" || cell === "given" ? ", rabbit" : "") })} onPointerDown={(event) => onPointerStart(index, event)} onPointerEnter={() => onPointerEnter(index)} onDoubleClick={() => onDoubleClick(index)} disabled={(tutorialStep === 1 && index !== tutorialTarget(puzzle)) || puzzle.given === index || cell === 'given' || failed}>{cell === 'rabbit' || cell === 'given' || cell === 'hint' ? <img src={assetUrl('bunny/bunny.svg')} alt=""/> : marked ? <span className="cell-x">×</span> : null}{failures.filter((failure) => failure.index === index).map((failure) => <span className="failed-cell-bite" key={failure.id} aria-hidden="true"><img className="bite-whole" src={assetUrl('bunny/carrot.svg')} alt=""/><img className="bite-eaten" src={assetUrl('bunny/carrot-life-eaten.svg')} alt=""/></span>)}{celebrations.filter((celebration) => celebration.index === index).map((celebration) => <span className="bunny-celebration" key={celebration.id} onAnimationEnd={() => onCelebrationEnd(celebration.id)}>{t(celebration.text)}</span>)}</button>
  })}</div>
}

function ControlIcon({ name }: { name: 'hint' | 'undo' | 'restart' }) {
  if (name === 'hint') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6m-5 3h4m-2-20a7 7 0 0 0-4 12.75c.6.42 1 1 1 1.75h6c0-.75.4-1.33 1-1.75A7 7 0 0 0 12 1Z"/></svg>
  if (name === 'undo') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 1-2.35-5.65L20 7"/><path d="M20 3v4h-4"/></svg>
}
function BottomControls({ onHint, onUndo, onRestart, canUndo, tutorialStep = 0, restoreKeyboardFocus }: { onHint: () => void; onUndo: () => void; onRestart: () => void; canUndo: boolean; tutorialStep?: TutorialStep; restoreKeyboardFocus: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  const balance = useAllowances()
  const count = (remaining: number, kind: string) => remaining > 0 ? <span className="control-count" aria-label={t("{count} {kind} remaining", { count: remaining, kind })}>{remaining}</span> : <RewardIcon/>
  return <nav className="controls" aria-label={t("Puzzle controls")}><button className={`control-button${tutorialStep === 4 ? ' tutorial-hint' : ''}`} onClick={(event) => { onHint(); restoreKeyboardFocus(event) }} disabled={tutorialStep >= 1 && tutorialStep <= 3}><ControlIcon name="hint"/><span>{t("Hint")}</span>{count(balance.hintFree + balance.hintCredits, t("Hints"))}</button><button className="control-button" onClick={(event) => { onUndo(); restoreKeyboardFocus(event) }} disabled={!canUndo && balance.undoFree + balance.undoCredits > 0}><ControlIcon name="undo"/><span>{t("Undo")}</span>{count(balance.undoFree + balance.undoCredits, t("Undos"))}</button><button className="control-button" onClick={(event) => { onRestart(); restoreKeyboardFocus(event) }}><ControlIcon name="restart"/><span>{t("Restart")}</span></button></nav>
}

function TutorialPrompt({ step, onSkip, onContinue }: { step: TutorialStep; onSkip: () => void; onContinue: () => void }) {
  const instructions = ['', 'Double-click this box to find the rabbit.', 'Rabbits cannot share a row or column, or touch each other.', 'Hold and drag to mark multiple boxes with X.', 'Need help? Use Hint to guide your next move.', "You're ready! Complete the puzzle."]
  return <section className="tutorial-prompt" aria-label={t('Getting started')}><p>{t(instructions[step])}</p>{step === 2 && <p className="tutorial-explanation">{t('These highlighted boxes cannot contain a rabbit. Click one to mark it with X.')}</p>}{step === 3 && <div className="tutorial-drag-demo" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} style={{ '--demo-order': i } as CSSProperties}>×</span>)}<i>→</i></div>}{step < 5 && <div className="tutorial-actions-row">{step === 4 && <button className="text-button" onClick={onContinue}>{t('Continue')}</button>}<button className="text-button" onClick={onSkip}>{t('Skip Tutorial')}</button></div>}</section>
}

export default function GameScreen({ musicOn, soundEffectsOn, onToggleMusic, onToggleSoundEffects, onMenu, daily = false, initialDailyProgress, initialPuzzle, active = true }: { musicOn: boolean; soundEffectsOn: boolean; onToggleMusic: () => void; onToggleSoundEffects: () => void; onMenu: () => void; initialDailyProgress?: DailyProgress | null; daily?: boolean; active?: boolean; initialPuzzle: PuzzleDefinition }) {
  const [puzzle, setPuzzle] = useState(initialPuzzle)
  const [board, setBoard] = useState<BoardState>(() => initialDailyProgress?.board ?? createInitialState(puzzle))
  const [history, setHistory] = useState<BoardState[]>(initialDailyProgress?.history ?? [])
  const [failureHistory, setFailureHistory] = useState<FailedCellAnimation[][]>(initialDailyProgress?.failureHistory ?? [])
  const [notice, setNotice] = useState('')
  const [hintCell, setHintCell] = useState<number | null>(initialDailyProgress?.hintCell ?? null)
  const [usedHints, setUsedHints] = useState<number[]>(initialDailyProgress?.usedHints ?? [])
  const [failures, setFailures] = useState<FailedCellAnimation[]>(initialDailyProgress?.failures ?? [])
  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  const celebrationId = useRef(0)
  const combo = useRef(initialDailyProgress?.combo ?? 0)
  const drawing = useRef<{ pointerId: number; visited: Set<number>; touch: boolean; index: number; x: number; y: number; dragged: boolean } | null>(null)
  const lastTouchTap = useRef<{ index: number; time: number } | null>(null)
  const touchInput = useRef(false)
  const failureId = useRef(Math.max(0, ...(initialDailyProgress?.failures.map(f=>f.id) ?? [])))
  const failureTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const failureAudios = useRef<Set<HTMLAudioElement>>(new Set())
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [endScreenReady, setEndScreenReady] = useState(initialDailyProgress?.finished ?? false)
  const [preparingPuzzle, setPreparingPuzzle] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const generationAbort = useRef<AbortController | null>(null)
  const level = puzzle.level
  const completed = isComplete(puzzle, board.cells)
  const gameOver = board.lives === 0
  const [tutorialProgress, setTutorialProgress] = useState<TutorialStep>(() => startingTutorialStep(initialPuzzle, daily))
  const tutorialStep: TutorialStep = !daily && puzzle.level === 1 ? tutorialProgress : 0
  const target = tutorialStep ? tutorialTarget(puzzle) : undefined
  const blockedTutorialCells = tutorialStep ? tutorialBlockedCells(puzzle) : []
  const gameRoot = useRef<HTMLElement>(null)
  const selectedCell = useRef<number | null>(null)
  const [keyboardSelection, setKeyboardSelection] = useState<number | null>(null)
  const brush = useRef({ held: false, visited: new Set<number>() })
  const [menuConfirmation, setMenuConfirmation] = useState(false)
  const rewardPending = useRef(false)
  const [rewardBusy, setRewardBusy] = useState(false)
  useEffect(() => trackGameplay(active && !completed && !gameOver && !preparingPuzzle && !menuConfirmation && !rewardBusy), [active, completed, gameOver, preparingPuzzle, menuConfirmation, rewardBusy])

  useEffect(() => {
    if (!daily || !initialDailyProgress) return
    const saved = allowances.saveDaily({ puzzle, board, history, failureHistory, failures, hintCell, usedHints, combo: combo.current, started: initialDailyProgress.started, finished: completed || gameOver })
    if (!saved && !allowances.dailyAttempt()?.finished) setNotice('Your progress could not be saved. Please check browser storage.')
  }, [daily, puzzle, board, history, failureHistory, failures, hintCell, usedHints, completed, gameOver])

  const finishTutorial = (skip = false) => { saveTutorialComplete(); setTutorialProgress(skip ? 0 : 5); lastTouchTap.current = null; drawing.current = null }

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
    if (menuConfirmation || rewardPending.current) return
    if (endTimer.current) return
    if ((tutorialStep === 1 && index !== target) || tutorialStep === 2 || tutorialStep === 3) return
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
    if (tutorialStep === 1) { setTutorialProgress(2); lastTouchTap.current = null; drawing.current = null }
    else if (tutorialStep === 4) finishTutorial()
  }
  const markCell = (index: number, drawingAcross = false) => {
    if (menuConfirmation || rewardPending.current) return
    if (endTimer.current) return
    if ((tutorialStep === 1 && index !== target) || ((tutorialStep === 2 || tutorialStep === 3) && !blockedTutorialCells.includes(index))) return
    if (failures.some((failure) => failure.index === index)) return
    if (gameOver || completed || board.cells[index] === 'given' || board.cells[index] === 'rabbit' || board.cells[index] === 'hint') return
    if (drawingAcross && board.cells[index] !== 'empty') return
    const cells = [...board.cells]
    const removing = cells[index] === 'mark'
    cells[index] = cells[index] === 'mark' ? 'empty' : 'mark'
    playSound(removing ? 'Xoff' : 'Xon')
    commit({ cells, lives: board.lives })
    if (tutorialStep === 2 && !removing) setTutorialProgress(3)
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
    if (event.type === 'pointerup' && tutorialStep === 3 && gesture.dragged && [...gesture.visited].filter((index) => blockedTutorialCells.includes(index)).length >= 2) { setTutorialProgress(4); lastTouchTap.current = null; return }
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
  const requestUses = async (kind: 'hint' | 'undo') => {
    if (rewardPending.current) return
    logAdDiagnostic?.('control requests reward', { kind })
    rewardPending.current = true; setRewardBusy(true)
    setNotice('Loading an optional video…')
    const id = globalThis.crypto?.randomUUID?.() ?? `ad-${Date.now()}-${Math.random()}`
    try {
      const result = await requestRewardedAd(() => allowances.grant(kind, id))
      setNotice(result === 'rewarded' ? (kind === 'hint' ? 'You received 3 Hint credits!' : 'You received 3 Undo credits!') : 'The ad is unavailable. You can keep playing.')
    } catch { setNotice('The ad is unavailable. You can keep playing.') }
    finally { rewardPending.current = false; setRewardBusy(false) }
  }
  const onHint = () => {
    if (menuConfirmation || rewardPending.current) return
    if (tutorialStep >= 1 && tutorialStep <= 3) return
    if (gameOver || completed || endTimer.current) return
    const current = allowances.status()
    if (!current.available) { setNotice('Your usage could not be saved. Please check browser storage.'); return }
    if (current.hintFree === 0 && current.hintCredits === 0) { void requestUses('hint'); return }
    const index = findHint(puzzle, board.cells, usedHints)
    if (index === null) { setNotice('No safe next move is available. Try undoing a rabbit.'); return }
    if (hintCell === index) return
    if (!allowances.consume('hint')) return
    setUsedHints((items) => [...items, index])
    setHintCell(index)
    setNotice('A safe rabbit spot is highlighted!')
    if (tutorialStep === 4) finishTutorial()
  }
  const onUndo = () => {
    if (menuConfirmation || rewardPending.current) return
    if (endTimer.current) return
    const current = allowances.status()
    if (!current.available) { setNotice('Your usage could not be saved. Please check browser storage.'); return }
    if (current.undoFree === 0 && current.undoCredits === 0) { void requestUses('undo'); return }
    if (!history.length) return
    if (!allowances.consume('undo')) return
    setBoard(history[history.length - 1])
    if ((tutorialStep === 2 || tutorialStep === 3) && target !== undefined && history[history.length - 1].cells[target] !== 'rabbit') { setTutorialProgress(1); lastTouchTap.current = null; drawing.current = null }
    setHistory((items) => items.slice(0, -1))
    setFailures(failureHistory[failureHistory.length - 1] ?? [])
    setFailureHistory((items) => items.slice(0, -1))
    setHintCell(null)
    setNotice('Undone.')
  }
  const onRestart = () => {
    if (menuConfirmation || rewardPending.current) return
    if (endTimer.current) return
    if (daily) { setNotice('Daily Puzzle is unavailable. Please return to the menu.'); return }
    if (!confirmDuringGameplay(t('Restart this puzzle? Your rabbits and marks will be cleared.'))) return
    if (tutorialStep >= 1 && tutorialStep <= 4) setTutorialProgress(1)
    setBoard(createInitialState(puzzle)); setHistory([]); setFailureHistory([]); setHintCell(null); setUsedHints([]); setNotice(''); setFailures([]); drawing.current = null
  }
  const restoreKeyboardFocus = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) return
    requestAnimationFrame(() => {
      const root = gameRoot.current
      if (root && !root.closest('[hidden]') && active) root.focus({ preventScroll: true })
    })
  }
  const startOver = () => { if (daily) return; if (endTimer.current) clearTimeout(endTimer.current); endTimer.current = null; setEndScreenReady(false); setBoard(createInitialState(puzzle)); setHistory([]); setFailureHistory([]); setHintCell(null); setUsedHints([]); setNotice(''); setFailures([]) }
  // Rebind to the latest gameplay handlers without clearing a held Space brush.
  useEffect(() => {
    const handlers = keyboardHandlers({
      enabled: () => !!gameRoot.current && !gameRoot.current.closest('[hidden]') && !rewardPending.current && !document.hidden && !document.querySelector('[role="dialog"]') && !completed && !gameOver && !endTimer.current,
      size: puzzle.size,
      selected: () => selectedCell.current ?? target ?? 0,
      select: (index) => { selectedCell.current = index; setKeyboardSelection(index) },
      place: placeRabbit, mark: markCell, hint: onHint, undo: onUndo, restart: onRestart,
      menu: () => { drawing.current = null; lastTouchTap.current = null; setMenuConfirmation(true) },
      brushEnd: (visited) => { if (tutorialStep === 3 && [...visited].filter((index) => blockedTutorialCells.includes(index)).length >= 2) setTutorialProgress(4) },
    }, brush.current)
    const keydown = (event: KeyboardEvent) => {
      const element = event.target instanceof HTMLElement ? event.target : null
      if (element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"]')) { handlers.blur(); return }
      if (event.key === 'Enter' && element?.closest('button:not([role="gridcell"]), a')) { handlers.blur(); return }
      handlers.keydown(event)
    }
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', handlers.keyup)
    window.addEventListener('blur', handlers.blur)
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', handlers.keyup); window.removeEventListener('blur', handlers.blur) }
  })

  const nextPuzzle = async () => {
    if (daily) return
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

  return <main ref={gameRoot} inert={rewardBusy} aria-busy={rewardBusy} tabIndex={-1} className={tutorialStep >= 1 && tutorialStep <= 4 ? "game-shell has-level-tutorial" : "game-shell"} id="game">{menuConfirmation && <MainMenuConfirmation onStay={() => setMenuConfirmation(false)} onMenu={() => { setMenuConfirmation(false); onMenu() }}/>}<Header musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={onToggleMusic} onToggleSoundEffects={onToggleSoundEffects} onMenu={onMenu}/><div className={`game-content${(gameOver || completed) && endScreenReady ? ' game-ended' : ''}`}><LevelInfo level={level} rabbitCount={puzzle.rabbitCount} cells={board.cells} lives={board.lives} daily={daily}/>{gameOver && endScreenReady ? <section className="game-result"><div className="out-of-carrots-art" aria-hidden="true">{[0, 1, 2].map((carrot) => <img src={assetUrl('bunny/carrot-life-eaten.svg')} alt="" key={carrot}/>)}</div><h1>{t("Out of Carrots")}</h1>{daily && <DailyCountdown/>}<p>{t("Take a breath and give this puzzle another try.")}</p><p>{t("Oh no, out of carrots!")}</p><button className="pill-button primary-button" onClick={startOver} disabled={daily}>{t("Restart")}</button><button className="text-button" onClick={onMenu}>{t("Main Menu")}</button></section> : completed && endScreenReady ? <section className="game-result"><img src={assetUrl('bunny/bunny.svg')} alt=""/><h1>{t("Puzzle Complete!")}</h1>{daily && <DailyCountdown/>}<p>{t("You solved the Bunoku puzzle with {count} carrots left.", { count: board.lives })}</p><button className="pill-button primary-button" onClick={nextPuzzle} disabled={preparingPuzzle || daily}>{t("Next!")}</button>{generationError && <p role="alert">{translatedError(generationError)}</p>}<button className="text-button" onClick={onMenu}>{t("Main Menu")}</button></section> : <><PuzzleBoard keyboardSelection={keyboardSelection} tutorialStep={tutorialStep} puzzle={puzzle} cells={board.cells} onPointerStart={onPointerStart} onPointerEnter={onPointerEnter} onPointerMove={onPointerMove} onPointerEnd={onPointerEnd} onDoubleClick={(index) => { if (!touchInput.current) placeRabbit(index) }} hintCell={hintCell} failures={failures} celebrations={celebrations} onCelebrationEnd={(id) => setCelebrations((items) => items.filter((item) => item.id !== id))}/><div className="game-feedback" aria-live="polite">{tutorialStep > 0 && (tutorialStep < 5 || !notice) ? <TutorialPrompt step={tutorialStep} onSkip={() => finishTutorial(true)} onContinue={() => finishTutorial()}/> : t(notice) || (board.cells.every((cell) => cell !== 'rabbit' && cell !== 'given' && cell !== 'hint') ? <span className="starting-color">{t("Start with this color")}<span className="starting-color-swatch" style={{ backgroundColor: puzzle.regionColors[puzzle.startRegion] }} aria-label={t("Outlined starting region")} /></span> : '')}</div><BottomControls tutorialStep={tutorialStep} restoreKeyboardFocus={restoreKeyboardFocus} onHint={onHint} onUndo={onUndo} onRestart={onRestart} canUndo={history.length > 0}/></>}</div></main>
}
