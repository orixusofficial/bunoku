/** Resolve public assets within the game's hosting directory, including iframe packages. */
export function assetUrl(path: string): string {
  return `${import.meta.env?.BASE_URL ?? './'}${path.replace(/^\/+/, '')}`
}
