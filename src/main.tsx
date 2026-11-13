import { initializeLanguage } from './i18n'
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { beginLoading, initializeCrazyGames, sdkLocale } from './crazygames.ts'

const finishLoading = beginLoading()
function Ready() {
  useEffect(() => { finishLoading() }, [])
  return <App />
}

void initializeCrazyGames().then(() => { initializeLanguage(sdkLocale()); return createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Ready />
  </StrictMode>,
) })
