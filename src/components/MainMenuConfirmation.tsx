import { t } from '../i18n'

export default function MainMenuConfirmation({ onStay, onMenu }: { onStay: () => void; onMenu: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="menu-confirm-title"><h2 id="menu-confirm-title">{t('Return to Main Menu?')}</h2><button autoFocus className="pill-button secondary-button" onClick={onStay}>{t('Stay')}</button><button className="pill-button primary-button" onClick={onMenu}>{t('Main Menu')}</button></section></div>
}
