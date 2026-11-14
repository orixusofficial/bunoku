import { useEffect, useRef } from 'react'
import { t } from '../i18n'

export default function PrivacyPolicy({ onClose }: { onClose: () => void }) {
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
      <p className="privacy-updated">Last updated: <time dateTime="2026-11-14">14 November 2026</time></p>
      <p>This policy describes Bunoku’s GameDistribution edition. The website where you play and GameDistribution have their own privacy and advertising policies.</p>
      <h3>Saved progress and settings</h3>
      <p>Bunoku uses your browser’s LocalStorage to save your unlocked normal level, first-time tutorial completion, language, Music and Sound Effects preferences, used free Hints and Undos, rewarded credits and the last reward transaction ID.</p>
      <p>Daily Puzzle saves include the puzzle and solution, placed rabbits, manual X marks, remaining lives, failed cells, Hint and Undo history, combo count, completion status, attempt timestamp and clock-checking records for its 24-hour cooldown. Normal puzzle moves remain in memory; normal level progress persists across reloads.</p>
      <h3>GameDistribution and advertisements</h3>
      <p>Bunoku loads GameDistribution’s official HTML5 SDK with its public Game ID. The SDK handles advertising and its consent process. Interstitial ads may be requested when you choose to start a puzzle or at menu, restart and level-transition breaks. Optional rewarded ads offer three Hint or Undo uses; only a completed rewarded video grants them.</p>
      <p>GameDistribution, hosting sites and advertising partners may process device, connection, usage and advertising data under their own policies. Bunoku observes the SDK’s privacy opt-out signals and does not add independent analytics, advertising networks or third-party tracking services. The game does not use Playgama Bridge or CrazyGames SDK in this edition.</p>
      <h3>Accounts and personal information</h3>
      <p>Bunoku has no developer-operated player account system, login or game backend. The game does not ask for your name, email, payment information, camera, microphone or location. This does not mean no data is processed: your browser requests files from the host and the advertising SDK connects to its services.</p>
      <h3>Clearing saved data</h3>
      <p>You can remove browser-backed Bunoku progress and settings by clearing site data in your browser. On a shared hosting site, this may also affect other games. Bunoku does not implement cloud saving in this edition. For information or requests concerning platform and advertising data, consult the host’s and GameDistribution’s privacy policies.</p>
      <h3>Contact</h3>
      <p>Developer/operator: Bunoku. A public developer privacy contact has not been provided. Use the relevant platform’s privacy contacts for data it processes.</p>
    </article>
    <button className="pill-button primary-button" onClick={onClose}>{t('Back to Settings')}</button>
  </section>
}

