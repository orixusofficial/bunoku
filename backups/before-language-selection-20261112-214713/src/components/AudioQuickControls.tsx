function MusicIcon({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>{muted && <path d="m3 3 18 18"/>}</svg>
}

function SoundIcon({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z" />{muted ? <path d="m17 9 5 6m0-6-5 6" /> : <><path d="M16 9a5 5 0 0 1 0 6" /><path d="M18.5 6.5a9 9 0 0 1 0 11" /></>}</svg>
}

export default function AudioQuickControls({ musicOn, soundEffectsOn, onToggleMusic, onToggleSoundEffects }: { musicOn: boolean; soundEffectsOn: boolean; onToggleMusic: () => void; onToggleSoundEffects: () => void }) {
  return <div className="audio-quick-controls" aria-label="Audio controls">
    <button type="button" className="audio-icon-button" aria-label={`Music ${musicOn ? 'on' : 'off'}`} aria-pressed={musicOn} title="Music" onClick={onToggleMusic}><MusicIcon muted={!musicOn}/><span className="audio-tooltip">Music</span></button>
    <button type="button" className="audio-icon-button" aria-label={`Sound Effects ${soundEffectsOn ? 'on' : 'off'}`} aria-pressed={soundEffectsOn} title="Sound Effects" onClick={onToggleSoundEffects}><SoundIcon muted={!soundEffectsOn}/><span className="audio-tooltip">Sound Effects</span></button>
  </div>
}
