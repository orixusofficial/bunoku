import { t } from '../i18n.ts'
import { useEffect, useRef } from 'react'

export default function PokiPrivacyPolicy({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  return <section ref={dialog} className="settings-dialog privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-title" onKeyDown={(event) => {
    if (event.key !== 'Tab') return
    const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]') ?? [])]
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }}>
    <button className="dialog-close" onClick={onClose} aria-label={t('Close Privacy Policy')}>×</button>
    <h2 id="privacy-title" ref={heading} tabIndex={-1}>{t('Privacy Policy')}</h2>
    <article className="privacy-body" tabIndex={0} aria-label="Privacy Policy in English" lang="en" dir="ltr">
      <p>This policy explains what Bunoku's game code saves and shares. Poki has its own privacy policy for the platform and its services.</p>
      <h3>What Bunoku saves on your device</h3>
      <p>This Poki edition stores progress, settings, Daily Puzzle state, Hint and Undo balances, and saved puzzle state in this browser using LocalStorage when available. Clearing this site's browser data removes those local saves and preferences.</p>
      <h3>Accounts, personal information and analytics</h3>
      <p>This version of Bunoku has no player registration, login, developer-operated game backend, or separate developer-operated analytics service. The game uses the Poki SDK for loading, gameplay and advertising events. Poki and its advertising partners may process information under their own policies to provide those services.</p>
      <h3>Advertisements</h3>
      <p>Commercial breaks may appear at natural transitions. Optional, clearly labeled rewarded ads can provide three Hint or Undo credits. Credits are awarded only when the Poki SDK confirms successful completion. Ordinary puzzle play can continue without choosing a rewarded ad.</p>
      <h3>Contact</h3>
      <p>Developer/operator: Bunoku. A public privacy contact has not been provided.</p>
    </article>
    <button className="pill-button primary-button" onClick={onClose}>{t('Back to Settings')}</button>
  </section>
}
