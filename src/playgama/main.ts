import { initializePlaygama, markGameReady, sdkLocale } from './platform'

// Load the game/React/assets only after Bridge initialization and save hydration.
void initializePlaygama().then(async () => {
  const [{ createRoot }, { createElement, StrictMode, useEffect }, { default: App }, { initializeLanguage }] = await Promise.all([
    import('react-dom/client'), import('react'), import('../App'), import('../i18n'),
  ])
  await import('../index.css')
  await import('./playgama.css')
  initializeLanguage(sdkLocale())
  document.documentElement.classList.add('playgama-build')
  function Ready() {
    useEffect(() => { const frame = requestAnimationFrame(markGameReady); return () => cancelAnimationFrame(frame) }, [])
    return createElement(App)
  }
  createRoot(document.getElementById('root')!).render(createElement(StrictMode, null, createElement(Ready)))
}).catch(error => {
  console.error('Bunoku Playgama startup failed:', error)
  const root = document.getElementById('root')!
  const message = document.createElement('p'), retry = document.createElement('button')
  message.textContent = 'We couldn’t load Bunoku and your saved progress. Please try again.'
  retry.textContent = 'Try Again'; retry.onclick = () => location.reload()
  root.removeAttribute('inert'); root.replaceChildren(message, retry)
})
