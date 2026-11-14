import { gameLoadingFinished, initializePoki, sdkLocale } from './platform.ts'

// Poki failure is non-fatal: the standard Bunoku game still starts offline or
// when the platform script is unavailable.
void initializePoki().then(async () => {
  const [{ createRoot }, { createElement, StrictMode }, { default: App }, { initializeLanguage }] = await Promise.all([
    import('react-dom/client'), import('react'), import('../App'), import('../i18n'),
  ])
  await import('../index.css')
  await import('../playgama/playgama.css')
  initializeLanguage(sdkLocale())
  document.documentElement.classList.add('playgama-build')
  createRoot(document.getElementById('root')!).render(createElement(StrictMode, null, createElement(App)))
  requestAnimationFrame(gameLoadingFinished)
}).catch(error => {
  console.error('Bunoku startup failed:', error)
  const root = document.getElementById('root')!, message = document.createElement('p'), retry = document.createElement('button')
  message.textContent = 'We couldn’t load Bunoku. Please try again.'
  retry.textContent = 'Try Again'; retry.onclick = () => location.reload()
  root.removeAttribute('inert'); root.replaceChildren(message, retry)
})
