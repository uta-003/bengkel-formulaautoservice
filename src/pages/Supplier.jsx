import { useEffect, useState } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Truck,
  Phone,
  Mail,
  MapPin,
  X
} from 'lucide-react'
import { supplierService } from '../services/supplierService'
import { sparepartService } from '../services/sparepartService'
import { authService } from '../services/authService'
import { rbacService } from '../services/rbacService'
import { toastService } from '../services/toastService'
import { db } from '../services/database'
import { soundService } from '../services/soundService'

const emptyForm = {
  kode: '',
  nama: '',
  alamat: '',
  telepon: '',
  email: '',
  kontak: ''
}

function Supplier() {
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [sparepartCounts, setSparepartCounts] = useState({})

  const currentUser = authService.getCurrentUser()
  const canCreate = rbacService.canCreateSparepart(currentUser?.role)

  const loadData = async () => {
    try {
      const [suppliersData, sparepartsData] = await Promise.all([
        supplierService.getAll(),
        sparepartService.getAll()
      ])

      const stats = supplierService.getStats(suppliersData || [], sparepartsData || [])
      setSuppliers(stats)

      const counts = {}
      ;(sparepartsData || []).forEach(sp => {
        const supplierId = Number(sp.supplierId ?? sp.supplier_id)
        counts[supplierId] = (counts[supplierId] || 0) + 1
      })
      setSparepartCounts(counts)
    } catch (error) {
      console.error('Failed to load supplier data:', error)
      toastService.error('Gagal memuat data supplier')
      setSuppliers([])
      setSparepartCounts({})
    }
  }

  useEffect(() => {
    loadData()

    // Listen untuk perubahan data realtime dari perangkat lain
    const handleDBChange = (e) => {
      const { table: changedTable } = e.detail || {}
      if (!changedTable || changedTable === db.keys.SUPPLIERS || changedTable === db.keys.SPAREPARTS) {
        loadData()
      }
    }

    window.addEventListener(db.changeEvent, handleDBChange)

    return () => {
      window.removeEventListener(db.changeEvent, handleDBChange)
    }
  }, [])

  const filteredSuppliers = search
    ? supplierService.search(search, suppliers)
    : suppliers

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.nama) {
      setError('Nama supplier wajib diisi')
      return
    }
    if (!form.telepon) {
      setError('Telepon wajib diisi')
      return
    }

    const data = { ...form }

    try {
      if (editingId) {
        await supplierService.update(editingId, data)
        toastService.success(`Supplier "${form.nama}" berhasil diubah`)
        soundService.edit()
      } else {
        await supplierService.create(data)
        toastService.success(`Supplier "${form.nama}" berhasil ditambahkan`)
        soundService.add()
      }

      setShowModal(false)
      setForm(emptyForm)
      setEditingId(null)
      loadData()
    } catch (err) {
      setError(err.message)
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleEdit = (s) => {
    setEditingId(s.id)
    setForm({
      kode: s.kode,
      nama: s.nama,
      alamat: s.alamat || '',
      telepon: s.telepon,
      email: s.email || '',
      kontak: s.kontak || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (s) => {
    if (sparepartCounts[s.id] > 0) {
      toastService.warning(`Tidak dapat menghapus supplier "${s.nama}" karena masih memiliki ${sparepartCounts[s.id]} sparepart terkait.`)
      soundService.warning()
      return
    }
    if (confirm(`Hapus supplier "${s.nama}"?`)) {
      try {
        await supplierService.delete(s.id)
        toastService.success(`Supplier "${s.nama}" berhasil dihapus`)
        soundService.delete()
        loadData()
      } catch (err) {
        toastService.error(err.message)
        soundService.error()
      }
    }
  }

  const handleAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setShowModal(true)
    soundService.click()
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Manajemen Supplier</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Kelola data supplier sparepart</p>
        </div>
        {canCreate && (
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25 text-sm"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Tambah Supplier
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Cari berdasarkan nama, kode, kontak, atau email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {/* Grid Supplier */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
          <Truck className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">Tidak Ada Supplier</h2>
          <p className="text-gray-500 text-sm sm:text-base">Tambahkan supplier untuk mengelola pemasok sparepart.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredSuppliers.map((s) => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-50 rounded-lg flex items-center justify-center border border-brand-100 shrink-0">
                    <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-800 text-sm sm:text-base truncate-mobile">{s.nama}</h3>
                    <p className="text-xs text-gray-500">{s.kode}</p>
                  </div>
                </div>
                {canCreate && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleEdit(s)}
                      className="p-1.5 sm:p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors touch-target"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-target"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs sm:text-sm">
                {s.kontak && (
                  <p className="flex items-center gap-2 text-gray-600 truncate-mobile">
                    <Truck className="w-4 h-4 text-gray-400 shrink-0" />
                    {s.kontak}
                  </p>
                )}
                {s.telepon && (
                  <p className="flex items-center gap-2 text-gray-600 truncate-mobile">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                    {s.telepon}
                  </p>
                )}
                {s.email && (
                  <p className="flex items-center gap-2 text-gray-600 truncate-mobile">
                    <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                    {s.email}
                  </p>
                )}
                {s.alamat && (
                  <p className="flex items-start gap-2 text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <span className="truncate-mobile">{s.alamat}</span>
                  </p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Sparepart Terkait</span>
                  <span className="text-sm font-semibold text-brand-600">
                    {sparepartCounts[s.id] || 0} item
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto modal-mobile">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                {editingId ? 'Edit Supplier' : 'Tambah Supplier'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 touch-target">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kode Supplier</label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.kode}
                  onChange={(e) => setForm({ ...form, kode: e.target.value })}
                  placeholder="Otomatis jika kosong"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Perusahaan *</label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kontak</label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.kontak}
                  onChange={(e) => setForm({ ...form, kontak: e.target.value })}
                  placeholder="Nama person yang dihubungi"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telepon *</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.telepon}
                    onChange={(e) => setForm({ ...form, telepon: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    className={inputClass}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                <textarea
                  className={inputClass}
                  rows="3"
                  value={form.alamat}
                  onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                  placeholder="Alamat lengkap supplier"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white pb-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors touch-target"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25 touch-target"
                >
                  {editingId ? 'Simpan Perubahan' : 'Tambah Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Supplier
