import { t } from '../i18n'
import { useEffect, useState } from 'react'
import MainMenuConfirmation from './MainMenuConfirmation'
import AudioQuickControls from './AudioQuickControls'

const rules = [
  { title: 'ONE RABBIT PER REGION', text: 'Every colored region must contain exactly one rabbit.', variant: 'region' },
  { title: 'ONE RABBIT PER ROW AND COLUMN', text: 'No two rabbits can share the same row or column.', variant: 'lines' },
  { title: 'RABBITS CANNOT TOUCH', text: 'Rabbits cannot touch horizontally, vertically or diagonally.', variant: 'touch' },
  { title: 'THREE LIVES', text: 'You have three carrots. Every mistake costs one carrot.', variant: 'lives' },
]

const keyboardControls = [
  ['W / A / S / D', 'Move between puzzle cells'],
  ['Arrow keys', 'Move between puzzle cells'],
  ['Enter', 'Place rabbit / select'],
  ['Space', 'Mark or remove X'],
  ['Hold Space + movement', 'Continuously mark Xs'],
  ['Q', 'Use Hint'], ['E', 'Undo'], ['R', 'Reset puzzle'], ['Esc', 'Open Main Menu confirmation'],
]

function KeyboardHelp() {
  return <section className="keyboard-help" aria-labelledby="keyboard-help-title"><h2 id="keyboard-help-title">{t('PC keyboard controls')}</h2><div className="keyboard-help-columns"><table><thead><tr><th scope="col">{t('Key')}</th><th scope="col">{t('Action')}</th></tr></thead><tbody>{keyboardControls.map(([key, action]) => <tr key={key}><th scope="row"><kbd>{t(key)}</kbd></th><td>{t(action)}</td></tr>)}</tbody></table><div className="keyboard-selection-help"><h3>{t('Move your selection')}</h3><ul>{[['W / ↑', 'Move up'], ['S / ↓', 'Move down'], ['A / ←', 'Move left'], ['D / →', 'Move right'], ['Enter', 'Select/place rabbit']].map(([key, action]) => <li key={key}><kbd>{key}</kbd><span>{t(action)}</span></li>)}</ul></div></div></section>
}

function RuleGrid({ variant }: { variant: string }) {
  const rabbitCells = variant === 'lines' ? [0, 5] : variant === 'touch' ? [0, 10] : [5]
  return <div className={`rule-grid rule-grid-${variant}`} aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <div className={`rule-cell cell-${index} ${rabbitCells.includes(index) ? 'has-rabbit' : ''} ${variant === 'region' && index > 7 ? 'soft-region' : ''} ${variant === 'lines' && [1, 4, 6, 9].includes(index) ? 'forbidden' : ''} ${variant === 'touch' && [1, 4, 5, 6].includes(index) ? 'forbidden' : ''} ${variant === 'region' && index === 1 ? 'allowed' : ''}`} key={index}>{rabbitCells.includes(index) && <img src="/bunny/bunny.svg" alt=""/>}{(variant === 'lines' && [1, 4, 6, 9].includes(index) || variant === 'touch' && [1, 4, 5, 6].includes(index)) && <span className="forbidden-mark">×</span>}</div>)}</div>
}

function RuleIllustration({ variant }: { variant: string }) {
  if (variant === 'lives') return <div className="tutorial-lives" aria-label={t("Three carrots represent three lives")}>{[0, 1, 2].map((life) => <img src="/bunny/carrot-life.svg" key={life} alt="" />)}</div>
  return <RuleGrid variant={variant} />
}

export default function HowToPlay({ musicOn, soundEffectsOn, onToggleMusic, onToggleSoundEffects, onPlay, onBack }: { musicOn: boolean; soundEffectsOn: boolean; onToggleMusic: () => void; onToggleSoundEffects: () => void; onPlay: () => void; onBack: () => void }) {
  const [menuConfirmation, setMenuConfirmation] = useState(false)
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.hidden || event.ctrlKey || event.altKey || event.metaKey) return
      const element = event.target instanceof HTMLElement ? event.target : null
      if (element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
      if (!menuConfirmation && document.querySelector('[role="dialog"]')) return
      event.preventDefault()
      event.stopPropagation()
      if (!menuConfirmation && !event.repeat) setMenuConfirmation(true)
    }
    window.addEventListener('keydown', onEscape, true)
    return () => window.removeEventListener('keydown', onEscape, true)
  }, [menuConfirmation])
  return <main className="tutorial-screen">{menuConfirmation && <MainMenuConfirmation onStay={() => setMenuConfirmation(false)} onMenu={onBack}/>}<header className="menu-header"><div className="game-header-brand"><a className="menu-brand" href="#menu" aria-label="Bunoku"><span className="menu-brand-mark">b</span>bunoku</a><button type="button" className="main-menu-button" onClick={onBack} aria-label={t("Main Menu")} title={t("Main Menu")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1V10Z" /></svg><span>{t("Main Menu")}</span></button></div><AudioQuickControls musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={onToggleMusic} onToggleSoundEffects={onToggleSoundEffects}/></header><section className="tutorial-content"><div className="tutorial-heading"><p className="screen-kicker">{t("THE BUNOKU BASICS")}</p><h1>{t("How to Play")}</h1><p>{t("Four little rules. One very happy bunny.")}</p></div><div className="rules-grid">{rules.map((rule, index) => <article className="rule-card" key={rule.variant}><RuleIllustration variant={rule.variant}/><div><span className="rule-number">{t("RULE")} {index + 1}</span><h2>{t(rule.title)}</h2><p>{t(rule.text)}</p></div></article>)}</div><section className="pointer-help"><h3>{t('Mouse and touch')}</h3><p>{t('Click or tap to mark or remove X. Double-click or double-tap to place a rabbit. Hold and drag to mark multiple boxes.')}</p></section><KeyboardHelp/><div className="tutorial-actions"><button className="pill-button primary-button tutorial-play" onClick={onPlay}>{t("Let’s Play!")}</button><button className="text-button" onClick={onBack}>{t("Back to Menu")}</button></div></section></main>
}
