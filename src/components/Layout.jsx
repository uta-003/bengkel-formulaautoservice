import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { sparepartService } from '../services/sparepartService'
import { authService } from '../services/authService'
import { rbacService, Permissions } from '../services/rbacService'
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
  ChevronsRight
} from 'lucide-react'

function Layout() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })
  const [lowStockCount, setLowStockCount] = useState(0)
  const currentUser = authService.getCurrentUser()

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

    return () => {
      isMounted = false
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
    { to: '/pengaturan', icon: Settings, label: 'Pengaturan', permission: Permissions.ACCESS_SETTINGS }
  ].filter(item => !item.permission || rbacService.hasPermission(role, item.permission))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-gradient-to-b from-[#1a0505] via-[#200606] to-[#120303] text-white transform transition-all duration-300 lg:translate-x-0 ${
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
          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center shadow-lg shadow-brand-600/30 shrink-0">
            <Car className="w-6 h-6" />
          </div>
          <div className={`flex-1 min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
            <h1 className="font-bold text-lg leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-200">
              Formula Auto
            </h1>
            <p className="text-[11px] text-brand-300/90 font-medium">Service Management</p>
          </div>
          <button
            className="lg:hidden ml-auto text-slate-400 hover:text-white shrink-0"
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
                    <span className="hidden lg:inline-flex absolute top-1 right-1 w-2.5 h-2.5 bg-brand-500 rounded-full ring-2 ring-[#200606]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={`p-4 border-t border-sidebar-border space-y-2 bg-gradient-to-r from-[#120303]/90 to-[#1a0505]/90 backdrop-blur-sm ${sidebarCollapsed ? 'lg:px-2 lg:flex lg:flex-col lg:items-center lg:space-y-2' : ''}`}>
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
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-brand-100 px-4 lg:px-8 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-gray-600 hover:text-brand-600 transition-colors"
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
                <h2 className="text-lg font-semibold text-gray-800">Formula Auto Service</h2>
              </div>
              <div className="lg:hidden">
                <h2 className="text-lg font-bold text-gray-800">Formula Auto</h2>
              </div>
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-semibold border border-brand-100">
                VCAR-2026
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-800">{currentUser?.nama || 'Admin Gudang'}</p>
              <p className="text-xs text-gray-500">
                {currentUser?.role || 'ADMIN'} • {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-full flex items-center justify-center text-white font-semibold shadow-md shadow-brand-500/30 border-2 border-brand-200">
              {currentUser?.nama?.charAt(0)?.toUpperCase() || 'A'}{currentUser?.nama?.charAt(1)?.toUpperCase() || 'G'}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="px-4 lg:px-8 py-4 text-center text-xs text-gray-400 border-t border-gray-100">
          <p>© 2026 Formula Auto Service. Semua hak dilindungi.</p>
        </footer>
      </div>
    </div>
  )
}

export default Layout
