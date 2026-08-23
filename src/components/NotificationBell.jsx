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

/** Format waktu ringkas & presisi: HH.mm hari ini, "Kemarin", atau tanggal singkat */
function formatNotifTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return time
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Kemarin'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

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
      case 'critical': return 'bg-red-50 text-red-500 border-red-100'
      case 'warning': return 'bg-amber-50 text-amber-500 border-amber-100'
      default: return 'bg-blue-50 text-blue-500 border-blue-100'
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

      {/* Panel dropdown - mobile: fixed di bawah header agar selalu presisi muat layar;
          desktop: absolute menempel kanan tombol */}
      {open && (
        <div className="animate-dropdown-in fixed sm:absolute inset-x-2 sm:inset-x-auto sm:right-0 top-[72px] sm:top-full sm:mt-2 w-auto sm:w-96 bg-white rounded-2xl shadow-xl shadow-black/10 border border-gray-200 z-50 overflow-hidden">
          {/* Header panel */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80">
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-gray-800 leading-none">Notifikasi</h3>
              {summary.total > 0 && (
                <span className="shrink-0 px-1.5 py-1 bg-brand-600 text-white text-[10px] font-bold rounded-full leading-none">
                  {summary.total}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 -mr-1 shrink-0 text-gray-400 hover:text-gray-700 hover:bg-gray-200/70 rounded-lg transition-colors"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Daftar notifikasi */}
          <div className="max-h-[min(24rem,55vh)] overflow-y-auto thin-scrollbar p-2">
            {isLoading ? (
              /* Skeleton loading agar tinggi baris konsisten */
              <ul className="space-y-1" aria-busy="true">
                {[...Array(3)].map((_, i) => (
                  <li key={i} className="flex items-start gap-3 px-3 py-2.5">
                    <span className="shrink-0 w-9 h-9 rounded-xl bg-gray-100 animate-pulse" />
                    <span className="flex-1 min-w-0 space-y-1.5 pt-0.5">
                      <span className="block h-3 w-1/3 bg-gray-100 rounded animate-pulse" />
                      <span className="block h-3 w-3/4 bg-gray-100 rounded animate-pulse" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span className="inline-flex w-12 h-12 rounded-full bg-green-50 items-center justify-center mb-3">
                  <CheckCheck className="w-6 h-6 text-green-500" />
                </span>
                <p className="text-sm font-medium text-gray-600">Semua aman!</p>
                <p className="text-xs text-gray-400 mt-0.5">Tidak ada notifikasi.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {notifications.slice(0, 20).map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleItemClick(n)}
                      className="group w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                    >
                      <span className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center ${getSeverityStyle(n.severity)}`}>
                        {getIcon(n.type)}
                      </span>
                      <span className="min-w-0 flex-1">
                        {/* Baris judul + waktu sejajar presisi */}
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-800 truncate">{n.title}</span>
                          <span className="shrink-0 text-[10px] text-gray-400 tabular-nums whitespace-nowrap">
                            {formatNotifTime(n.timestamp)}
                          </span>
                        </span>
                        <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2 break-words">
                          {n.message}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 20 && (
            <div className="px-4 py-2.5 bg-gray-50/80 border-t border-gray-100 text-center">
              <p className="text-[11px] text-gray-400">Menampilkan 20 dari {notifications.length} notifikasi</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell