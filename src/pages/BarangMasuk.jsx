import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  Search,
  CheckCircle2,
  Trash2,
  Download
} from 'lucide-react'
import { sparepartService } from '../services/sparepartService'
import { transactionService } from '../services/transactionService'
import { supplierService } from '../services/supplierService'
import { authService } from '../services/authService'
import { rbacService } from '../services/rbacService'
import { toastService } from '../services/toastService'
import { db } from '../services/database'
import { soundService } from '../services/soundService'
import { formatRupiah } from '../utils/format'

function BarangMasuk() {
  const [spareparts, setSpareparts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedSparepart, setSelectedSparepart] = useState(null)
  const [form, setForm] = useState({
    sparepartId: '',
    supplierId: '',
    jumlah: '',
    hargaSatuan: '',
    tanggal: new Date().toISOString().slice(0, 10),
    keterangan: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const currentUser = authService.getCurrentUser()
  const canCreate = rbacService.canCreateTransaction(currentUser?.role)

  const loadData = async () => {
    try {
      const [sparepartsData, suppliersData, transactionsData] = await Promise.all([
        sparepartService.getAll(),
        supplierService.getAll(),
        transactionService.getByType('MASUK')
      ])
      setSpareparts(sparepartsData || [])
      setSuppliers(suppliersData || [])
      setTransactions(transactionsData || [])
    } catch (error) {
      console.error('Failed to load data:', error)
      toastService.error('Gagal memuat data')
      setSpareparts([])
      setSuppliers([])
      setTransactions([])
    }
  }

  useEffect(() => {
    loadData()

    // Listen untuk perubahan data realtime dari perangkat lain
    const handleDBChange = (e) => {
      const { table: changedTable } = e.detail || {}
      if (!changedTable ||
          changedTable === db.keys.SPAREPARTS ||
          changedTable === db.keys.SUPPLIERS ||
          changedTable === db.keys.TRANSACTIONS) {
        loadData()
      }
    }

    window.addEventListener(db.changeEvent, handleDBChange)

    return () => {
      window.removeEventListener(db.changeEvent, handleDBChange)
    }
  }, [])

  const filteredSpareparts = search
    ? sparepartService.search(search, spareparts)
    : spareparts

  const handleSelectSparepart = (sp) => {
    setSelectedSparepart(sp)
    setForm({
      ...form,
      sparepartId: sp.id,
      supplierId: sp.supplierId || '',
      hargaSatuan: sp.hargaBeli
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.sparepartId) {
      setError('Pilih sparepart terlebih dahulu')
      return
    }
    if (!form.jumlah || Number(form.jumlah) <= 0) {
      setError('Jumlah harus lebih dari 0')
      return
    }
    if (!form.hargaSatuan || Number(form.hargaSatuan) <= 0) {
      setError('Harga satuan harus lebih dari 0')
      return
    }

    try {
      await transactionService.barangMasuk({
        sparepartId: Number(form.sparepartId),
        supplierId: form.supplierId ? Number(form.supplierId) : undefined,
        jumlah: Number(form.jumlah),
        hargaSatuan: Number(form.hargaSatuan),
        tanggal: new Date(form.tanggal).toISOString(),
        keterangan: form.keterangan
      })
      setSuccess('Barang masuk berhasil dicatat!')
      toastService.success('Barang masuk berhasil dicatat!')
      soundService.add()
      setForm({
        sparepartId: '',
        supplierId: '',
        jumlah: '',
        hargaSatuan: '',
        tanggal: new Date().toISOString().slice(0, 10),
        keterangan: ''
      })
      setSelectedSparepart(null)
      setShowForm(false)
      loadData()
    } catch (err) {
      setError(err.message)
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleDelete = async (t) => {
    if (confirm(`Hapus transaksi "${t.nomor}"? Stok akan dikembalikan.`)) {
      try {
        await transactionService.deleteTransaction(t.id)
        setSuccess('Transaksi berhasil dihapus dan stok dikembalikan!')
        toastService.success('Transaksi berhasil dihapus')
        soundService.delete()
        loadData()
      } catch (err) {
        setError(err.message)
        toastService.error(err.message)
        soundService.error()
      }
    }
  }

  const handleExport = async () => {
    const { headers, rows, filename } = await transactionService.exportToCSV('MASUK')
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    soundService.export()
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Pencatatan Barang Masuk</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Catat penerimaan sparepart dari supplier</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
          {canCreate && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25 text-sm"
            >
              <ArrowDownToLine className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Catat Barang Masuk</span>
              <span className="sm:hidden">Catat</span>
            </button>
          )}
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          {success}
        </div>
      )}

      {/* Form Barang Masuk */}
      {showForm && canCreate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Form Barang Masuk</h2>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pilih Sparepart */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Sparepart</label>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari sparepart..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                />
              </div>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredSpareparts.map((sp) => (
                  <button
                    key={sp.id}
                    onClick={() => handleSelectSparepart(sp)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                      selectedSparepart?.id === sp.id ? 'bg-brand-50 border-l-4 border-brand-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate-mobile">{sp.nama}</p>
                        <p className="text-xs text-gray-500 truncate-mobile">{sp.kode} • {sp.merk}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-700">Stok: {sp.stok}</p>
                        <p className="text-xs text-gray-500">{formatRupiah(sp.hargaBeli)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Form Detail */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {selectedSparepart && (
                <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-brand-800">Sparepart Terpilih:</p>
                  <p className="text-sm text-brand-700 truncate-mobile">{selectedSparepart.nama} ({selectedSparepart.kode})</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <select
                  className={inputClass}
                  value={form.supplierId}
                  onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                >
                  <option value="">Pilih Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.nama}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah *</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.jumlah}
                    onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Satuan (Rp) *</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.hargaSatuan}
                    onChange={(e) => setForm({ ...form, hargaSatuan: e.target.value })}
                    min="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.tanggal}
                  onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                <textarea
                  className={inputClass}
                  rows="3"
                  value={form.keterangan}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                  placeholder="Catatan tambahan (opsional)"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors touch-target"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors touch-target"
                >
                  Simpan Barang Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Riwayat Transaksi - Desktop */}
      <div className="desktop-table-view bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800">Riwayat Barang Masuk</h2>
        </div>
        <div className="table-responsive">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">No. Transaksi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sparepart</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Jumlah</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Harga Satuan</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Belum ada transaksi barang masuk
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{t.nomor}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(t.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      <br />
                      <span className="text-xs text-gray-400">
                        {new Date(t.tanggal).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{t.sparepart?.nama}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.supplier?.nama || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-green-600">+{t.jumlah}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{formatRupiah(t.hargaSatuan)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-800">{formatRupiah(t.total)}</td>
                    <td className="px-4 py-3 text-center">
                      {canCreate && (
                        <button
                          onClick={() => handleDelete(t)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus Transaksi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Riwayat Transaksi - Mobile Card View */}
      <div className="mobile-card-view">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800">Riwayat Barang Masuk</h2>
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center">
              <ArrowDownToLine className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Belum ada transaksi barang masuk</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {transactions.map((t) => (
                <div key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate-mobile">{t.sparepart?.nama}</p>
                      <p className="text-xs text-gray-500">{t.nomor}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(t.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(t.tanggal).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB • {t.supplier?.nama || '-'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-600">+{t.jumlah} pcs</p>
                      <p className="text-xs text-gray-500">{formatRupiah(t.total)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">{formatRupiah(t.hargaSatuan)} / pcs</p>
                    {canCreate && (
                      <button
                        onClick={() => handleDelete(t)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-target"
                        title="Hapus Transaksi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BarangMasuk