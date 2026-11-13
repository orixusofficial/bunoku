import { useRef, useState } from 'react'
import { t } from '../i18n'
import { adsAvailable, requestRewardedAd } from '../crazygames.ts'
import { allowances, countdown } from '../game/allowances.ts'
import type { RewardKind } from '../game/allowances.ts'
import { useAllowances } from '../useAllowances'
import RewardIcon from './RewardIcon'
import { loadNormalLevel } from '../game/levels.ts'

export default function Rewards({ onBack }: { onBack: () => void }) {
  const balance = useAllowances()
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [message, setMessage] = useState('')
  // Reward offers follow some actual gameplay, even when opened from the menu.
  const experienced = loadNormalLevel() > 1
  const available = experienced && adsAvailable()
  const watch = async (kind: RewardKind) => {
    if (pending.current || !available || !balance.available || balance.rewardRemaining) return
    pending.current = true; setBusy(true); setMessage('')
    const id = globalThis.crypto?.randomUUID?.() ?? `reward-${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      const result = await requestRewardedAd(() => allowances.grant(kind, id))
      setMessage(result === 'rewarded' ? (kind === 'hint' ? 'You received 3 Hint credits!' : 'You received 3 Undo credits!') : result === 'save-error' ? 'Your reward could not be saved. Please check browser storage.' : 'Ads are unavailable. Please try again later.')
    } finally { pending.current = false; setBusy(false) }
  }
  return <main className="simple-screen rewards-screen"><header className="menu-header"><span className="menu-brand">Bunoku</span><button className="main-menu-button" onClick={onBack} disabled={busy}>{t('Main Menu')}</button></header><section className="placeholder-card"><h1>{t('Rewards')}</h1><p>{t('Optional rewards for a little extra help.')}</p><div className="reward-balances"><p>{t('Hints: {free} free, {credits} credits', { free: balance.hintFree, credits: balance.hintCredits })}</p><p>{t('Undos: {free} free, {credits} credits', { free: balance.undoFree, credits: balance.undoCredits })}</p></div><div className="reward-actions" aria-busy={busy}><button className="pill-button secondary-button" onClick={() => { void watch('hint') }} disabled={busy || !available || !balance.available || balance.rewardRemaining > 0}><RewardIcon/>{t('Watch an ad for 3 Hint credits')}</button><button className="pill-button secondary-button" onClick={() => { void watch('undo') }} disabled={busy || !available || !balance.available || balance.rewardRemaining > 0}><RewardIcon/>{t('Watch an ad for 3 Undo credits')}</button><button className="pill-button secondary-button" onClick={onBack} disabled={busy}>{t('Continue without an ad')}</button></div><p role="status" className="reward-status">{busy ? t('Waiting for the ad…') : message ? t(message) : !balance.available ? t('Your reward could not be saved. Please check browser storage.') : !experienced ? t('Complete a puzzle before watching optional ads.') : !available ? t('Ads are unavailable. Please try again later.') : balance.rewardRemaining > 0 ? t('Rewards available in {time}', { time: countdown(balance.rewardRemaining) }) : t('Watch one optional ad for the reward you choose.')}</p></section></main>
}
