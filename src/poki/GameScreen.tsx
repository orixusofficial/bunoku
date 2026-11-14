import type { ComponentProps } from 'react'
import GameScreen from '../components/GameScreen.tsx'
import { withoutCommercialBreak } from './platform.ts'

// Reuse the complete game component. Menu exits are not Poki ad opportunities;
// the shared Next/Restart handlers retain their natural transition hooks.
export default function PokiGameScreen(props: ComponentProps<typeof GameScreen>) {
  return <GameScreen {...props} onMenu={() => withoutCommercialBreak(props.onMenu)} />
}
