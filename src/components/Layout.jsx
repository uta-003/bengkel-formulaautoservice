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
  Wrench,
  Settings,
  LogOut
} from 'lucide-react'

function Layout() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [lowStockCount, setLowStockCount] = useState(0)
  const currentUser = authService.getCurrentUser()

  useEffect(() => {
    let isMounted = true

    const loadLowStock = async () => {
      const spareparts = await sparepartService.getAll()
      if (isMounted) {
        setLowStockCount(sparepartService.getLowStock(spareparts).length)
      }
    }

    loadLowStock()

    // Refresh low stock count saat localStorage berubah
    const handleStorageChange = () => {
      sparepartService.getAll().then(spareparts => {
        if (isMounted) {
          setLowStockCount(sparepartService.getLowStock(spareparts).length)
        }
      })
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      isMounted = false
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const handleLogout = () => {
    authService.logout()
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
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Unit Check</h1>
            <p className="text-xs text-slate-400">Sistem Manajemen Sparepart</p>
          </div>
          <button
            className="lg:hidden ml-auto text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="mt-4 px-3 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.label}</span>
              {item.to === '/low-stock' && lowStockCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {lowStockCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
          <button
            onClick={() => {
              if (confirm('Reset semua data ke kondisi awal?')) {
                localStorage.clear()
                window.location.href = '/login'
              }
            }}
            className="w-full text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            Reset Data Aplikasi
          </button>
        </div>
      </aside>

      {/* Overlay untuk mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-gray-600 hover:text-gray-900"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-semibold text-gray-800">Sistem Manajemen Sparepart</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-800">{currentUser?.nama || 'Admin Gudang'}</p>
              <p className="text-xs text-gray-500">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
              {currentUser?.nama?.charAt(0)?.toUpperCase() || 'A'}{currentUser?.nama?.charAt(1)?.toUpperCase() || 'G'}
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout