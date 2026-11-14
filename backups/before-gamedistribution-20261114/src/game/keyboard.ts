export type KeyboardBrush = { held: boolean; visited: Set<number> }
type Actions = {
  enabled: () => boolean; size: number; selected: () => number; select: (index: number) => void
  place: (index: number) => void; mark: (index: number, drawing?: boolean) => void
  hint: () => void; undo: () => void; restart: () => void; menu: () => void
  brushEnd: (visited: Set<number>) => void
}
export function keyboardHandlers(actions: Actions, brush: KeyboardBrush) {
  const keydown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    if (globalThis.BUNOKU_PLAYGAMA && key === 'escape') return
    if (!actions.enabled() || event.ctrlKey || event.altKey || event.metaKey) { brush.held = false; brush.visited.clear(); return }
    const movement: Record<string, [number, number]> = { w: [-1, 0], arrowup: [-1, 0], s: [1, 0], arrowdown: [1, 0], a: [0, -1], arrowleft: [0, -1], d: [0, 1], arrowright: [0, 1] }
    if (!(key in movement) && !['enter', ' ', 'q', 'e', 'r', 'escape'].includes(key)) return
    event.preventDefault()
    const index = Math.max(0, Math.min(actions.size ** 2 - 1, actions.selected()))
    if (key in movement) {
      const [dr, dc] = movement[key], row = Math.floor(index / actions.size), column = index % actions.size
      const next = Math.max(0, Math.min(actions.size - 1, row + dr)) * actions.size + Math.max(0, Math.min(actions.size - 1, column + dc))
      actions.select(next)
      if (brush.held && !brush.visited.has(next)) { brush.visited.add(next); actions.mark(next, true) }
      return
    }
    if (event.repeat) return
    if (key === ' ') { brush.held = true; brush.visited = new Set([index]); actions.select(index); actions.mark(index); return }
    if (key === 'enter') { actions.select(index); if (!brush.held) actions.place(index) }
    if (key === 'q') actions.hint()
    if (key === 'e') actions.undo()
    if (key === 'r') actions.restart()
    if (key === 'escape') { brush.held = false; brush.visited.clear(); actions.menu() }
  }
  const keyup = (event: KeyboardEvent) => {
    if (event.key !== ' ') return
    if (brush.held && actions.enabled()) actions.brushEnd(brush.visited)
    brush.held = false; brush.visited.clear()
  }
  const blur = () => { brush.held = false; brush.visited.clear() }
  return { keydown, keyup, blur }
}
