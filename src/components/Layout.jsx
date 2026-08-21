import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { sparepartService } from '../services/sparepartService'
import { authService } from '../services/authService'
import { rbacService, Permissions } from '../services/rbacService'
import { db } from '../services/database'
import { useSyncStatus } from '../hooks/useRealtimeSync'
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Truck,
  BarChart3,
  ScanBarcode,
  Menu,
  X,
  Car,
  Settings,
  LogOut,
  Gauge,
  ChevronsLeft,
  ChevronsRight,
  Wifi,
  WifiOff,
  RefreshCw,
  Users,
  Wrench,
  ClipboardList,
  Shield,
  FileText,
  Undo2,
  ClipboardCheck,
  ShieldCheck
} from 'lucide-react'
import NotificationBell from './NotificationBell'
import { ThemeQuickToggle } from './ThemePicker'

function Layout() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })
  const [lowStockCount, setLowStockCount] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const currentUser = authService.getCurrentUser()
  const syncStatus = useSyncStatus()

  // Inisialisasi realtime subscription ke Supabase
  useEffect(() => {
    db.initRealtime()
    return () => {
      // Jangan remove realtime saat komponen unmount - tetap aktif selama aplikasi berjalan
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadLowStock = async () => {
      try {
        const spareparts = await sparepartService.getAll()
        if (isMounted) {
          setLowStockCount(sparepartService.getLowStock(spareparts || []).length)
        }
      } catch (error) {
        console.error('Failed to load low stock count:', error)
      }
    }

    loadLowStock()

    // Refresh low stock count saat ada perubahan data dari perangkat lain
    const handleDBChange = (e) => {
      const { table: changedTable } = e.detail || {}
      if (!changedTable || changedTable === db.keys.SPAREPARTS) {
        loadLowStock()
      }
    }

    window.addEventListener(db.changeEvent, handleDBChange)

    return () => {
      isMounted = false
      window.removeEventListener(db.changeEvent, handleDBChange)
    }
  }, [])

  const handleToggleCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

  const handleLogout = async () => {
    try {
      await authService.logout()
    } catch (error) {
      console.warn('Logout error:', error)
    }
    navigate('/login')
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await db.flushPendingOps()
      // Trigger refresh semua data
      window.dispatchEvent(new CustomEvent(db.changeEvent, {
        detail: { table: null, operation: 'refresh', timestamp: Date.now(), source: 'manual' }
      }))
      setTimeout(() => setIsRefreshing(false), 800)
    } catch (error) {
      console.error('Refresh error:', error)
      setIsRefreshing(false)
    }
  }

  const role = currentUser?.role || ''

  // Menu dengan permission requirements
  const menuItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true, permission: null },
    { to: '/sparepart', icon: Package, label: 'Data Sparepart', permission: Permissions.VIEW_SPAREPART },
    { to: '/barang-masuk', icon: ArrowDownToLine, label: 'Barang Masuk', permission: Permissions.CREATE_TRANSACTION },
    { to: '/barang-keluar', icon: ArrowUpFromLine, label: 'Barang Keluar', permission: Permissions.CREATE_TRANSACTION },
    { to: '/low-stock', icon: AlertTriangle, label: 'Low Stock Alert', permission: Permissions.VIEW_SPAREPART },
    { to: '/supplier', icon: Truck, label: 'Manajemen Supplier', permission: Permissions.VIEW_SPAREPART },
    { to: '/laporan', icon: BarChart3, label: 'Laporan & Analisis', permission: Permissions.VIEW_REPORTS },
    { to: '/barcode', icon: ScanBarcode, label: 'Barcode Scanner', permission: Permissions.VIEW_SPAREPART },
    { to: '/retur', icon: Undo2, label: 'Retur Barang', permission: Permissions.VIEW_SPAREPART },
    { to: '/stock-opname', icon: ClipboardCheck, label: 'Stock Opname', permission: Permissions.VIEW_SPAREPART },
    { to: '/klaim-asuransi', icon: ShieldCheck, label: 'Klaim Asuransi', permission: Permissions.VIEW_SPAREPART },
    // Service/Repair module
    { to: '/customers', icon: Users, label: 'Pelanggan', permission: Permissions.VIEW_CUSTOMERS },
    { to: '/vehicles', icon: Car, label: 'Kendaraan', permission: Permissions.VIEW_VEHICLES },
    { to: '/mechanics', icon: Wrench, label: 'Teknisi', permission: Permissions.VIEW_MECHANICS },
    { to: '/work-orders', icon: ClipboardList, label: 'Work Order', permission: Permissions.VIEW_WORK_ORDERS },
    { to: '/service-packages', icon: Package, label: 'Service Package', permission: Permissions.VIEW_SERVICE_PACKAGES },
    { to: '/warranties', icon: Shield, label: 'Garansi', permission: Permissions.VIEW_WARRANTIES },
    { to: '/invoices', icon: FileText, label: 'Faktur', permission: Permissions.VIEW_INVOICES },
    // Pengaturan di posisi paling bawah
    { to: '/pengaturan', icon: Settings, label: 'Pengaturan', permission: Permissions.ACCESS_SETTINGS }
  ].filter(item => !item.permission || rbacService.hasPermission(role, item.permission))

  // Menu untuk bottom navigation mobile (hanya 5 item utama)
  const mobileMenuItems = menuItems.slice(0, 5)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`sidebar-bg fixed inset-y-0 left-0 z-50 flex flex-col text-white transform transition-all duration-300 lg:translate-x-0 ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
        } ${
          sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Decorative gradient accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 left-0 w-40 h-40 bg-brand-700/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header sidebar */}
        <div className={`relative flex items-center gap-3 px-6 py-5 border-b border-sidebar-border ${sidebarCollapsed ? 'lg:px-5 lg:justify-center' : ''}`}>
          <img
            src="/favicon.svg"
            alt="Logo FAS"
            className="w-10 h-10 shrink-0 rounded-lg shadow-lg shadow-brand-600/30 ring-1 ring-white/20"
            draggable="false"
          />
          <div className={`flex-1 min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
            <h1 className="font-bold text-lg leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-200">
              FAS
            </h1>
            <p className="text-[11px] text-brand-300/90 font-medium">Management</p>
          </div>
          <button
            className="lg:hidden ml-auto text-slate-400 hover:text-white shrink-0 touch-target"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toggle collapse desktop - di bawah header */}
        <div className={`hidden lg:flex items-center justify-center py-2 border-b border-sidebar-border ${sidebarCollapsed ? 'px-2' : 'px-6'}`}>
          <button
            onClick={handleToggleCollapse}
            title={sidebarCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-brand-300/80 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          >
            {sidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>
              {sidebarCollapsed ? '' : 'Ciutkan'}
            </span>
          </button>
        </div>

        <nav className={`mt-4 px-3 space-y-1 overflow-y-auto flex-1 ${sidebarCollapsed ? 'lg:px-3' : ''}`}>
          {!sidebarCollapsed && (
            <p className="px-4 py-2 text-[10px] font-semibold text-brand-300/70 uppercase tracking-widest hidden lg:block">
              Menu Utama
            </p>
          )}
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              title={sidebarCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all ${
                  sidebarCollapsed ? 'lg:px-0 lg:justify-center' : 'px-4 py-2.5'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-md shadow-brand-600/25'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                } py-2.5`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className={`flex-1 truncate ${sidebarCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
              {item.to === '/low-stock' && lowStockCount > 0 && (
                <>
                  <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 bg-brand-500 text-white text-[10px] font-bold rounded-full shadow-md shadow-brand-500/40 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                    {lowStockCount}
                  </span>
                  {sidebarCollapsed && (
                    <span className="hidden lg:inline-flex absolute top-1 right-1 w-2.5 h-2.5 bg-brand-500 rounded-full ring-2 ring-[var(--color-sidebar)]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={`sidebar-footer-bg p-4 border-t border-sidebar-border space-y-2 backdrop-blur-sm ${sidebarCollapsed ? 'lg:px-2 lg:flex lg:flex-col lg:items-center lg:space-y-2' : ''}`}>
          <button
            onClick={handleLogout}
            title={sidebarCollapsed ? 'Logout' : undefined}
            className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-brand-100 bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg transition-all ${sidebarCollapsed ? 'lg:w-11 lg:px-0' : ''}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Logout</span>
          </button>
          <button
            onClick={() => {
              if (confirm('Reset semua data ke kondisi awal?')) {
                localStorage.clear()
                window.location.href = '/login'
              }
            }}
            className={`w-full text-xs text-brand-300/70 hover:text-brand-200 transition-colors ${sidebarCollapsed ? 'lg:hidden' : ''}`}
          >
            Reset Data Aplikasi
          </button>
        </div>
      </aside>

      {/* Overlay untuk mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className={`transition-[padding] duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-brand-100 px-4 lg:px-8 py-3 lg:py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 lg:gap-3">
            <button
              className="lg:hidden text-gray-600 hover:text-brand-600 transition-colors touch-target"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <button
              className="hidden lg:flex text-gray-600 hover:text-brand-600 transition-colors"
              onClick={handleToggleCollapse}
              title={sidebarCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            >
              {sidebarCollapsed ? <ChevronsRight className="w-6 h-6" /> : <ChevronsLeft className="w-6 h-6" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-2">
                <Gauge className="w-5 h-5 text-brand-600" />
                <h2 className="text-lg font-semibold text-gray-800">FAS</h2>
              </div>
              <div className="lg:hidden flex items-center gap-2">
                <img
                  src="/favicon.svg"
                  alt="Logo FAS"
                  className="w-7 h-7 shrink-0 rounded-md shadow-sm"
                  draggable="false"
                />
                <h2 className="text-base sm:text-lg font-bold text-gray-800 truncate-mobile max-w-[130px] sm:max-w-none">FAS</h2>
              </div>
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-semibold border border-brand-100">
                VCAR-2026
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Sync status */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              syncStatus === 'online'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
            }`}>
              {syncStatus === 'online' ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              {syncStatus === 'online' ? 'Tersinkron' : 'Offline'}
            </div>
            {/* Ganti tema warna cepat */}
            <ThemeQuickToggle />
            {/* Notifikasi */}
            <NotificationBell />
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors touch-target"
              title="Sinkronkan data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-800 truncate-mobile max-w-[120px]">{currentUser?.nama || 'Admin Gudang'}</p>
              <p className="text-xs text-gray-500">
                {currentUser?.role || 'ADMIN'} • {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-full flex items-center justify-center text-white font-semibold shadow-md shadow-brand-500/30 border-2 border-brand-200">
              {currentUser?.nama?.charAt(0)?.toUpperCase() || 'A'}{currentUser?.nama?.charAt(1)?.toUpperCase() || 'G'}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="p-3 sm:p-4 lg:p-8 pb-20 lg:pb-8">
          <Outlet />
        </main>

        {/* Footer - hidden on mobile (diganti bottom nav) */}
        <footer className="hidden lg:block px-8 py-4 text-center text-xs text-gray-400 border-t border-gray-100">
          <p>© 2026 FAS. Semua hak dilindungi.</p>
        </footer>
      </div>

      {/* Bottom Navigation Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] pb-safe">
        <div className="grid grid-cols-5">
          {mobileMenuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center py-2.5 px-1 transition-colors ${
                  isActive ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`relative ${isActive ? 'text-brand-600' : ''}`}>
                    <item.icon className="w-5 h-5" />
                    {item.to === '/low-stock' && lowStockCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 bg-brand-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-md shadow-brand-500/40">
                        {lowStockCount > 99 ? '99+' : lowStockCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium mt-0.5 truncate-mobile max-w-full">
                    {item.label.split(' ')[0]}
                  </span>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-600 rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default Layout
