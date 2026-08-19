import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { db } from './services/database'

// Inisialisasi realtime + sync ketika aplikasi pertama kali di-load
function AppInitializer() {
  useEffect(() => {
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