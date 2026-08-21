import { useEffect, useState } from 'react'
import { vehicleService } from '../services/vehicleService'
import { customerService } from '../services/customerService'
import { db } from '../services/database'
import { toastService } from '../services/toastService'
import { soundService } from '../services/soundService'
import { Plus, Search, Pencil, Trash2, Car, Users, Gauge, Download } from 'lucide-react'

function Vehicles() {
  const [vehicles, setVehicles] = useState([])
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [form, setForm] = useState({
    customerId: '', platNomor: '', merk: '', tipe: '', tahun: '', warna: '', kmTerakhir: 0
  })

  const loadData = async () => {
    try {
      const [vehData, custData] = await Promise.all([
        vehicleService.getAll(),
        customerService.getAll()
      ])
      setVehicles(vehData || [])
      setCustomers(custData || [])
    } catch (error) {
      console.error('Failed to load vehicles:', error)
      toastService.error('Gagal memuat data kendaraan')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const handleDBChange = (e) => {
      const { table } = e.detail || {}
      if (!table || table === db.keys.VEHICLES || table === db.keys.CUSTOMERS) {
        loadData()
      }
    }
    window.addEventListener(db.changeEvent, handleDBChange)
    return () => window.removeEventListener(db.changeEvent, handleDBChange)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.platNomor.trim()) {
      toastService.error('Plat nomor wajib diisi')
      return
    }
    if (!form.customerId) {
      toastService.error('Pilih pelanggan terlebih dahulu')
      return
    }
    try {
      if (editingVehicle) {
        await vehicleService.update(editingVehicle.id, form)
        toastService.success('Kendaraan berhasil diupdate')
      } else {
        await vehicleService.create(form)
        toastService.success('Kendaraan berhasil ditambahkan')
      }
      soundService.success()
      setShowModal(false)
      setEditingVehicle(null)
      setForm({ customerId: '', platNomor: '', merk: '', tipe: '', tahun: '', warna: '', kmTerakhir: 0 })
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle)
    setForm({
      customerId: vehicle.customerId || '',
      platNomor: vehicle.platNomor || '',
      merk: vehicle.merk || '',
      tipe: vehicle.tipe || '',
      tahun: vehicle.tahun || '',
      warna: vehicle.warna || '',
      kmTerakhir: vehicle.kmTerakhir || 0
    })
    setShowModal(true)
  }

  const handleDelete = async (vehicle) => {
    if (!confirm(`Hapus kendaraan "${vehicle.platNomor}"?`)) return
    try {
      await vehicleService.delete(vehicle.id)
      toastService.success('Kendaraan berhasil dihapus')
      soundService.success()
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleExport = () => {
    const { headers, rows, filename } = vehicleService.exportToCSV(vehicles)
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    toastService.success('Data kendaraan berhasil diexport')
  }

  const filteredVehicles = vehicleService.search(search, vehicles)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Manajemen Kendaraan</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Kelola data kendaraan pelanggan</p>
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
            onClick={() => { setEditingVehicle(null); setForm({ customerId: '', platNomor: '', merk: '', tipe: '', tahun: '', warna: '', kmTerakhir: 0 }); setShowModal(true) }}
            className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Kendaraan</span>
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
            placeholder="Cari plat nomor, merk, tipe, tahun, pelanggan..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
              <Car className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Kendaraan</p>
              <p className="text-lg font-bold text-gray-800">{vehicles.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Pelanggan</p>
              <p className="text-lg font-bold text-gray-800">{customers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Gauge className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Rata-rata KM</p>
              <p className="text-lg font-bold text-gray-800">
                {vehicles.length > 0
                  ? Math.round(vehicles.reduce((sum, v) => sum + Number(v.kmTerakhir || 0), 0) / vehicles.length).toLocaleString('id-ID')
                  : 0}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Plat Nomor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Merk / Tipe</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Tahun</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Warna</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">KM Terakhir</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pelanggan</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : filteredVehicles.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Belum ada data kendaraan</td></tr>
              ) : (
                filteredVehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">{v.platNomor}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {[v.merk, v.tipe].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{v.tahun || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{v.warna || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {Number(v.kmTerakhir || 0).toLocaleString('id-ID')} km
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{v.customer?.nama || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(v)}
                          className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
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
                {editingVehicle ? 'Edit Kendaraan' : 'Tambah Kendaraan'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pelanggan *</label>
                <select
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                >
                  <option value="">-- Pilih Pelanggan --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.nama} ({c.kode})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plat Nomor *</label>
                <input
                  type="text"
                  value={form.platNomor}
                  onChange={(e) => setForm({ ...form, platNomor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Contoh: B 1234 ABC"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Merk</label>
                  <input
                    type="text"
                    value={form.merk}
                    onChange={(e) => setForm({ ...form, merk: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Toyota"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
                  <input
                    type="text"
                    value={form.tipe}
                    onChange={(e) => setForm({ ...form, tipe: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Avanza"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tahun</label>
                  <input
                    type="text"
                    value={form.tahun}
                    onChange={(e) => setForm({ ...form, tahun: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="2020"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warna</label>
                  <input
                    type="text"
                    value={form.warna}
                    onChange={(e) => setForm({ ...form, warna: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Hitam"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KM Terakhir</label>
                <input
                  type="number"
                  value={form.kmTerakhir}
                  onChange={(e) => setForm({ ...form, kmTerakhir: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  min="0"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingVehicle(null) }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                >
                  {editingVehicle ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Vehicles