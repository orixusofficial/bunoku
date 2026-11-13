import { t } from '../i18n'
import { useAllowances } from '../useAllowances'
import { countdown } from '../game/allowances.ts'
import { loadNormalLevel } from '../game/levels.ts'

export function DailyCountdown() {
  const status = useAllowances()
  return <p>{t('Next puzzle in {time}', { time: countdown(status.dailyRemaining) })}</p>
}

export default function DailyAccess({ onDaily }: { onDaily: () => void }) {
  const status = useAllowances()
  const progress = Math.min(10, Math.max(0, loadNormalLevel() - 1))
  const locked = progress < 10
  return <button className="pill-button secondary-button daily-access" onClick={onDaily} disabled={locked || !status.available || status.dailyRemaining > 0}><span className="daily-access-title">{locked && <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>}{t('Daily Puzzle')}</span>{locked ? <><span className="daily-progress" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i className={i < progress ? 'is-complete' : ''} key={i}/>)}</span><small>{t('Complete Level 10 to unlock')} · {progress}/10</small></> : !status.available ? <small>{t('Please enable browser storage.')}</small> : status.dailyRemaining > 0 ? <small>{t('Next puzzle in {time}', { time: countdown(status.dailyRemaining) })}</small> : <small>{t('One puzzle every 24 hours')}</small>}</button>
}
