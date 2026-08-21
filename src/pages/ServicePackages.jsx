import { useEffect, useState } from 'react'
import { servicePackageService } from '../services/servicePackageService'
import { db } from '../services/database'
import { toastService } from '../services/toastService'
import { soundService } from '../services/soundService'
import { formatRupiah } from '../utils/format'
import { Plus, Search, Pencil, Trash2, Package, Clock, Tag, Download } from 'lucide-react'

function ServicePackages() {
  const [packages, setPackages] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPackage, setEditingPackage] = useState(null)
  const [form, setForm] = useState({
    kode: '', nama: '', deskripsi: '', harga: 0, estimasiDurasi: 0, kategori: ''
  })

  const loadData = async () => {
    try {
      const data = await servicePackageService.getAll()
      setPackages(data || [])
    } catch (error) {
      console.error('Failed to load service packages:', error)
      toastService.error('Gagal memuat data service package')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const handleDBChange = (e) => {
      const { table } = e.detail || {}
      if (!table || table === db.keys.SERVICE_PACKAGES) loadData()
    }
    window.addEventListener(db.changeEvent, handleDBChange)
    return () => window.removeEventListener(db.changeEvent, handleDBChange)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nama.trim()) {
      toastService.error('Nama service package wajib diisi')
      return
    }
    try {
      if (editingPackage) {
        await servicePackageService.update(editingPackage.id, form)
        toastService.success('Service package berhasil diupdate')
      } else {
        await servicePackageService.create(form)
        toastService.success('Service package berhasil ditambahkan')
      }
      soundService.success()
      setShowModal(false)
      setEditingPackage(null)
      setForm({ kode: '', nama: '', deskripsi: '', harga: 0, estimasiDurasi: 0, kategori: '' })
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleEdit = (pkg) => {
    setEditingPackage(pkg)
    setForm({
      kode: pkg.kode || '',
      nama: pkg.nama || '',
      deskripsi: pkg.deskripsi || '',
      harga: pkg.harga || 0,
      estimasiDurasi: pkg.estimasiDurasi || 0,
      kategori: pkg.kategori || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (pkg) => {
    if (!confirm(`Hapus service package "${pkg.nama}"?`)) return
    try {
      await servicePackageService.delete(pkg.id)
      toastService.success('Service package berhasil dihapus')
      soundService.success()
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleExport = () => {
    const { headers, rows, filename } = servicePackageService.exportToCSV(packages)
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    toastService.success('Data service package berhasil diexport')
  }

  const filteredPackages = servicePackageService.search(search, packages)
  const categories = servicePackageService.getCategories(packages)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Manajemen Service Package</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Kelola paket layanan bengkel</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
          <button
            onClick={() => { setEditingPackage(null); setForm({ kode: '', nama: '', deskripsi: '', harga: 0, estimasiDurasi: 0, kategori: '' }); setShowModal(true) }}
            className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Package</span>
            <span className="sm:hidden">Tambah</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, kode, deskripsi, kategori..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Package</p>
              <p className="text-lg font-bold text-gray-800">{packages.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Tag className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Kategori</p>
              <p className="text-lg font-bold text-gray-800">{categories.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Rata-rata Durasi</p>
              <p className="text-lg font-bold text-gray-800">
                {packages.length > 0
                  ? Math.round(packages.reduce((sum, p) => sum + Number(p.estimasiDurasi || 0), 0) / packages.length)
                  : 0} mnt
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Deskripsi</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Harga</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Durasi</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Kategori</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : filteredPackages.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Belum ada data service package</td></tr>
              ) : (
                filteredPackages.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">{p.kode}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{p.nama}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{p.deskripsi || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{formatRupiah(p.harga || 0)}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{p.estimasiDurasi || 0} mnt</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-medium">
                        {p.kategori || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingPackage ? 'Edit Service Package' : 'Tambah Service Package'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kode</label>
                <input
                  type="text"
                  value={form.kode}
                  onChange={(e) => setForm({ ...form, kode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama *</label>
                <input
                  type="text"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea
                  value={form.deskripsi}
                  onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga</label>
                  <input
                    type="number"
                    value={form.harga}
                    onChange={(e) => setForm({ ...form, harga: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimasi (menit)</label>
                  <input
                    type="number"
                    value={form.estimasiDurasi}
                    onChange={(e) => setForm({ ...form, estimasiDurasi: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <input
                  type="text"
                  value={form.kategori}
                  onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Contoh: Rutin, Perbaikan, AC"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingPackage(null) }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                >
                  {editingPackage ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ServicePackages