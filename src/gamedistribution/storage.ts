// GameDistribution uses the existing local save format; it does not use Bridge.
export const gameStorage = {
  getItem(key: string) { return globalThis.localStorage.getItem(key) },
  setItem(key: string, value: string) { globalThis.localStorage.setItem(key, value) },
}
