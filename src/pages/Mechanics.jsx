import { useEffect, useState } from 'react'
import { mechanicService } from '../services/mechanicService'
import { db } from '../services/database'
import { toastService } from '../services/toastService'
import { soundService } from '../services/soundService'
import { formatRupiah } from '../utils/format'
import { Plus, Search, Pencil, Trash2, Wrench, Mail, Download } from 'lucide-react'

function Mechanics() {
  const [mechanics, setMechanics] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMechanic, setEditingMechanic] = useState(null)
  const [form, setForm] = useState({
    kode: '', nama: '', keahlian: '', telepon: '', email: '', tarifPerJam: 0, status: 'AKTIF'
  })

  const loadData = async () => {
    try {
      const data = await mechanicService.getAll()
      setMechanics(data || [])
    } catch (error) {
      console.error('Failed to load mechanics:', error)
      toastService.error('Gagal memuat data teknisi')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const handleDBChange = (e) => {
      const { table } = e.detail || {}
      if (!table || table === db.keys.MECHANICS) loadData()
    }
    window.addEventListener(db.changeEvent, handleDBChange)
    return () => window.removeEventListener(db.changeEvent, handleDBChange)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nama.trim()) {
      toastService.error('Nama teknisi wajib diisi')
      return
    }
    try {
      if (editingMechanic) {
        await mechanicService.update(editingMechanic.id, form)
        toastService.success('Teknisi berhasil diupdate')
      } else {
        await mechanicService.create(form)
        toastService.success('Teknisi berhasil ditambahkan')
      }
      soundService.success()
      setShowModal(false)
      setEditingMechanic(null)
      setForm({ kode: '', nama: '', keahlian: '', telepon: '', email: '', tarifPerJam: 0, status: 'AKTIF' })
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleEdit = (mechanic) => {
    setEditingMechanic(mechanic)
    setForm({
      kode: mechanic.kode || '', nama: mechanic.nama || '', keahlian: mechanic.keahlian || '',
      telepon: mechanic.telepon || '', email: mechanic.email || '',
      tarifPerJam: mechanic.tarifPerJam || 0, status: mechanic.status || 'AKTIF'
    })
    setShowModal(true)
  }

  const handleDelete = async (mechanic) => {
    if (!confirm(`Hapus teknisi "${mechanic.nama}"?`)) return
    try {
      await mechanicService.delete(mechanic.id)
      toastService.success('Teknisi berhasil dihapus')
      soundService.success()
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleExport = () => {
    const { headers, rows, filename } = mechanicService.exportToCSV(mechanics)
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    toastService.success('Data teknisi berhasil diexport')
  }

  const filteredMechanics = mechanicService.search(search, mechanics)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Manajemen Teknisi</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Kelola data teknisi bengkel</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button onClick={handleExport} className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
          <button onClick={() => { setEditingMechanic(null); setForm({ kode: '', nama: '', keahlian: '', telepon: '', email: '', tarifPerJam: 0, status: 'AKTIF' }); setShowModal(true) }} className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25 text-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Teknisi</span>
            <span className="sm:hidden">Tambah</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, kode, keahlian, telepon..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center"><Wrench className="w-5 h-5 text-brand-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Teknisi</p>
              <p className="text-lg font-bold text-gray-800">{mechanics.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center"><Wrench className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Teknisi Aktif</p>
              <p className="text-lg font-bold text-gray-800">{mechanics.filter(m => m.status === 'AKTIF').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center"><Mail className="w-5 h-5 text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Dengan Email</p>
              <p className="text-lg font-bold text-gray-800">{mechanics.filter(m => m.email).length}</p>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Keahlian</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Telepon</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Tarif/Jam</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : filteredMechanics.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Belum ada data teknisi</td></tr>
              ) : (
                filteredMechanics.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">{m.kode}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{m.nama}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{m.keahlian || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{m.telepon || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{m.email || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{formatRupiah(m.tarifPerJam || 0)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${m.status === 'AKTIF' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {m.status || 'AKTIF'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(m)} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(m)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">{editingMechanic ? 'Edit Teknisi' : 'Tambah Teknisi'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kode</label>
                <input type="text" value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama *</label>
                <input type="text" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keahlian</label>
                <input type="text" value={form.keahlian} onChange={(e) => setForm({ ...form, keahlian: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                <input type="text" value={form.telepon} onChange={(e) => setForm({ ...form, telepon: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tarif/Jam</label>
                  <input type="number" value={form.tarifPerJam} onChange={(e) => setForm({ ...form, tarifPerJam: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500">
                    <option value="AKTIF">AKTIF</option>
                    <option value="TIDAK_AKTIF">TIDAK AKTIF</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingMechanic(null) }} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">Batal</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">{editingMechanic ? 'Update' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Mechanics