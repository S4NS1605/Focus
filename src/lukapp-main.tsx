import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppsRoot } from './apps-dashboard/AppsRoot'
import { registrarServiceWorker } from './features/lukapp/data/registrarSW'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppsRoot />
  </StrictMode>,
)

registrarServiceWorker()
