function SoundIcon({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z" />{muted ? <path d="m17 9 5 6m0-6-5 6" /> : <><path d="M16 9a5 5 0 0 1 0 6" /><path d="M18.5 6.5a9 9 0 0 1 0 11" /></>}</svg>
}

const rules = [
  { title: 'ONE RABBIT PER REGION', text: 'Every colored region must contain exactly one rabbit.', variant: 'region' },
  { title: 'ONE RABBIT PER ROW AND COLUMN', text: 'No two rabbits can share the same row or column.', variant: 'lines' },
  { title: 'RABBITS CANNOT TOUCH', text: 'Rabbits cannot touch horizontally, vertically or diagonally.', variant: 'touch' },
  { title: 'THREE LIVES', text: 'You have three carrots. Every mistake costs one carrot.', variant: 'lives' },
]

function RuleGrid({ variant }: { variant: string }) {
  const rabbitCells = variant === 'lines' ? [0, 5] : variant === 'touch' ? [0, 10] : [5]
  return <div className={`rule-grid rule-grid-${variant}`} aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <div className={`rule-cell cell-${index} ${rabbitCells.includes(index) ? 'has-rabbit' : ''} ${variant === 'region' && index > 7 ? 'soft-region' : ''} ${variant === 'lines' && [1, 4, 6, 9].includes(index) ? 'forbidden' : ''} ${variant === 'touch' && [1, 4, 5, 6].includes(index) ? 'forbidden' : ''} ${variant === 'region' && index === 1 ? 'allowed' : ''}`} key={index}>{rabbitCells.includes(index) && <img src="/bunny/bunny.svg" alt=""/>}{(variant === 'lines' && [1, 4, 6, 9].includes(index) || variant === 'touch' && [1, 4, 5, 6].includes(index)) && <span className="forbidden-mark">×</span>}</div>)}</div>
}

function RuleIllustration({ variant }: { variant: string }) {
  if (variant === 'lives') return <div className="tutorial-lives" aria-label="Three carrots represent three lives">{[0, 1, 2].map((life) => <img src="/bunny/carrot-life.svg" key={life} alt="" />)}</div>
  return <RuleGrid variant={variant} />
}

export default function HowToPlay({ soundOn, onToggleSound, onPlay, onBack }: { soundOn: boolean; onToggleSound: () => void; onPlay: () => void; onBack: () => void }) {
  return <main className="tutorial-screen"><header className="menu-header"><a className="menu-brand" href="#menu" aria-label="Bunoku"><span className="menu-brand-mark">b</span>bunoku</a><button className="sound-toggle" type="button" aria-pressed={soundOn} onClick={onToggleSound} aria-label={`Sound ${soundOn ? 'on' : 'off'}`}><SoundIcon muted={!soundOn}/><span>Sound {soundOn ? 'on' : 'off'}</span></button></header><section className="tutorial-content"><div className="tutorial-heading"><p className="screen-kicker">THE BUNOKU BASICS</p><h1>How to Play</h1><p>Four little rules. One very happy bunny.</p></div><div className="rules-grid">{rules.map((rule, index) => <article className="rule-card" key={rule.variant}><RuleIllustration variant={rule.variant}/><div><span className="rule-number">RULE {index + 1}</span><h2>{rule.title}</h2><p>{rule.text}</p></div></article>)}</div><div className="tutorial-actions"><button className="pill-button primary-button tutorial-play" onClick={onPlay}>Let’s Play!</button><button className="text-button" onClick={onBack}>Back to Menu</button></div></section></main>
}
