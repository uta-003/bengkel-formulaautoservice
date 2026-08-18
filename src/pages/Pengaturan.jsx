import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Shield,
  Plus,
  Pencil,
  Trash2,
  X,
  History
} from 'lucide-react'
import { authService, auditService } from '../services/authService'
import { rbacService } from '../services/rbacService'
import { validators, validateForm } from '../services/validators'
import { toastService } from '../services/toastService'

function Pengaturan() {
  const navigate = useNavigate()
  const currentUser = authService.getCurrentUser()
  const [users, setUsers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [form, setForm] = useState({
    username: '',
    password: '',
    nama: '',
    role: 'STAFF',
    email: ''
  })
  const [error, setError] = useState('')
  const [formErrors, setFormErrors] = useState({})

  // Check if user has permission to access settings
  useEffect(() => {
    if (!currentUser || !rbacService.canAccessSettings(currentUser.role)) {
      toastService.error('Anda tidak memiliki akses ke halaman pengaturan')
      navigate('/')
    }
  }, [currentUser, navigate])

  const loadData = async () => {
    try {
      const [usersData, auditData] = await Promise.all([
        authService.getAllUsers(),
        auditService.getAll()
      ])
      setUsers(usersData || [])
      setAuditLogs(auditData || [])
    } catch (err) {
      console.error('Failed to load settings data:', err)
      toastService.error('Gagal memuat data pengaturan')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setFormErrors({})

    // Validation rules
    const rules = {
      username: (value) => validators.required(value, 'Username'),
      nama: (value) => validators.required(value, 'Nama'),
      email: (value) => validators.email(value),
      password: (value) => editingId ? null : validators.required(value, 'Password')
    }

    const errors = validateForm(form, rules)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      setError('Silakan perbaiki error di form')
      return
    }

    try {
      if (editingId) {
        // Check permission to update
        if (!rbacService.canCreateUser(currentUser.role) && editingId !== currentUser.id) {
          throw new Error('Anda tidak memiliki akses untuk mengubah pengguna lain')
        }
        await authService.updateUser(editingId, form)
        await auditService.log('UPDATE_USER', `Mengubah pengguna ${form.username}`)
        toastService.success(`Pengguna ${form.username} berhasil diubah`)
      } else {
        // Check permission to create
        if (!rbacService.canCreateUser(currentUser.role)) {
          throw new Error('Anda tidak memiliki akses untuk membuat pengguna')
        }
        await authService.createUser(form)
        await auditService.log('CREATE_USER', `Menambah pengguna ${form.username}`)
        toastService.success(`Pengguna ${form.username} berhasil ditambahkan`)
      }
      setShowModal(false)
      setForm({ username: '', password: '', nama: '', role: 'STAFF', email: '' })
      setEditingId(null)
      await loadData()
    } catch (err) {
      setError(err.message)
      toastService.error(err.message)
    }
  }

  const handleEdit = (user) => {
    if (!rbacService.canCreateUser(currentUser.role)) {
      toastService.error('Anda tidak memiliki akses untuk mengubah pengguna')
      return
    }
    setEditingId(user.id)
    setForm({
      username: user.username,
      password: '',
      nama: user.nama,
      role: user.role,
      email: user.email || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (user) => {
    if (!rbacService.canDeleteUser(currentUser.role)) {
      toastService.error('Anda tidak memiliki akses untuk menghapus pengguna')
      return
    }
    if (user.id === 1 || user.username === 'admin') {
      toastService.warning('Tidak dapat menghapus akun admin utama')
      return
    }
    if (confirm(`Hapus pengguna "${user.nama}"?`)) {
      try {
        await authService.deleteUser(user.id)
        await auditService.log('DELETE_USER', `Menghapus pengguna ${user.username}`)
        toastService.success(`Pengguna ${user.username} berhasil dihapus`)
        await loadData()
      } catch (err) {
        toastService.error(err.message)
      }
    }
  }

  const handleClearLogs = async () => {
    if (confirm('Hapus semua log aktivitas?')) {
      try {
        await auditService.clear()
        await loadData()
        toastService.success('Log aktivitas berhasil dihapus')
      } catch (err) {
        toastService.error(err.message)
      }
    }
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Memuat pengaturan...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Pengaturan</h1>
        <p className="text-gray-500 mt-1">Manajemen pengguna dan audit trail</p>
      </div>

      {/* Manajemen Pengguna */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800">Manajemen Pengguna</h2>
          </div>
          <button
            onClick={() => {
              setEditingId(null)
              setForm({ username: '', password: '', nama: '', role: 'STAFF', email: '' })
              setError('')
              setShowModal(true)
            }}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25 text-sm"
          >
            <Plus className="w-4 h-4" />
            Tambah Pengguna
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Username</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Role</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Belum ada pengguna terdaftar
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{user.nama}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.username}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-brand-50 text-brand-700 border border-brand-100'
                      }`}>
                        <Shield className="w-3 h-3" />
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800">Audit Trail</h2>
          </div>
          <button
            onClick={handleClearLogs}
            className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Bersihkan Log
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Waktu</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pengguna</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Aksi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Belum ada log aktivitas
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id || `${log.timestamp}-${log.action}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(log.timestamp).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{log.user}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{log.role}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{log.detail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah/Edit Pengguna */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingId ? 'Edit Pengguna' : 'Tambah Pengguna'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  className={`${inputClass} ${formErrors.nama ? 'border-red-500' : ''}`}
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  required
                />
                {formErrors.nama && <p className="text-red-500 text-sm mt-1">{formErrors.nama}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input
                  type="text"
                  className={`${inputClass} ${formErrors.username ? 'border-red-500' : ''}`}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
                {formErrors.username && <p className="text-red-500 text-sm mt-1">{formErrors.username}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password {editingId ? '(Opsional)' : '*'}</label>
                <input
                  type="password"
                  className={`${inputClass} ${formErrors.password ? 'border-red-500' : ''}`}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editingId ? 'Isi untuk mengubah password' : ''}
                  required={!editingId}
                />
                {formErrors.password && <p className="text-red-500 text-sm mt-1">{formErrors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className={`${inputClass} ${formErrors.email ? 'border-red-500' : ''}`}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                {formErrors.email && <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  className={inputClass}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25"
                >
                  {editingId ? 'Simpan Perubahan' : 'Tambah Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Pengaturan