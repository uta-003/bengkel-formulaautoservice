import { useEffect, useState } from 'react'
import {
  Plus,
  Search,
  Trash2,
  X,
  CheckCircle2,
  Ban,
  ClipboardCheck,
  Download,
  AlertTriangle,
  ChevronLeft,
  Save,
  PackageSearch
} from 'lucide-react'
import {
  stockOpnameService,
  OPNAME_STATUS,
  OPNAME_STATUS_LABELS,
  OPNAME_STATUS_COLORS
} from '../services/stockOpnameService'
import { sparepartService } from '../services/sparepartService'
import { authService } from '../services/authService'
import { rbacService } from '../services/rbacService'
import { toastService } from '../services/toastService'
import { db } from '../services/database'
import { soundService } from '../services/soundService'
import { formatRupiah } from '../utils/format'

function StockOpname() {
  const [opnames, setOpnames] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState({ namaPetugas: '', kategoriFilter: '', catatan: '' })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const currentUser = authService.getCurrentUser()
  const canManage = rbacService.canCreateSparepart(currentUser?.role)

  const loadData = async () => {
    try {
      const [opnamesData, sparepartsData] = await Promise.all([
        stockOpnameService.getAll(),
        sparepartService.getAll()
      ])
      setOpnames(opnamesData || [])
      // Kategori unik untuk filter
      const cats = [...new Set((sparepartsData || []).map(sp => sp.kategori).filter(Boolean))]
      setCategories(cats)
    } catch (err) {
      console.error('Gagal memuat data stock opname:', err)
      toastService.error('Gagal memuat data stock opname')
    } finally {
      setIsLoading(false)
    }
  }

  const loadDetail = async (id) => {
    try {
      const data = await stockOpnameService.getById(id)
      setDetail(data)
    } catch {
      toastService.error('Gagal memuat detail opname')
    }
  }

  useEffect(() => {
    loadData()

    const handleDBChange = (e) => {
      const { table: changedTable } = e.detail || {}
      if (!changedTable ||
          changedTable === db.keys.STOCK_OPNAMES ||
          changedTable === db.keys.STOCK_OPNAME_ITEMS ||
          changedTable === db.keys.SPAREPARTS) {
        loadData()
        if (detailId) loadDetail(detailId)
      }
    }

    window.addEventListener(db.changeEvent, handleDBChange)
    return () => window.removeEventListener(db.changeEvent, handleDBChange)
  }, [detailId])

  const filtered = search ? stockOpnameService.search(search, opnames) : opnames

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      await stockOpnameService.create(form)
      toastService.success('Sesi stock opname berhasil dibuat')
      soundService.add()
      setShowCreateModal(false)
      setForm({ namaPetugas: '', kategoriFilter: '', catatan: '' })
      loadData()
    } catch (err) {
      setError(err.message)
      toastService.error(err.message)
      soundService.error()
    } finally {
      setIsSaving(false)
    }
  }

  const openDetail = (id) => {
    setDetailId(id)
    loadDetail(id)
  }

  const closeDetail = () => {
    setDetailId(null)
    setDetail(null)
  }

  const handleUpdateItem = async (itemId, stokFisik) => {
    if (stokFisik === '' || stokFisik === null) return
    try {
      await stockOpnameService.updateItem(itemId, { stokFisik: Number(stokFisik) })
      await loadDetail(detailId)
    } catch (err) {
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleFinalize = async () => {
    if (!confirm('Selesaikan opname? Stok sistem akan disesuaikan ke hasil hitungan fisik.')) return
    try {
      const adjusted = await stockOpnameService.finalize(detailId)
      toastService.success(`Opname selesai. ${adjusted} item stok disesuaikan.`)
      soundService.success()
      await loadDetail(detailId)
      loadData()
    } catch (err) {
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleCancel = async () => {
    if (!confirm('Batalkan sesi opname ini?')) return
    try {
      await stockOpnameService.cancel(detailId)
      toastService.info('Sesi opname dibatalkan')
      await loadDetail(detailId)
      loadData()
    } catch (err) {
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleDelete = async (o) => {
    if (!confirm(`Hapus sesi opname ${o.kodeOpname}?`)) return
    try {
      await stockOpnameService.delete(o.id)
      toastService.success('Sesi opname dihapus')
      soundService.delete()
      if (detailId === o.id) closeDetail()
      loadData()
    } catch (err) {
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleExportCSV = () => {
    const { headers, rows, filename } = stockOpnameService.exportToCSV(filtered)
    const csvContent = [headers, ...rows].map(row => row.join(',')).join(String.fromCharCode(10))
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toastService.success('CSV berhasil diunduh')
  }

  // ===== Tampilan detail opname =====
  if (detailId && detail) {
    const itemsWithDiff = (detail.items || []).filter(it => Number(it.selisih || 0) !== 0)

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Header detail */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <button onClick={closeDetail}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-1">
              <ChevronLeft className="w-4 h-4" /> Kembali
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-brand-600 shrink-0" />
              <span className="truncate-mobile">{detail.kodeOpname}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Petugas: {detail.namaPetugas || '-'} • {new Date(detail.tanggalOpname).toLocaleDateString('id-ID')}
              {detail.kategoriFilter ? ` • Kategori: ${detail.kategoriFilter}` : ' • Semua kategori'}
            </p>
          </div>
          <span className={`shrink-0 inline-block px-3 py-1.5 rounded-full text-xs font-semibold w-fit ${OPNAME_STATUS_COLORS[detail.status]}`}>
            {OPNAME_STATUS_LABELS[detail.status]}
          </span>
        </div>

        {/* Ringkasan */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
            <p className="text-[10px] sm:text-xs text-gray-500">Total Item</p>
            <p className="text-base sm:text-xl font-bold text-gray-800">{detail.totalItem}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
            <p className="text-[10px] sm:text-xs text-gray-500">Item Selisih</p>
            <p className={`text-base sm:text-xl font-bold ${itemsWithDiff.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {itemsWithDiff.length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
            <p className="text-[10px] sm:text-xs text-gray-500">Nilai Selisih</p>
            <p className={`text-base sm:text-xl font-bold ${Number(detail.totalNilaiSelisih) < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatRupiah(detail.totalNilaiSelisih || 0)}
            </p>
          </div>
        </div>

        {/* Aksi */}
        {detail.status === OPNAME_STATUS.DRAFT && canManage && (
          <div className="flex gap-2 mobile-stack-buttons">
            <button onClick={handleFinalize}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors touch-target">
              <CheckCircle2 className="w-4 h-4" />
              Selesaikan & Sesuaikan Stok
            </button>
            <button onClick={handleCancel}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors touch-target">
              <Ban className="w-4 h-4" />
              Batalkan
            </button>
          </div>
        )}

        {/* Daftar item hitungan */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="table-responsive">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Sparepart</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 w-24">Stok Sistem</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 w-28">Stok Fisik</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 w-20">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(detail.items || []).map((it) => (
                  <tr key={it.id} className={Number(it.selisih || 0) !== 0 ? 'bg-orange-50/50' : ''}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800 truncate max-w-[220px]">{it.sparepart?.nama || '-'}</p>
                      <p className="text-xs text-gray-400">{it.sparepart?.kode || ''}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{it.stokSistem}</td>
                    <td className="px-4 py-2.5 text-right">
                      {detail.status === OPNAME_STATUS.DRAFT && !it.sudahDisesuaikan ? (
                        <input
                          type="number"
                          min="0"
                          defaultValue={it.stokFisik}
                          onBlur={(e) => {
                            if (Number(e.target.value) !== it.stokFisik) {
                              handleUpdateItem(it.id, e.target.value)
                            }
                          }}
                          className="w-20 px-2 py-1.5 text-sm text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                      ) : (
                        <span className="font-medium">{it.stokFisik}</span>
                      )}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${
                      Number(it.selisih || 0) === 0 ? 'text-gray-400' :
                      Number(it.selisih) > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {Number(it.selisih || 0) > 0 ? `+${it.selisih}` : it.selisih}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {detail.catatan && (
          <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-4">
            Catatan: {detail.catatan}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-brand-600" />
            Stock Opname
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Penghitungan fisik & penyesuaian stok sistem</p>
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
          {canManage && (
            <button
              onClick={() => { setError(''); setShowCreateModal(true); soundService.click() }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors shadow-sm touch-target"
            >
              <Plus className="w-4 h-4" />
              Opname Baru
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode opname atau petugas..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>
      </div>

      {/* Tabel desktop */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="table-responsive">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Kode</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tanggal</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Petugas</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Kategori</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Item</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Selisih</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-400">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-400">Belum ada sesi stock opname.</td></tr>
              ) : filtered.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openDetail(o.id)}>
                  <td className="px-4 py-3 font-medium text-brand-700">{o.kodeOpname}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(o.tanggalOpname).toLocaleDateString('id-ID')}</td>
                  <td className="px-4 py-3 text-gray-600">{o.namaPetugas || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{o.kategoriFilter || 'Semua'}</td>
                  <td className="px-4 py-3 text-right">{o.totalItem}</td>
                  <td className={`px-4 py-3 text-right font-medium ${Number(o.totalSelisih) === 0 ? 'text-gray-400' : Number(o.totalSelisih) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Number(o.totalSelisih) > 0 ? `+${o.totalSelisih}` : o.totalSelisih}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${OPNAME_STATUS_COLORS[o.status]}`}>
                      {OPNAME_STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      {o.status !== OPNAME_STATUS.SELESAI && canManage && (
                        <button onClick={() => handleDelete(o)} title="Hapus"
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
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">Belum ada sesi stock opname.</div>
        ) : filtered.map((o) => (
          <div key={o.id}
            className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm active:bg-gray-50"
            onClick={() => openDetail(o.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-brand-700 truncate-mobile">{o.kodeOpname}</p>
                <p className="text-xs text-gray-400">
                  {new Date(o.tanggalOpname).toLocaleDateString('id-ID')} • {o.namaPetugas || '-'}
                </p>
              </div>
              <span className={`shrink-0 inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${OPNAME_STATUS_COLORS[o.status]}`}>
                {OPNAME_STATUS_LABELS[o.status]}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div>
                <p className="text-gray-400">Kategori</p>
                <p className="text-gray-700 font-medium truncate-mobile">{o.kategoriFilter || 'Semua'}</p>
              </div>
              <div>
                <p className="text-gray-400">Item</p>
                <p className="text-gray-700 font-medium">{o.totalItem}</p>
              </div>
              <div>
                <p className="text-gray-400">Selisih</p>
                <p className={`font-medium ${Number(o.totalSelisih) === 0 ? 'text-gray-400' : Number(o.totalSelisih) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Number(o.totalSelisih) > 0 ? `+${o.totalSelisih}` : o.totalSelisih}
                </p>
              </div>
            </div>
            {o.status !== OPNAME_STATUS.SELESAI && canManage && (
              <div className="flex justify-end pt-2" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => handleDelete(o)}
                  className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg active:bg-gray-200">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal create */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="modal-mobile bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-800">Sesi Stock Opname Baru</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Petugas *</label>
                <input
                  type="text"
                  value={form.namaPetugas}
                  onChange={(e) => setForm({ ...form, namaPetugas: e.target.value })}
                  placeholder="Nama petugas penghitung"
                  required
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Filter Kategori</label>
                <select
                  value={form.kategoriFilter}
                  onChange={(e) => setForm({ ...form, kategoriFilter: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="">Semua Kategori</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">Kosongkan untuk menghitung semua sparepart</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
                <textarea
                  value={form.catatan}
                  onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                  rows="2"
                  placeholder="Catatan sesi opname..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                <PackageSearch className="w-4 h-4 shrink-0 mt-0.5" />
                Sistem akan membuat snapshot stok saat ini. Isi hasil hitungan fisik, lalu klik "Selesaikan" untuk menyesuaikan stok.
              </div>

              <div className="flex gap-3 pt-2 pb-safe">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors touch-target"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors touch-target disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Membuat...' : 'Buat Sesi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default StockOpname