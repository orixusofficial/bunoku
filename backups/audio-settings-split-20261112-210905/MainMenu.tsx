function SoundIcon({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z" />{muted ? <path d="m17 9 5 6m0-6-5 6" /> : <><path d="M16 9a5 5 0 0 1 0 6" /><path d="M18.5 6.5a9 9 0 0 1 0 11" /></>}</svg>
}

function Mascot() {
  return <img className="menu-mascot" src="/bunny/bunny-menu.svg" alt="A cream bunny sitting beside a carrot" />
}

export default function MainMenu({ soundOn, onToggleSound, onPlay, onDaily, onTutorial, onSettings }: { soundOn: boolean; onToggleSound: () => void; onPlay: () => void; onDaily: () => void; onTutorial: () => void; onSettings: () => void }) {
  return <main className="menu-screen"><header className="menu-header"><a className="menu-brand" href="#menu" aria-label="Bunoku"><span className="menu-brand-mark">b</span>bunoku</a><button className="sound-toggle" type="button" aria-pressed={soundOn} onClick={onToggleSound} aria-label={`Sound ${soundOn ? 'on' : 'off'}`}><SoundIcon muted={!soundOn} /><span>Sound {soundOn ? 'on' : 'off'}</span></button></header><section className="menu-hero"><Mascot /><p className="screen-kicker">A COZY LITTLE PUZZLE</p><h1>Welcome to Bunoku!</h1><p className="menu-subtitle">A little brain game, a lot of bunny fun.</p><div className="menu-actions"><button className="pill-button primary-button play-button" onClick={onPlay}><span>Let's Play!</span><span aria-hidden="true">→</span></button><div className="secondary-actions"><button className="pill-button secondary-button" onClick={onDaily}>Daily Puzzle</button><button className="pill-button secondary-button" onClick={onTutorial}>How to Play</button></div><button className="text-button settings-link" onClick={onSettings}><SettingsIcon />Settings</button></div></section><footer className="menu-footer">A gentle puzzle break, just for you.</footer></main>
}

function SettingsIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19 13.5 2-1.5-2-1.5-.8-2.1.5-2.4-2.5-.5-2-1.5L12 2l-2.2 2-2.4.4-.6 2.4-1.6 1.8L3 9.5 4 12l-1 2.5 2.2 1 1.5 1.8.5 2.4 2.7-.1L12 21l2-1.6 2.6.2.6-2.4 1.7-1.7Z"/></svg> }
