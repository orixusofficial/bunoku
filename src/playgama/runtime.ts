import type { PlaygamaBridge } from '@playgama/bridge'

export function bridge(): PlaygamaBridge {
  const sdk = (window as Window & { bridge?: PlaygamaBridge }).bridge
  if (!sdk) throw new Error('Playgama Bridge could not be loaded')
  return sdk
}
