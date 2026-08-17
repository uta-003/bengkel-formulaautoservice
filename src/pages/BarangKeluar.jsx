import { useEffect, useState } from 'react'
import {
  ArrowUpFromLine,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Download
} from 'lucide-react'
import { sparepartService } from '../services/sparepartService'
import { transactionService } from '../services/transactionService'
import { authService } from '../services/authService'
import { rbacService } from '../services/rbacService'
import { toastService } from '../services/toastService'
import { formatRupiah } from '../utils/format'
import { LoadingScreen } from '../components/LoadingScreen'

function BarangKeluar() {
  const [spareparts, setSpareparts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedSparepart, setSelectedSparepart] = useState(null)
  const [form, setForm] = useState({
    sparepartId: '',
    jumlah: '',
    hargaSatuan: '',
    tanggal: new Date().toISOString().slice(0, 10),
    keterangan: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)

  const currentUser = authService.getCurrentUser()
  const canCreate = rbacService.canCreateTransaction(currentUser?.role)

  const loadData = async () => {
    setLoading(true)
    try {
      const sparepartsData = await sparepartService.getAll()
      setSpareparts(sparepartsData || [])
      setTransactions(transactionService.getByType('KELUAR'))
    } catch (error) {
      console.error('Failed to load data:', error)
      toastService.error('Gagal memuat data')
      setSpareparts([])
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredSpareparts = search
    ? sparepartService.search(search, spareparts)
    : spareparts

  const handleSelectSparepart = (sp) => {
    setSelectedSparepart(sp)
    setForm({
      ...form,
      sparepartId: sp.id,
      hargaSatuan: sp.hargaJual
    })
  }

  const handleSubmit = (e) => {
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
      transactionService.barangKeluar({
        sparepartId: Number(form.sparepartId),
        jumlah: Number(form.jumlah),
        hargaSatuan: Number(form.hargaSatuan),
        tanggal: new Date(form.tanggal).toISOString(),
        keterangan: form.keterangan
      })
      setSuccess('Barang keluar berhasil dicatat!')
      toastService.success('Barang keluar berhasil dicatat!')
      setForm({
        sparepartId: '',
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
    }
  }

  const handleDelete = (t) => {
    if (confirm(`Hapus transaksi "${t.nomor}"? Stok akan dikembalikan.`)) {
      try {
        transactionService.deleteTransaction(t.id)
        setSuccess('Transaksi berhasil dihapus dan stok dikembalikan!')
        toastService.success('Transaksi berhasil dihapus')
        loadData()
      } catch (err) {
        setError(err.message)
        toastService.error(err.message)
      }
    }
  }

  const handleExport = () => {
    const { headers, rows, filename } = transactionService.exportToCSV('KELUAR')
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"

  if (loading) {
    return <LoadingScreen message="Memuat data barang keluar..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pencatatan Barang Keluar</h1>
          <p className="text-gray-500 mt-1">Catat pengeluaran sparepart dari gudang</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
          {canCreate && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25"
            >
              <ArrowUpFromLine className="w-5 h-5" />
              Catat Barang Keluar
            </button>
          )}
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <CheckCircle2 className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Form Barang Keluar */}
      {showForm && canCreate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Form Barang Keluar</h2>
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
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{sp.nama}</p>
                        <p className="text-xs text-gray-500">{sp.kode} • {sp.merk}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${
                          sp.stok <= sp.stokMinimum ? 'text-red-600' : 'text-gray-700'
                        }`}>
                          Stok: {sp.stok}
                        </p>
                        <p className="text-xs text-gray-500">{formatRupiah(sp.hargaJual)}</p>
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
                  <p className="text-sm text-brand-700">{selectedSparepart.nama} ({selectedSparepart.kode})</p>
                  <p className="text-xs text-brand-600 mt-1">Stok tersedia: {selectedSparepart.stok} pcs</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah *</label>
                <input
                  type="number"
                  className={inputClass}
                  value={form.jumlah}
                  onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                  min="1"
                  max={selectedSparepart?.stok || undefined}
                  required
                />
                {selectedSparepart && Number(form.jumlah) > selectedSparepart.stok && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Jumlah melebihi stok tersedia!
                  </p>
                )}
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
                  placeholder="Contoh: Penjualan, pemakaian internal, dll."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25"
                >
                  Simpan Barang Keluar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Riwayat Transaksi */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Riwayat Barang Keluar</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">No. Transaksi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sparepart</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Jumlah</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Harga Satuan</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Keterangan</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Belum ada transaksi barang keluar
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{t.nomor}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(t.tanggal).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{t.sparepart?.nama}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-red-600">-{t.jumlah}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{formatRupiah(t.hargaSatuan)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-800">{formatRupiah(t.total)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{t.keterangan || '-'}</td>
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
    </div>
  )
}

export default BarangKeluar