import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  AlertTriangle,
  Shield,
  Wallet,
  X,
  CheckCheck
} from 'lucide-react'
import { notificationService } from '../services/notificationService'
import { db } from '../services/database'
import { soundService } from '../services/soundService'

// Ikon lonceng notifikasi dengan dropdown panel
// Menampilkan: low stock, garansi expiring, invoice belum dibayar
function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [summary, setSummary] = useState({ total: 0, critical: 0 })
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const panelRef = useRef(null)
  const navigate = useNavigate()

  const loadNotifications = async () => {
    setIsLoading(true)
    try {
      const [data, sum] = await Promise.all([
        notificationService.getAll(),
        notificationService.getSummary()
      ])
      setNotifications(data)
      setSummary(sum)
    } catch (err) {
      console.warn('Gagal memuat notifikasi:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()

    // Refresh saat data berubah (realtime dari perangkat lain)
    const handleDBChange = () => loadNotifications()
    window.addEventListener(db.changeEvent, handleDBChange)

    // Refresh setiap 2 menit
    const interval = setInterval(loadNotifications, 120000)

    // Tutup panel saat klik di luar
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener(db.changeEvent, handleDBChange)
      clearInterval(interval)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleItemClick = (notif) => {
    setOpen(false)
    if (notif.link) navigate(notif.link)
  }

  const getIcon = (type) => {
    switch (type) {
      case 'LOW_STOCK': return <AlertTriangle className="w-4 h-4" />
      case 'WARRANTY_EXPIRING': return <Shield className="w-4 h-4" />
      case 'INVOICE_UNPAID': return <Wallet className="w-4 h-4" />
      default: return <Bell className="w-4 h-4" />
    }
  }

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 text-red-600 border-red-200'
      case 'warning': return 'bg-yellow-50 text-yellow-600 border-yellow-200'
      default: return 'bg-blue-50 text-blue-600 border-blue-200'
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Tombol lonceng */}
      <button
        onClick={() => { setOpen(prev => !prev); soundService.click() }}
        className="relative p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors touch-target"
        title="Notifikasi"
        aria-label="Notifikasi"
      >
        <Bell className="w-[18px] h-[18px]" />
        {summary.total > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm ${
            summary.critical > 0 ? 'bg-red-500 text-white' : 'bg-brand-500 text-white'
          }`}>
            {summary.total > 99 ? '99+' : summary.total}
          </span>
        )}
      </button>

      {/* Panel dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header panel */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-600" />
              Notifikasi
              {summary.total > 0 && (
                <span className="px-1.5 py-0.5 bg-brand-100 text-brand-700 text-[10px] font-bold rounded-full">
                  {summary.total}
                </span>
              )}
            </h3>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Daftar notifikasi */}
          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Memuat notifikasi...</p>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <CheckCheck className="w-10 h-10 text-green-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Semua aman! Tidak ada notifikasi.</p>
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-b-0"
                >
                  <span className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${getSeverityStyle(n.severity)}`}>
                    {getIcon(n.type)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-gray-800">{n.title}</span>
                    <span className="block text-xs text-gray-500 mt-0.5 break-words">{n.message}</span>
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 20 && (
            <div className="px-4 py-2 bg-gray-50/50 border-t border-gray-100 text-center">
              <p className="text-[11px] text-gray-400">Menampilkan 20 dari {notifications.length} notifikasi</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
