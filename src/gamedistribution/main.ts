import { initializeGameDistribution, sdkLocale } from './platform.ts'

// A blocked/offline SDK is non-fatal. Initialization settles before the existing
// game is imported; no advertisements are requested during startup or rendering.
void initializeGameDistribution().then(async () => {
  const [{ createRoot }, { createElement, StrictMode }, { default: App }, { initializeLanguage }] = await Promise.all([
    import('react-dom/client'), import('react'), import('../App'), import('../i18n'),
  ])
  await import('../index.css'); await import('../playgama/playgama.css')
  initializeLanguage(sdkLocale())
  // Reuse existing portal layout rules, not a second design or SDK.
  document.documentElement.classList.add('playgama-build')
  createRoot(document.getElementById('root')!).render(createElement(StrictMode, null, createElement(App)))
}).catch(error => {
  console.error('Bunoku startup failed:', error)
  const root = document.getElementById('root')!, message = document.createElement('p'), retry = document.createElement('button')
  message.textContent = 'We couldn’t load Bunoku. Please try again.'
  retry.textContent = 'Try Again'; retry.onclick = () => location.reload()
  root.removeAttribute('inert'); root.replaceChildren(message, retry)
})
