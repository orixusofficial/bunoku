// Poki build retains Bunoku's existing local save format. Every storage access
// remains inside the game's existing try/catch handling for private browsing.
export const gameStorage = {
  getItem(key: string) { return globalThis.localStorage.getItem(key) },
  setItem(key: string, value: string) { globalThis.localStorage.setItem(key, value) },
}
