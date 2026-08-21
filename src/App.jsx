import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastContainer } from './components/ToastContainer'
import Dashboard from './pages/Dashboard'
import Sparepart from './pages/Sparepart'
import BarangMasuk from './pages/BarangMasuk'
import BarangKeluar from './pages/BarangKeluar'
import LowStock from './pages/LowStock'
import Supplier from './pages/Supplier'
import Laporan from './pages/Laporan'
import BarcodeScanner from './pages/BarcodeScanner'
import Pengaturan from './pages/Pengaturan'
import Login from './pages/Login'
// Service/Repair module pages
import Customers from './pages/Customers'
// Fitur baru: retur & stock opname
import Retur from './pages/Retur'
import StockOpname from './pages/StockOpname'
// Fitur klaim asuransi
import InsuranceClaims from './pages/InsuranceClaims'
import Vehicles from './pages/Vehicles'
import Mechanics from './pages/Mechanics'
import WorkOrders from './pages/WorkOrders'
import ServicePackages from './pages/ServicePackages'
import Warranties from './pages/Warranties'
import Invoices from './pages/Invoices'
import { authService } from './services/authService'
import { rbacService, Permissions } from './services/rbacService'

function ProtectedRoute({ children }) {
  const user = authService.getCurrentUser()
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const user = authService.getCurrentUser()
  return user ? <Navigate to="/" replace /> : children
}

// Route yang dilindungi berdasarkan permission RBAC
function PermissionRoute({ permission, children }) {
  const user = authService.getCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  if (!rbacService.hasPermission(user.role, permission)) {
    return <Navigate to="/" replace />
  }
  return children
}

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sparepart" element={
            <PermissionRoute permission={Permissions.VIEW_SPAREPART}>
              <Sparepart />
            </PermissionRoute>
          } />
          <Route path="/barang-masuk" element={
            <PermissionRoute permission={Permissions.CREATE_TRANSACTION}>
              <BarangMasuk />
            </PermissionRoute>
          } />
          <Route path="/barang-keluar" element={
            <PermissionRoute permission={Permissions.CREATE_TRANSACTION}>
              <BarangKeluar />
            </PermissionRoute>
          } />
          <Route path="/low-stock" element={
            <PermissionRoute permission={Permissions.VIEW_SPAREPART}>
              <LowStock />
            </PermissionRoute>
          } />
          <Route path="/supplier" element={
            <PermissionRoute permission={Permissions.VIEW_SPAREPART}>
              <Supplier />
            </PermissionRoute>
          } />
          <Route path="/laporan" element={
            <PermissionRoute permission={Permissions.VIEW_REPORTS}>
              <Laporan />
            </PermissionRoute>
          } />
          <Route path="/barcode" element={
            <PermissionRoute permission={Permissions.VIEW_SPAREPART}>
              <BarcodeScanner />
            </PermissionRoute>
          } />
          <Route path="/pengaturan" element={
            <PermissionRoute permission={Permissions.ACCESS_SETTINGS}>
              <Pengaturan />
            </PermissionRoute>
          } />

          {/* Service/Repair module routes */}
          <Route path="/customers" element={
            <PermissionRoute permission={Permissions.VIEW_CUSTOMERS}>
              <Customers />
            </PermissionRoute>
          } />
          <Route path="/vehicles" element={
            <PermissionRoute permission={Permissions.VIEW_VEHICLES}>
              <Vehicles />
            </PermissionRoute>
          } />
          <Route path="/mechanics" element={
            <PermissionRoute permission={Permissions.VIEW_MECHANICS}>
              <Mechanics />
            </PermissionRoute>
          } />
          <Route path="/work-orders" element={
            <PermissionRoute permission={Permissions.VIEW_WORK_ORDERS}>
              <WorkOrders />
            </PermissionRoute>
          } />
          <Route path="/service-packages" element={
            <PermissionRoute permission={Permissions.VIEW_SERVICE_PACKAGES}>
              <ServicePackages />
            </PermissionRoute>
          } />
          <Route path="/warranties" element={
            <PermissionRoute permission={Permissions.VIEW_WARRANTIES}>
              <Warranties />
            </PermissionRoute>
          } />
          <Route path="/invoices" element={
            <PermissionRoute permission={Permissions.VIEW_INVOICES}>
              <Invoices />
            </PermissionRoute>
          } />

          {/* Fitur baru: retur & stock opname */}
          <Route path="/retur" element={
            <PermissionRoute permission={Permissions.VIEW_SPAREPART}>
              <Retur />
            </PermissionRoute>
          } />
          <Route path="/stock-opname" element={
            <PermissionRoute permission={Permissions.VIEW_SPAREPART}>
              <StockOpname />
            </PermissionRoute>
          } />

          {/* Fitur klaim asuransi */}
          <Route path="/klaim-asuransi" element={
            <PermissionRoute permission={Permissions.VIEW_SPAREPART}>
              <InsuranceClaims />
            </PermissionRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
