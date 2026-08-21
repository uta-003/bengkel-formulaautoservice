import { useEffect, useState } from 'react'
import { warrantyService, WARRANTY_JENIS, WARRANTY_JENIS_LABELS, WARRANTY_STATUS, WARRANTY_STATUS_LABELS, WARRANTY_STATUS_COLORS } from '../services/warrantyService'
import { customerService } from '../services/customerService'
import { vehicleService } from '../services/vehicleService'
import { workOrderService } from '../services/workOrderService'
import { sparepartService } from '../services/sparepartService'
import { db } from '../services/database'
import { toastService } from '../services/toastService'
import { soundService } from '../services/soundService'
import { formatDate } from '../utils/format'
import { Plus, Search, Pencil, Trash2, Shield, Download, CheckCircle2, XCircle } from 'lucide-react'

function Warranties() {
  const [warranties, setWarranties] = useState([])
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [spareparts, setSpareparts] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [jenisFilter, setJenisFilter] = useState('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingWarranty, setEditingWarranty] = useState(null)
  const [form, setForm] = useState({
    kode: '', jenis: WARRANTY_JENIS.SERVICE, judul: '', deskripsi: '',
    customerId: '', vehicleId: '', workOrderId: '', sparepartId: '',
    tanggalMulai: new Date().toISOString().slice(0, 10), tanggalBerakhir: '', status: WARRANTY_STATUS.AKTIF
  })

  const loadData = async () => {
    try {
      const [warData, custData, vehData, woData, spData] = await Promise.all([
        warrantyService.getAll(),
        customerService.getAll(),
        vehicleService.getAll(),
        workOrderService.getAll(),
        sparepartService.getAll()
      ])
      setWarranties(warData || [])
      setCustomers(custData || [])
      setVehicles(vehData || [])
      setWorkOrders(woData || [])
      setSpareparts(spData || [])
    } catch (error) {
      console.error('Failed to load warranties:', error)
      toastService.error('Gagal memuat data garansi')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const handleDBChange = (e) => {
      const { table } = e.detail || {}
      if (!table || [db.keys.WARRANTIES, db.keys.CUSTOMERS, db.keys.VEHICLES, db.keys.WORK_ORDERS, db.keys.SPAREPARTS].includes(table)) {
        loadData()
      }
    }
    window.addEventListener(db.changeEvent, handleDBChange)
    return () => window.removeEventListener(db.changeEvent, handleDBChange)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.judul.trim()) {
      toastService.error('Judul garansi wajib diisi')
      return
    }
    if (!form.customerId) {
      toastService.error('Pilih pelanggan terlebih dahulu')
      return
    }
    if (!form.vehicleId) {
      toastService.error('Pilih kendaraan terlebih dahulu')
      return
    }
    if (!form.tanggalBerakhir) {
      toastService.error('Tanggal berakhir harus diisi')
      return
    }
    try {
      // Konversi tanggal ke ISO
      const submitData = {
        ...form,
        tanggalMulai: new Date(form.tanggalMulai).toISOString(),
        tanggalBerakhir: new Date(form.tanggalBerakhir).toISOString(),
        // Pastikan jenis ID dan role referensi yang benar
        sparepartId: form.jenis === WARRANTY_JENIS.SPAREPART ? form.sparepartId : null,
        workOrderId: form.jenis === WARRANTY_JENIS.SERVICE ? form.workOrderId : null
      }
      if (editingWarranty) {
        await warrantyService.update(editingWarranty.id, submitData)
        toastService.success('Garansi berhasil diupdate')
      } else {
        await warrantyService.create(submitData)
        toastService.success('Garansi berhasil ditambahkan')
      }
      soundService.success()
      setShowModal(false)
      setEditingWarranty(null)
      setForm({
        kode: '', jenis: WARRANTY_JENIS.SERVICE, judul: '', deskripsi: '',
        customerId: '', vehicleId: '', workOrderId: '', sparepartId: '',
        tanggalMulai: new Date().toISOString().slice(0, 10), tanggalBerakhir: '', status: WARRANTY_STATUS.AKTIF
      })
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleEdit = (w) => {
    setEditingWarranty(w)
    setForm({
      kode: w.kode || '',
      jenis: w.jenis || WARRANTY_JENIS.SERVICE,
      judul: w.judul || '',
      deskripsi: w.deskripsi || '',
      customerId: w.customerId || '',
      vehicleId: w.vehicleId || '',
      workOrderId: w.workOrderId || '',
      sparepartId: w.sparepartId || '',
      tanggalMulai: w.tanggalMulai ? new Date(w.tanggalMulai).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      tanggalBerakhir: w.tanggalBerakhir ? new Date(w.tanggalBerakhir).toISOString().slice(0, 10) : '',
      status: w.status || WARRANTY_STATUS.AKTIF
    })
    setShowModal(true)
  }

  const handleDelete = async (w) => {
    if (!confirm(`Hapus garansi "${w.judul}"?`)) return
    try {
      await warrantyService.delete(w.id)
      toastService.success('Garansi berhasil dihapus')
      soundService.success()
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleStatusChange = async (w, newStatus) => {
    try {
      if (newStatus === WARRANTY_STATUS.CLAIMED) {
        await warrantyService.claim(w.id)
      } else if (newStatus === WARRANTY_STATUS.CANCELLED) {
        await warrantyService.cancel(w.id)
      } else {
        await warrantyService.update(w.id, { status: newStatus })
      }
      toastService.success(`Status diubah ke ${WARRANTY_STATUS_LABELS[newStatus]}`)
      soundService.success()
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleExport = () => {
    const { headers, rows, filename } = warrantyService.exportToCSV(warranties)
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    toastService.success('Data garansi berhasil diexport')
  }

  const filteredWarranties = warrantyService.filterByJenis(jenisFilter, warrantyService.filterByStatus(statusFilter, warrantyService.search(search, warranties)))
  const statusStats = warrantyService.getStatusStats(warranties)

  const getVehiclesForCustomer = (customerId) => {
    if (!customerId) return []
    return vehicles.filter(v => Number(v.customerId) === Number(customerId))
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Manajemen Garansi</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Kelola garansi service & sparepart</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button onClick={handleExport} className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
          <button onClick={() => { setEditingWarranty(null); setForm({ kode: '', jenis: WARRANTY_JENIS.SERVICE, judul: '', deskripsi: '', customerId: '', vehicleId: '', workOrderId: '', sparepartId: '', tanggalMulai: new Date().toISOString().slice(0, 10), tanggalBerakhir: '', status: WARRANTY_STATUS.AKTIF }); setShowModal(true) }} className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25 text-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Garansi</span>
            <span className="sm:hidden">Tambah</span>
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode, judul, pelanggan, kendaraan, sparepart..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Filter Jenis */}
          <select value={jenisFilter} onChange={(e) => setJenisFilter(e.target.value)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="ALL">Semua Jenis</option>
            {Object.entries(WARRANTY_JENIS).map(([key, value]) => (
              <option key={key} value={value}>{WARRANTY_JENIS_LABELS[value]}</option>
            ))}
          </select>
          {/* Filter Status */}
          <button onClick={() => setStatusFilter('ALL')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === 'ALL' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Semua ({warranties.length})
          </button>
          {Object.entries(WARRANTY_STATUS).map(([key, value]) => (
            <button key={key} onClick={() => setStatusFilter(value)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === value ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {WARRANTY_STATUS_LABELS[value]} ({statusStats[value] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center"><Shield className="w-5 h-5 text-brand-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Garansi</p>
              <p className="text-lg font-bold text-gray-800">{warranties.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Aktif</p>
              <p className="text-lg font-bold text-gray-800">{statusStats[WARRANTY_STATUS.AKTIF] || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center"><XCircle className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Kadaluarsa</p>
              <p className="text-lg font-bold text-gray-800">{statusStats[WARRANTY_STATUS.EXPIRED] || 0}</p>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Jenis</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Judul</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pelanggan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kendaraan</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Tanggal Mulai</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Tanggal Berakhir</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : filteredWarranties.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Belum ada data garansi</td></tr>
              ) : (
                filteredWarranties.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold text-brand-600">{w.kode}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{WARRANTY_JENIS_LABELS[w.jenis] || w.jenis}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{w.judul}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{w.customer?.nama || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {w.vehicle ? `${w.vehicle.merk || ''} ${w.vehicle.tipe || ''} (${w.vehicle.platNomor || ''})` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{formatDate(w.tanggalMulai)}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{formatDate(w.tanggalBerakhir)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${WARRANTY_STATUS_COLORS[w.status] || 'bg-gray-100 text-gray-600'}`}>
                        {WARRANTY_STATUS_LABELS[w.status] || w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleEdit(w)} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                        {w.status === WARRANTY_STATUS.AKTIF && (
                          <button onClick={() => handleStatusChange(w, WARRANTY_STATUS.CLAIMED)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Klaim"><CheckCircle2 className="w-4 h-4" /></button>
                        )}
                        <button
                          onClick={() => handleStatusChange(w, WARRANTY_STATUS.CANCELLED)}
                          className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Batalkan"
                          disabled={w.status === WARRANTY_STATUS.CANCELLED || w.status === WARRANTY_STATUS.EXPIRED}
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(w)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">{editingWarranty ? 'Edit Garansi' : 'Tambah Garansi'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kode</label>
                <input type="text" value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="Otomatis jika kosong" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis *</label>
                <select value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value, workOrderId: '', sparepartId: '' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" required>
                  {Object.entries(WARRANTY_JENIS).map(([key, value]) => (
                    <option key={key} value={value}>{WARRANTY_JENIS_LABELS[value]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul *</label>
                <input type="text" value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="Contoh: Garansi AC" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pelanggan *</label>
                <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, vehicleId: '' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" required>
                  <option value="">-- Pilih Pelanggan --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.nama} ({c.kode})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kendaraan *</label>
                <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" required disabled={!form.customerId}>
                  <option value="">{form.customerId ? '-- Pilih Kendaraan --' : 'Pilih pelanggan dulu'}</option>
                  {getVehiclesForCustomer(form.customerId).map(v => (
                    <option key={v.id} value={v.id}>{v.platNomor} - {v.merk || ''} {v.tipe || ''}</option>
                  ))}
                </select>
              </div>
              {form.jenis === WARRANTY_JENIS.SERVICE && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Order</label>
                  <select value={form.workOrderId} onChange={(e) => setForm({ ...form, workOrderId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500">
                    <option value="">-- Pilih Work Order --</option>
                    {workOrders.filter(wo => !form.vehicleId || Number(wo.vehicleId) === Number(form.vehicleId)).map(wo => (
                      <option key={wo.id} value={wo.id}>{wo.nomorWo} ({formatDate(wo.tanggalMasuk)})</option>
                    ))}
                  </select>
                </div>
              )}
              {form.jenis === WARRANTY_JENIS.SPAREPART && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sparepart</label>
                  <select value={form.sparepartId} onChange={(e) => setForm({ ...form, sparepartId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500">
                    <option value="">-- Pilih Sparepart --</option>
                    {spareparts.map(sp => (
                      <option key={sp.id} value={sp.id}>{sp.nama} ({sp.kode})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
                  <input type="date" value={form.tanggalMulai} onChange={(e) => setForm({ ...form, tanggalMulai: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Berakhir *</label>
                  <input type="date" value={form.tanggalBerakhir} onChange={(e) => setForm({ ...form, tanggalBerakhir: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" required />
                </div>
              </div>
              {editingWarranty && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500">
                    {Object.entries(WARRANTY_STATUS).map(([key, value]) => (
                      <option key={key} value={value}>{WARRANTY_STATUS_LABELS[value]}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingWarranty(null) }} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">Batal</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">{editingWarranty ? 'Update' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Warranties