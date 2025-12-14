import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './utils/diagnostic-test'

// FORCE CESIUM TO USE LOCAL ASSETS (Fixes "No Buildings" / 404s in Dev)
// We manually copied Assets/Widgets/Workers to client/public
(window as any).CESIUM_BASE_URL = "/";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
