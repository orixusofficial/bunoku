import { memo } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { assetUrl } from '../assetUrl'
import { t } from '../i18n'
import type { Language } from '../i18n'
import type { CellState, PuzzleDefinition } from '../game/puzzle'

export type CellEvents = {
  start: (index: number, event: PointerEvent<HTMLButtonElement>) => void
  enter: (index: number) => void
  double: (index: number) => void
  celebrationEnd: (id: number) => void
}
type Props = {
  puzzle: PuzzleDefinition; index: number; cell: CellState
  tutorialClass: string; tutorialDisabled: boolean; selected: boolean; hinted: boolean
  failures: { id: number; index: number }[]
  celebrations: { id: number; index: number; text: string }[]
  events: CellEvents; language: Language
}

// Stable event proxies keep untouched cells out of the X-marking render path.
export default memo(function PuzzleCell({ puzzle, index, cell, tutorialClass, tutorialDisabled, selected, hinted, failures, celebrations, events }: Props) {
  const size = puzzle.size
  const row = Math.floor(index / size)
  const region = puzzle.regions[index]
  const active = region === puzzle.startRegion
  const failed = failures.some((failure) => failure.index === index)
  const marked = !failed && cell === 'mark'
  return <button type="button" role="gridcell" data-cell-index={index} data-region-id={region} className={`cell${tutorialClass}${selected ? ' keyboard-selected' : ''} region-${region} ${active ? 'region-start' : ''} ${cell !== 'empty' ? `cell-${cell}` : ''} ${hinted ? 'hint-target' : ''}`} style={{ '--region-color': puzzle.regionColors[region], '--reveal-delay': `${240 * index / Math.max(1, size * size - 1)}ms` } as CSSProperties} aria-label={t("Row {row}, column {column}{state}", { row: row + 1, column: index % size + 1, state: t(puzzle.given === index ? ", given rabbit" : failed ? ", failed" : cell === "mark" ? ", marked" : cell === "rabbit" || cell === "hint" || cell === "given" ? ", rabbit" : "") })} onPointerDown={(event) => events.start(index, event)} onPointerEnter={() => events.enter(index)} onDoubleClick={() => events.double(index)} disabled={tutorialDisabled || puzzle.given === index || cell === 'given' || failed}>{cell === 'rabbit' || cell === 'given' || cell === 'hint' ? <img src={assetUrl('bunny/bunny.svg')} alt=""/> : marked ? <span className="cell-x">×</span> : null}{failures.filter((failure) => failure.index === index).map((failure) => <span className="failed-cell-bite" key={failure.id} aria-hidden="true"><img className="bite-whole" src={assetUrl('bunny/carrot.svg')} alt=""/><img className="bite-eaten" src={assetUrl('bunny/carrot-life-eaten.svg')} alt=""/></span>)}{celebrations.filter((celebration) => celebration.index === index).map((celebration) => <span className="bunny-celebration" key={celebration.id} onAnimationEnd={() => events.celebrationEnd(celebration.id)}>{t(celebration.text)}</span>)}</button>
})
