export type CellBounds = { index: number; left: number; right: number; top: number; bottom: number }

// Clip the movement segment against cell interiors, including cells between
// sparse pointer samples. Merely touching a neighbouring corner is not a hit.
export function crossedCells(x0: number, y0: number, x1: number, y1: number, cells: CellBounds[]): number[] {
  const dx = x1 - x0, dy = y1 - y0
  const hits: { index: number; entry: number }[] = []
  for (const cell of cells) {
    let entry = 0, exit = 1
    for (const [position, delta, min, max] of [[x0, dx, cell.left, cell.right], [y0, dy, cell.top, cell.bottom]]) {
      if (delta === 0) { if (position <= min || position >= max) { exit = -1; break } }
      else {
        const a = (min - position) / delta, b = (max - position) / delta
        entry = Math.max(entry, Math.min(a, b))
        exit = Math.min(exit, Math.max(a, b))
      }
    }
    if (exit > entry) hits.push({ index: cell.index, entry })
  }
  return hits.sort((a, b) => a.entry - b.entry).map(({ index }) => index)
}
