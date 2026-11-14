import { isComplete, validatePuzzle } from './puzzle.ts'
import type { BoardState, PuzzleDefinition } from './puzzle.ts'
export type DailyProgress = {
  puzzle: PuzzleDefinition; board: BoardState; history: BoardState[]
  failures: { id: number; index: number }[]; failureHistory: { id: number; index: number }[][]
  usedHints: number[]; hintCell: number | null; combo: number; started: number; finished: boolean
}
export function initialDailyProgress(puzzle: PuzzleDefinition): DailyProgress {
  return { puzzle, board: { cells: Array(puzzle.size ** 2).fill('empty'), lives: 3 }, history: [], failures: [], failureHistory: [], usedHints: [], hintCell: null, combo: 0, started: 0, finished: false }
}
export function validDailyProgress(data: DailyProgress): boolean {
  try {
    if (!data.puzzle.daily || data.puzzle.size !== 9 || !validatePuzzle(data.puzzle)) return false
    const index = (n: number) => Number.isInteger(n) && n >= 0 && n < 81
    const board = (b: BoardState) => Number.isInteger(b.lives) && b.lives >= 0 && b.lives <= 3 && b.cells.length === 81 && b.cells.every((c,i) => ['empty','mark','rabbit'].includes(c) && (c !== 'rabbit' || data.puzzle.solution.includes(i)))
    const failures = (a: DailyProgress['failures']) => a.length <= 3 && new Set(a.map(f=>f.index)).size === a.length && a.every(f => index(f.index) && Number.isSafeInteger(f.id) && f.id > 0)
    return board(data.board) && data.history.every(board) && data.failureHistory.length === data.history.length && data.failureHistory.every(failures) && failures(data.failures) && data.usedHints.every(index) && (data.hintCell === null || index(data.hintCell)) && Number.isSafeInteger(data.combo) && data.combo >= 0 && Number.isSafeInteger(data.started) && data.started >= 0 && data.finished === (data.board.lives === 0 || isComplete(data.puzzle,data.board.cells))
  } catch { return false }
}
