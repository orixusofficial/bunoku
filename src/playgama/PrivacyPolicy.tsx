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
      <p>This policy explains what Bunoku’s game code saves and shares. The website or platform where you play may have its own privacy policy.</p>

      <h3>What Bunoku saves on your device</h3>
      <p>This Playgama edition saves through the Playgama Bridge storage module. Depending on the host, Bridge uses platform storage, cloud storage or browser-backed storage. It saves:</p>
      <ul>
        <li>Your unlocked normal level and whether you completed or skipped the first-time tutorial.</li>
        <li>Your chosen language, Music preference and Sound Effects preference.</li>
        <li>Used free Hints and Undos, remaining rewarded credits, and the last reward transaction ID to prevent duplicate credits.</li>
        <li>Your Daily Puzzle layout and solution, placed rabbits, X marks, remaining lives, failed cells, Hint information, Undo history, combo count and completion status.</li>
        <li>The Daily Puzzle start timestamp and timing records used for its 24-hour cooldown and clock-rollback checks.</li>
      </ul>
      <p>Normal puzzle moves stay in memory while the game is open; only normal level progress is saved across reloads. Daily Puzzle state is saved so an unfinished attempt can resume.</p>
      <p>The game loads saved data before play and sends updates through Bridge. Where platform cloud saving is available, the host may retain the save with your platform account. Availability and retention depend on the platform. A cooldown ending does not automatically delete saved records.</p>

      <h3>Accounts, personal information and analytics</h3>
      <p>This version of Bunoku has no player registration, login, developer-operated game backend, or separate developer-operated analytics or tracking service. It does not ask for your name, email address, payment information, location, camera or microphone access. The game code does not set its own cookies.</p>
      <p>This does not mean playing is anonymous or that no data is processed. Your browser requests game files from the hosting site and uses the included Playgama Bridge SDK, which may connect to the host platform and its services. Hosting services may process technical request data, such as an IP address, under their own policies.</p>

      <h3>Playgama and advertisements</h3>
      <p>Bunoku initializes Playgama Bridge and reports game readiness, loading, level starts, completions and pauses. Bridge may record platform analytics for these events. The game reads the platform language, audio and pause state. Bunoku does not add an external analytics service or a separate player-account system.</p>
      <p>Interstitial advertisements may appear at natural breaks such as returning to the menu, restarting or moving to the next level. If available, explicitly labeled rewarded-ad buttons offer three Hint or Undo credits. Only a completed rewarded ad grants credits; cancelling or an error grants none. Ordinary puzzle play does not require accepting a rewarded ad.</p>
      <p>Playgama, the hosting platform and their advertising partners may process device, connection, usage, saved-game and advertising data under their own policies. Their privacy and advertising controls are separate from Bunoku. Consult the host platform’s Privacy Policy for its data practices, contact details and privacy requests.</p>
      <h3>Managing saved data</h3>
      <p>Use the host platform’s privacy or account controls for cloud-save or platform-data deletion requests. Clearing your browser’s site data can remove browser-backed saves and preferences, but does not necessarily remove platform or cloud records. Cloud saves may be restored when you return. Choose the relevant site carefully, since clearing an entire platform’s data can affect other games.</p>
      <h3>Contact</h3>
      <p>Developer/operator: Bunoku.</p>
      <p>A public privacy contact for Bunoku’s developer has not yet been provided. For data processed by Playgama or the host platform, use the contact details in that platform’s Privacy Policy.</p>
    </article>
    <button className="pill-button primary-button" onClick={onClose}>{t('Back to Settings')}</button>
  </section>
}
