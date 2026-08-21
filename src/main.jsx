import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { db } from './services/database'
import { initTheme } from './services/themeService'

// Inisialisasi realtime + sync ketika aplikasi pertama kali di-load
function AppInitializer() {
  useEffect(() => {
    // Terapkan tema tersimpan (sinkronkan juga warna meta theme-color)
    initTheme()

    // Inisialisasi realtime subscription
    db.initRealtime()

    // Sinkronisasi data offline ke Supabase ketika kembali online
    const handleOnline = () => {
      console.log('[App] Koneksi kembali online, mencoba sync...')
      db.flushPendingOps()
    }

    const handleOffline = () => {
      console.log('[App] Koneksi offline, data akan disimpan lokal')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cek status koneksi saat pertama load
    if (navigator.onLine) {
      db.flushPendingOps()
    }

    // Registrasi Service Worker untuk PWA (installable di HP/PC)
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[PWA] Gagal registrasi service worker:', err)
      })
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppInitializer />
  </StrictMode>,
)