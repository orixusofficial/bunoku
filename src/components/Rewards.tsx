import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { adsAvailable, requestRewardedAd } from '../crazygames.ts'
import { allowances, countdown } from '../game/allowances.ts'
import type { RewardKind } from '../game/allowances.ts'
import { useAllowances } from '../useAllowances'
import RewardIcon from './RewardIcon'
import { loadNormalLevel } from '../game/levels.ts'
import { assetUrl } from '../assetUrl.ts'

export default function Rewards({ initialKind, onBack, onRewardGranted }: { initialKind: RewardKind | null; onBack: () => void; onRewardGranted: (kind: RewardKind) => void }) {
  const balance = useAllowances()
  const [selected, setSelected] = useState<RewardKind>(initialKind ?? 'hint')
  const [busy, setBusy] = useState(false)
  const [adsUsable, setAdsUsable] = useState(() => adsAvailable())
  const pending = useRef(false)
  const [message, setMessage] = useState('')
  const experienced = loadNormalLevel() > 1
  const available = experienced && adsUsable
  const autoRequested = useRef(false)
  const watch = async (kind: RewardKind) => {
    setSelected(kind)
    if (pending.current || !available || !balance.available || balance.rewardRemaining) return
    pending.current = true; setBusy(true); setMessage('')
    const id = globalThis.crypto?.randomUUID?.() ?? `reward-${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      const result = await requestRewardedAd(() => allowances.grant(kind, id))
      setAdsUsable(adsAvailable())
      if (result === 'rewarded') {
        setMessage(kind === 'hint' ? 'You received 1 Hint credit!' : 'You received 1 Undo credit!')
        onRewardGranted(kind)
      } else setMessage(result === 'save-error' ? 'Your reward could not be saved. Please check browser storage.' : 'No videos are available right now. Please come back later.')
    } catch {
      setAdsUsable(adsAvailable())
      setMessage('No videos are available right now. Please come back later.')
    } finally { pending.current = false; setBusy(false) }
  }
  useEffect(() => {
    if (!initialKind || autoRequested.current) return
    const timer = setTimeout(() => { autoRequested.current = true; void watch(initialKind) }, 0)
    return () => clearTimeout(timer)
  }, [])
  return <main className="simple-screen rewards-screen">
    <header className="menu-header rewards-header"><span className="menu-brand"><span className="menu-brand-mark">b</span>Bunoku</span><button className="main-menu-button rewards-back" onClick={onBack} disabled={busy}><span aria-hidden="true">←</span>{t('Main Menu')}</button></header>
    <section className="rewards-world">
      <div className="rewards-sparkle sparkle-one" aria-hidden="true">✦</div><div className="rewards-sparkle sparkle-two" aria-hidden="true">✧</div>
      <div className="rewards-mascot" aria-hidden="true"><img src={assetUrl('bunny/bunny-menu.svg')} alt=""/><img className="rewards-carrot" src={assetUrl('bunny/carrot-life.svg')} alt=""/></div>
      <p className="screen-kicker">{t('A LITTLE BUNOKU BOOST')}</p><h1>{t(initialKind ? (initialKind === 'hint' ? 'Hint' : 'Undo') : 'Choose a reward')}</h1><p className="rewards-subtitle">{t(initialKind ? 'Your bunny is finding a reward…' : 'Pick a little boost for your next move.')}</p>
      {!initialKind && <div className="reward-cards" role="group" aria-label={t('Choose a reward')}>
        <button type="button" className={`reward-card reward-hint${selected === 'hint' ? ' is-selected' : ''}`} onClick={() => { void watch('hint') }} disabled={busy || !available || !balance.available || balance.rewardRemaining > 0}>
          <span className="reward-card-art reward-lightbulb"><RewardBulb/></span><span className="reward-card-title">{t('Hint')}</span><span className="reward-card-prize">+1 {t('Hint')}</span><span className="reward-card-video"><RewardIcon/>{t('Video reward')}</span>
        </button>
        <button type="button" className={`reward-card reward-undo${selected === 'undo' ? ' is-selected' : ''}`} onClick={() => { void watch('undo') }} disabled={busy || !available || !balance.available || balance.rewardRemaining > 0}>
          <span className="reward-card-art reward-undo-art"><RewardUndo/></span><span className="reward-card-title">{t('Undo')}</span><span className="reward-card-prize">+1 {t('Undo')}</span><span className="reward-card-video"><RewardIcon/>{t('Video reward')}</span>
        </button>
      </div>}
      <div className="reward-pocket" aria-label={t('Reward credits')}><span>🥕 {t('Hint')}: {balance.hintCredits}</span><span>✨ {t('Undo')}: {balance.undoCredits}</span></div>
      <div className="reward-actions" aria-busy={busy}>
        {initialKind && message && available && <button className="pill-button secondary-button" onClick={() => { void watch(initialKind) }} disabled={busy || balance.rewardRemaining > 0}>{t('Try Again')}</button>}
        <button className="pill-button secondary-button reward-leave" onClick={onBack} disabled={busy}><span aria-hidden="true">←</span>{t('Main Menu')}</button>
      </div>
      <p role="status" className="reward-status">{busy ? t('Your bunny is finding a reward…') : message ? t(message) : !balance.available ? t('Your rewards could not be saved right now.') : !experienced ? t('Play a puzzle first to unlock rewards.') : !available ? t('No videos are available right now. Please come back later.') : balance.rewardRemaining > 0 ? t('A new video reward is ready in {time}.', { time: countdown(balance.rewardRemaining) }) : t('A completed video gives exactly one selected use.')}</p>
    </section>
  </main>
}

function RewardBulb() { return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5a14 14 0 0 0-8 25.5c1.4 1 2.5 2.4 2.7 4.5h10.6c.2-2.1 1.3-3.5 2.7-4.5A14 14 0 0 0 24 5Z"/><path d="M19 39h10m-8 4h6M24 0v-0m18 6-4 4M48 23h-6M6 6l4 4M0 23h6"/></svg> }
function RewardUndo() { return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="m18 19-10 9 10 9"/><path d="M9 28h19a12 12 0 1 1-8.5 20.5"/></svg> }
