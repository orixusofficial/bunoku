function Mascot() {
  return <img className="menu-mascot" src="/bunny/bunny-menu.svg" alt="A cream bunny sitting beside a carrot" />
}

export default function MainMenu({ musicOn, soundEffectsOn, onToggleMusic, onToggleSoundEffects, onPlay, onDaily, onTutorial, onSettings }: { musicOn: boolean; soundEffectsOn: boolean; onToggleMusic: () => void; onToggleSoundEffects: () => void; onPlay: () => void; onDaily: () => void; onTutorial: () => void; onSettings: () => void }) {
  return <main className="menu-screen"><header className="menu-header"><a className="menu-brand" href="#menu" aria-label="Bunoku"><span className="menu-brand-mark">b</span>bunoku</a><AudioQuickControls musicOn={musicOn} soundEffectsOn={soundEffectsOn} onToggleMusic={onToggleMusic} onToggleSoundEffects={onToggleSoundEffects}/></header><section className="menu-hero"><Mascot /><p className="screen-kicker">A COZY LITTLE PUZZLE</p><h1>Welcome to Bunoku!</h1><p className="menu-subtitle">A little brain game, a lot of bunny fun.</p><div className="menu-actions"><button className="pill-button primary-button play-button" onClick={onPlay}><span>Let's Play!</span><span aria-hidden="true">→</span></button><div className="secondary-actions"><button className="pill-button secondary-button" onClick={onDaily}>Daily Puzzle</button><button className="pill-button secondary-button" onClick={onTutorial}>How to Play</button></div><button className="text-button settings-link" onClick={onSettings}><SettingsIcon />Settings</button></div></section><footer className="menu-footer">A gentle puzzle break, just for you.</footer></main>
}

function SettingsIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19 13.5 2-1.5-2-1.5-.8-2.1.5-2.4-2.5-.5-2-1.5L12 2l-2.2 2-2.4.4-.6 2.4-1.6 1.8L3 9.5 4 12l-1 2.5 2.2 1 1.5 1.8.5 2.4 2.7-.1L12 21l2-1.6 2.6.2.6-2.4 1.7-1.7Z"/></svg> }
import AudioQuickControls from './AudioQuickControls'
