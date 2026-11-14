declare global {
  interface Window {
    PokiSDK?: {
    init(): Promise<void>
    gameLoadingFinished(): void
    gameplayStart(): void
    gameplayStop(): void
    commercialBreak(onAdStarted?: () => void): Promise<void>
    rewardedBreak(onAdStarted?: () => void): Promise<boolean>
    }
  }
}
export {}
