import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { beginLoading, initializeCrazyGames } from './crazygames.ts'

const finishLoading = beginLoading()
function Ready() {
  useEffect(() => { finishLoading() }, [])
  return <App />
}

void initializeCrazyGames().then(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Ready />
  </StrictMode>,
))
