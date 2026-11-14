import { useEffect, useReducer } from 'react'
import { allowances } from './game/allowances.ts'

export function useAllowances() {
  const [, refresh] = useReducer(n => n + 1, 0)
  useEffect(() => {
    const unsubscribe = allowances.subscribe(refresh)
    const interval = setInterval(refresh, 1000)
    window.addEventListener('storage', refresh)
    return () => { unsubscribe(); clearInterval(interval); window.removeEventListener('storage', refresh) }
  }, [])
  return allowances.status()
}
