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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
