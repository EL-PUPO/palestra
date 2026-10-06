import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { richiediMemoriaPersistente } from './lib/backup'
import { applicaTema } from './lib/impostazioni'
import './stile.css'

applicaTema()
registerSW({ immediate: true })
void richiediMemoriaPersistente()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
