import { useEffect, useRef } from 'react'
import { t } from '../i18n'

export default function PrivacyPolicy({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])

  return <section ref={dialog} className="settings-dialog privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-title" onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
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
      <p>Bunoku uses your browser’s LocalStorage to remember your game between visits. It saves:</p>
      <ul>
        <li>Your unlocked normal level and whether you completed or skipped the first-time tutorial.</li>
        <li>Your chosen language, Music preference and Sound Effects preference.</li>
        <li>Used free Hints and Undos, remaining rewarded credits, and the last reward transaction ID to prevent duplicate credits.</li>
        <li>Your Daily Puzzle layout and solution, placed rabbits, X marks, remaining lives, failed cells, Hint information, Undo history, combo count and completion status.</li>
        <li>The Daily Puzzle start timestamp and timing records used for its 24-hour cooldown and clock-rollback checks.</li>
      </ul>
      <p>Normal puzzle moves stay in memory while the game is open; only normal level progress is saved across reloads. Daily Puzzle state is saved so an unfinished attempt can resume.</p>
      <p>These saves belong to this browser and storage location; they are not an account or a cross-device backup. Bunoku’s game code does not upload these save records or use CrazyGames cloud saving. Records remain until updated, replaced, or removed by you or your browser. A cooldown ending does not automatically delete the saved record. Private browsing or browser settings may remove or block storage.</p>

      <h3>Accounts, personal information and analytics</h3>
      <p>This version of Bunoku has no player registration, login, developer-operated game backend, or separate analytics or tracking service. It does not ask for your name, email address, payment information, location, camera or microphone access. The game code does not set its own cookies.</p>
      <p>This does not mean playing is anonymous or that no data is processed. Your browser requests game files from the hosting site and the SDK from CrazyGames. Hosting services may process technical request data, such as an IP address, under their own policies.</p>

      <h3>CrazyGames and advertisements</h3>
      <p>Bunoku loads the CrazyGames HTML5 SDK v3. When available, the game sends loading and gameplay start/stop notifications and rewarded-ad requests through the SDK. It reads the SDK’s language locale to choose an initial language and its mute setting to respect platform audio controls.</p>
      <p>If rewarded ads are enabled and available, you can request an ad for additional Hint or Undo credits. Ordinary puzzle play does not require watching an ad. A completed rewarded ad grants credits saved locally; an unsuccessful ad grants none.</p>
      <p>CrazyGames and its advertising partners may process device, connection, usage and advertising data and use cookies or similar technologies under their own policies. Bunoku’s local saves are separate from CrazyGames accounts and platform records. For their data practices, privacy rights, contact details and available privacy/ad choices, read the <a href="https://www.crazygames.com/privacy-policy" target="_blank" rel="noopener noreferrer">CrazyGames Privacy Policy</a>. Clearing Bunoku’s local data does not delete data held by CrazyGames or its partners.</p>

      <h3>How to clear your saved data</h3>
      <p>Close Bunoku, open your browser’s privacy or site-data settings, remove stored data for the site hosting the game, then reopen Bunoku. In an embedded game, this storage may be listed under the game’s hosting address rather than the address shown for CrazyGames.</p>
      <p>This removes locally saved progress, Daily attempts, Hint/Undo balances and preferences from that browser. Choose the relevant site carefully: clearing a whole platform’s data may also remove other saved games or settings. Use CrazyGames’ own privacy controls or contact details for requests about its records.</p>

      <h3>Contact</h3>
      <p>Developer/operator: Bunoku.</p>
      <p>A public privacy contact for Bunoku’s developer has not yet been provided. For questions about data processed by CrazyGames, use the contact details in its Privacy Policy linked above.</p>
    </article>
    <button className="pill-button primary-button" onClick={onClose}>{t('Back to Settings')}</button>
  </section>
}
