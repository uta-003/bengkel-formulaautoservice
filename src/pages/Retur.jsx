import { useEffect, useState } from 'react'
import {
  Plus,
  Search,
  Trash2,
  Undo2,
  X,
  CheckCircle2,
  Ban,
  PackageCheck,
  Clock,
  Download,
  AlertTriangle
} from 'lucide-react'
import {
  returnService,
  RETURN_TIPE,
  RETURN_TIPE_LABELS,
  RETURN_STATUS,
  RETURN_STATUS_LABELS,
  RETURN_STATUS_COLORS,
  ALASAN_RETUR
} from '../services/returnService'
import { sparepartService } from '../services/sparepartService'
import { authService } from '../services/authService'
import { rbacService } from '../services/rbacService'
import { toastService } from '../services/toastService'
import { db } from '../services/database'
import { soundService } from '../services/soundService'
import { formatRupiah } from '../utils/format'

const emptyForm = {
  tipe: RETURN_TIPE.KE_SUPPLIER,
  sparepartId: '',
  supplierId: '',
  customerId: '',
  jumlah: '',
  hargaSatuan: '',
  alasan: '',
  catatan: ''
}

function Retur() {
  const [returns, setReturns] = useState([])
  const [spareparts, setSpareparts] = useState([])
  const [search, setSearch] = useState('')
  const [filterTipe, setFilterTipe] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const currentUser = authService.getCurrentUser()
  const canCreate = rbacService.canCreateTransaction(currentUser?.role) ||
    rbacService.canCreateSparepart(currentUser?.role)

  const loadData = async () => {
    try {
      const [returnsData, sparepartsData] = await Promise.all([
        returnService.getAll(),
        sparepartService.getAll()
      ])
      setReturns(returnsData || [])
      setSpareparts(sparepartsData || [])
    } catch (err) {
      console.error('Gagal memuat data retur:', err)
      toastService.error('Gagal memuat data retur')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const handleDBChange = (e) => {
      const { table: changedTable } = e.detail || {}
      if (!changedTable ||
          changedTable === db.keys.RETURNS ||
          changedTable === db.keys.SPAREPARTS ||
          changedTable === db.keys.TRANSACTIONS) {
        loadData()
      }
    }

    window.addEventListener(db.changeEvent, handleDBChange)
    return () => window.removeEventListener(db.changeEvent, handleDBChange)
  }, [])

  let filtered = filterTipe !== 'ALL' ? returnService.filterByTipe(filterTipe, returns) : returns
  filtered = filterStatus !== 'ALL' ? returnService.filterByStatus(filterStatus, filtered) : filtered
  if (search) filtered = returnService.search(search, filtered)

  const stats = returnService.getStatusStats(returns)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.sparepartId) {
      setError('Sparepart wajib dipilih')
      return
    }
    if (!form.jumlah || Number(form.jumlah) <= 0) {
      setError('Jumlah retur harus lebih dari 0')
      return
    }

    try {
      await returnService.create({
        ...form,
        jumlah: Number(form.jumlah),
        hargaSatuan: form.hargaSatuan ? Number(form.hargaSatuan) : undefined
      })
      toastService.success('Retur berhasil dibuat (status: Menunggu)')
      soundService.add()
      setShowModal(false)
      setForm(emptyForm)
      loadData()
    } catch (err) {
      setError(err.message)
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleApprove = async (r) => {
    if (!confirm(`Setujui retur ${r.nomorRetur}? Stok akan disesuaikan otomatis.`)) return
    try {
      await returnService.approve(r.id)
      toastService.success(`Retur ${r.nomorRetur} disetujui & stok disesuaikan`)
      soundService.success()
      loadData()
    } catch (err) {
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleReject = async (r) => {
    if (!confirm(`Tolak retur ${r.nomorRetur}?`)) return
    try {
      await returnService.reject(r.id)
      toastService.info(`Retur ${r.nomorRetur} ditolak`)
      loadData()
    } catch (err) {
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleComplete = async (r) => {
    try {
      await returnService.complete(r.id)
      toastService.success(`Retur ${r.nomorRetur} ditandai selesai`)
      soundService.success()
      loadData()
    } catch (err) {
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleDelete = async (r) => {
    if (!confirm(`Hapus retur ${r.nomorRetur}?`)) return
    try {
      await returnService.delete(r.id)
      toastService.success('Retur berhasil dihapus')
      soundService.delete()
      loadData()
    } catch (err) {
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleExportCSV = () => {
    const { headers, rows, filename } = returnService.exportToCSV(filtered)
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toastService.success('CSV berhasil diunduh')
  }

  const selectedSparepart = spareparts.find(sp => Number(sp.id) === Number(form.sparepartId))

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Undo2 className="w-6 h-6 text-brand-600" />
            Retur Barang
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola retur barang ke supplier & dari pelanggan</p>
        </div>
        <div className="flex gap-2 mobile-stack-buttons">
          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors touch-target disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          {canCreate && (
            <button
              onClick={() => { setForm(emptyForm); setError(''); setShowModal(true); soundService.click() }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors shadow-sm touch-target"
            >
              <Plus className="w-4 h-4" />
              Buat Retur
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-100 rounded-lg flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500">Menunggu</p>
              <p className="text-base sm:text-xl font-bold text-gray-800">{stats[RETURN_STATUS.PENDING] || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <PackageCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500">Disetujui</p>
              <p className="text-base sm:text-xl font-bold text-gray-800">{stats[RETURN_STATUS.APPROVED] || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500">Selesai</p>
              <p className="text-base sm:text-xl font-bold text-gray-800">{stats[RETURN_STATUS.SELESAI] || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
              <Ban className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500">Ditolak</p>
              <p className="text-base sm:text-xl font-bold text-gray-800">{stats[RETURN_STATUS.REJECTED] || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & search */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor retur, sparepart, supplier..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <select
            value={filterTipe}
            onChange={(e) => setFilterTipe(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
          >
            <option value="ALL">Semua Tipe</option>
            <option value={RETURN_TIPE.KE_SUPPLIER}>Ke Supplier</option>
            <option value={RETURN_TIPE.DARI_CUSTOMER}>Dari Pelanggan</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
          >
            <option value="ALL">Semua Status</option>
            {Object.values(RETURN_STATUS).map(s => (
              <option key={s} value={s}>{RETURN_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabel desktop */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="table-responsive">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">No. Retur</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tipe</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Sparepart</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tujuan/Asal</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Jumlah</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Nilai</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-400">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-400">Belum ada data retur.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{r.nomorRetur}</p>
                    <p className="text-xs text-gray-400">{new Date(r.tanggalRetur).toLocaleDateString('id-ID')}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{RETURN_TIPE_LABELS[r.tipe]}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 truncate max-w-[180px]">{r.sparepart?.nama || '-'}</p>
                    <p className="text-xs text-gray-400">{r.sparepart?.kode || ''}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.tipe === RETURN_TIPE.KE_SUPPLIER ? (r.supplier?.nama || '-') : (r.customer?.nama || '-')}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{r.jumlah}</td>
                  <td className="px-4 py-3 text-right">{formatRupiah(r.total || 0)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${RETURN_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                      {RETURN_STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {r.status === RETURN_STATUS.PENDING && canCreate && (
                        <>
                          <button onClick={() => handleApprove(r)} title="Setujui"
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleReject(r)} title="Tolak"
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Ban className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {r.status === RETURN_STATUS.APPROVED && canCreate && (
                        <button onClick={() => handleComplete(r)} title="Tandai Selesai"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <PackageCheck className="w-4 h-4" />
                        </button>
                      )}
                      {(r.status === RETURN_STATUS.PENDING || r.status === RETURN_STATUS.REJECTED || r.status === RETURN_STATUS.SELESAI) && canCreate && (
                        <button onClick={() => handleDelete(r)} title="Hapus"
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card view mobile */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">Memuat data...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">Belum ada data retur.</div>
        ) : filtered.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate-mobile">{r.nomorRetur}</p>
                <p className="text-xs text-gray-400">{new Date(r.tanggalRetur).toLocaleDateString('id-ID')}</p>
              </div>
              <span className={`shrink-0 inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${RETURN_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                {RETURN_STATUS_LABELS[r.status] || r.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-gray-400">Tipe</p>
                <p className="text-gray-700 font-medium">{RETURN_TIPE_LABELS[r.tipe]}</p>
              </div>
              <div>
                <p className="text-gray-400">{r.tipe === RETURN_TIPE.KE_SUPPLIER ? 'Supplier' : 'Pelanggan'}</p>
                <p className="text-gray-700 font-medium truncate-mobile">
                  {r.tipe === RETURN_TIPE.KE_SUPPLIER ? (r.supplier?.nama || '-') : (r.customer?.nama || '-')}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Sparepart</p>
                <p className="text-gray-700 font-medium truncate-mobile">{r.sparepart?.nama || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400">Nilai ({r.jumlah} pcs)</p>
                <p className="text-gray-700 font-medium">{formatRupiah(r.total || 0)}</p>
              </div>
            </div>
            {r.alasan && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5">Alasan: {r.alasan}</p>
            )}
            <div className="flex gap-2 pt-1">
              {r.status === RETURN_STATUS.PENDING && canCreate && (
                <>
                  <button onClick={() => handleApprove(r)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 rounded-lg active:bg-green-100">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                  </button>
                  <button onClick={() => handleReject(r)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 rounded-lg active:bg-red-100">
                    <Ban className="w-3.5 h-3.5" /> Tolak
                  </button>
                </>
              )}
              {r.status === RETURN_STATUS.APPROVED && canCreate && (
                <button onClick={() => handleComplete(r)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg active:bg-blue-100">
                  <PackageCheck className="w-3.5 h-3.5" /> Selesai
                </button>
              )}
              {(r.status === RETURN_STATUS.PENDING || r.status === RETURN_STATUS.REJECTED || r.status === RETURN_STATUS.SELESAI) && canCreate && (
                <button onClick={() => handleDelete(r)}
                  className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg active:bg-gray-200">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="modal-mobile bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-800">Buat Retur Baru</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipe Retur *</label>
                <select
                  value={form.tipe}
                  onChange={(e) => setForm({ ...form, tipe: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value={RETURN_TIPE.KE_SUPPLIER}>{RETURN_TIPE_LABELS[RETURN_TIPE.KE_SUPPLIER]}</option>
                  <option value={RETURN_TIPE.DARI_CUSTOMER}>{RETURN_TIPE_LABELS[RETURN_TIPE.DARI_CUSTOMER]}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sparepart *</label>
                <select
                  value={form.sparepartId}
                  onChange={(e) => setForm({ ...form, sparepartId: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="">-- Pilih Sparepart --</option>
                  {spareparts.map(sp => (
                    <option key={sp.id} value={sp.id}>
                      {sp.kode ? `${sp.kode} - ` : ''}{sp.nama} (stok: {sp.stok})
                    </option>
                  ))}
                </select>
                {selectedSparepart && (
                  <p className="mt-1 text-xs text-gray-500">
                    Stok saat ini: <span className="font-semibold">{selectedSparepart.stok}</span> pcs
                    {form.tipe === RETURN_TIPE.KE_SUPPLIER && Number(selectedSparepart.stok) < Number(form.jumlah || 0) && (
                      <span className="text-red-500 font-semibold"> — stok tidak cukup untuk diretur</span>
                    )}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Jumlah *</label>
                  <input
                    type="number"
                    min="1"
                    value={form.jumlah}
                    onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Harga Satuan</label>
                  <input
                    type="number"
                    min="0"
                    value={form.hargaSatuan}
                    onChange={(e) => setForm({ ...form, hargaSatuan: e.target.value })}
                    placeholder={selectedSparepart ? selectedSparepart.hargaBeli : '0'}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              {form.tipe === RETURN_TIPE.DARI_CUSTOMER && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Catatan Pelanggan (opsional)</label>
                  <input
                    type="text"
                    value={form.customerId}
                    onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                    placeholder="Nama pelanggan pengembalian"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Alasan Retur</label>
                <select
                  value={form.alasan}
                  onChange={(e) => setForm({ ...form, alasan: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="">-- Pilih Alasan --</option>
                  {Object.entries(ALASAN_RETUR).map(([key, label]) => (
                    <option key={key} value={label}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Catatan Tambahan</label>
                <textarea
                  value={form.catatan}
                  onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                  rows="2"
                  placeholder="Keterangan tambahan..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2 pb-safe">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors touch-target"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors touch-target"
                >
                  Simpan Retur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Retur