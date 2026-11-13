import { useSyncExternalStore } from 'react'
import { translations } from './translations'

export const languages = { en: 'English', es: 'Español', ar: 'العربية', hi: 'हिन्दी' } as const
export type Language = keyof typeof languages
function readLanguage(): Language {
  try { const saved = localStorage.getItem('bunoku.language'); if (saved && saved in languages) return saved as Language } catch { /* Use English if storage is unavailable. */ }
  return 'en'
}
let language = readLanguage()
const listeners = new Set<() => void>()
export function setLanguage(next: Language) {
  if (!(next in languages) || next === language) return
  language = next
  try { localStorage.setItem('bunoku.language', next) } catch { /* Keep this session's selection. */ }
  listeners.forEach((listener) => listener())
}
export function useLanguage() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => language, () => 'en' as Language)
}
export function t(source: string, values: Record<string, string | number> = {}): string {
  const index = { en: -1, es: 0, ar: 1, hi: 2 }[language]
  const translated = index < 0 ? source : translations[source]?.[index] ?? source
  return translated.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
}
export function translatedError(message: string) {
  return t(message in translations ? message : 'We couldn’t prepare the puzzle. Please try again.')
}
