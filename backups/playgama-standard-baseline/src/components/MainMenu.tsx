import DailyAccess from './DailyAccess'
import { assetUrl } from '../assetUrl.ts'
import { t } from '../i18n'
function Mascot() {
  return <img className="menu-mascot" src={assetUrl('bunny/bunny-menu.svg')} alt={t("A cream bunny sitting beside a carrot")} />
}

export default function MainMenu({ musicOn, soundEffectsOn, onToggleMusic, onToggleSoundEffects, onPlay, onDaily, onTutorial, onSettings }: { musicOn: boolean; soundEffectsOn: boolean; onToggleMusic: () => void; onToggleSoundEffects: () => void; onPlay: () => void; onDaily: () => void; onTutorial: () => void; onSettings: () => void }) {
  return <main className="menu-screen"><header className="menu-header"><a className="menu-brand" href="#menu" aria-label="Bunoku"><span className="menu-brand-mark">b</span>bunoku</a><AudioQuickControls musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={onToggleMusic} onToggleSoundEffects={onToggleSoundEffects}/></header><section className="menu-hero"><Mascot /><p className="screen-kicker">{t("A COZY LITTLE PUZZLE")}</p><h1>{t("Welcome to Bunoku!")}</h1><p className="menu-subtitle">{t("A little brain game, a lot of bunny fun.")}</p><div className="menu-actions"><button className="pill-button primary-button play-button" onClick={onPlay}><span>{t("Let's Play!")}</span><span aria-hidden="true">→</span></button><div className="secondary-actions"><DailyAccess onDaily={onDaily}/><button className="pill-button secondary-button" onClick={onTutorial}>{t("How to Play")}</button></div><div className="menu-small-actions"><button className="text-button settings-link" onClick={onSettings}>{t("Settings")}</button></div></div></section><footer className="menu-footer">{t("A gentle puzzle break, just for you.")}</footer></main>
}

import AudioQuickControls from './AudioQuickControls'
