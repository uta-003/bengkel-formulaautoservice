import { useEffect, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Package,
  Wallet,
  BarChart3,
  ArrowDownToLine,
  ArrowUpFromLine,
  Printer
} from 'lucide-react'
import { sparepartService } from '../services/sparepartService'
import { transactionService } from '../services/transactionService'
import { toastService } from '../services/toastService'
import { formatRupiah } from '../utils/format'
import { LoadingScreen } from '../components/LoadingScreen'

function Laporan() {
  const [stats, setStats] = useState(null)
  const [transStats, setTransStats] = useState(null)
  const [monthlyReport, setMonthlyReport] = useState([])
  const [topSpareparts, setTopSpareparts] = useState([])
  const [stockMovements, setStockMovements] = useState([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [categoryStats, setCategoryStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setLoading(true)
      try {
        const spareparts = await sparepartService.getAll()
        if (!isMounted) return

        setStats(sparepartService.getStats(spareparts))
        setTransStats(transactionService.getStats())
        setMonthlyReport(transactionService.getMonthlyReport(year))
        setTopSpareparts(transactionService.getTopSpareparts(5))
        setStockMovements(transactionService.getStockMovements().slice(0, 10))
        setCategoryStats(sparepartService.getStockByCategory(spareparts))
      } catch (error) {
        console.error('Failed to load report data:', error)
        if (isMounted) toastService.error('Gagal memuat data laporan')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [year])

  if (loading || !stats || !transStats) {
    return <LoadingScreen message="Memuat laporan & analisis..." />
  }

  const maxMonthlyValue = Math.max(...monthlyReport.map(m => Math.max(m.masuk, m.keluar)), 1)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Laporan & Analisis</h1>
          <p className="text-gray-500 mt-1">Analisis transaksi dan performa inventori</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25"
          >
            <Printer className="w-4 h-4" />
            Cetak Laporan
          </button>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Nilai Stok</p>
              <p className="text-xl font-bold text-gray-800 mt-1">{formatRupiah(stats.totalNilai)}</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Modal</p>
              <p className="text-xl font-bold text-gray-800 mt-1">{formatRupiah(stats.totalModal)}</p>
            </div>
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center border border-brand-100">
              <Package className="w-5 h-5 text-brand-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Barang Masuk</p>
              <p className="text-xl font-bold text-green-600 mt-1">{formatRupiah(transStats.totalMasuk)}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ArrowDownToLine className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Barang Keluar</p>
              <p className="text-xl font-bold text-red-600 mt-1">{formatRupiah(transStats.totalKeluar)}</p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <ArrowUpFromLine className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grafik Bulanan */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Grafik Transaksi {year}</h2>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-2">
            {monthlyReport.map((m) => (
              <div key={m.bulan} className="flex items-center gap-3">
                <span className="w-10 text-xs font-medium text-gray-500">{m.bulan}</span>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-green-500 h-full rounded-full"
                        style={{ width: `${(m.masuk / maxMonthlyValue) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-20 text-right">{formatRupiah(m.masuk)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-red-500 h-full rounded-full"
                        style={{ width: `${(m.keluar / maxMonthlyValue) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-20 text-right">{formatRupiah(m.keluar)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500 rounded-full" /> Barang Masuk
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-500 rounded-full" /> Barang Keluar
            </span>
          </div>
        </div>

        {/* Top Sparepart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Sparepart Terlaris</h2>
          {topSpareparts.length === 0 ? (
            <p className="text-gray-500 text-sm">Belum ada data penjualan.</p>
          ) : (
            <div className="space-y-3">
              {topSpareparts.map((sp, index) => (
                <div key={sp.sparepartId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-brand-50 text-brand-600 border border-brand-100 rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{sp.nama}</p>
                      <p className="text-xs text-gray-500">{sp.kode}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">{sp.totalQty} pcs</p>
                    <p className="text-xs text-gray-500">{formatRupiah(sp.totalNilai)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pergerakan Stok */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Pergerakan Stok Terbaru</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sparepart</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Tipe</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Jumlah</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Stok Sebelum</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Stok Sesudah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stockMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Belum ada pergerakan stok
                  </td>
                </tr>
              ) : (
                stockMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(m.tanggal).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{m.sparepart?.nama}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        m.tipe === 'MASUK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {m.tipe === 'MASUK' ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        {m.tipe}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-gray-800">{m.jumlah}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{m.stokSebelum}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-gray-800">{m.stokSesudah}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Laporan per Kategori */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Laporan Nilai Stok per Kategori</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kategori</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Jumlah Item</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Total Stok</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Nilai Stok</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Persentase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categoryStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Belum ada data kategori
                  </td>
                </tr>
              ) : (
                categoryStats.map((cat) => {
                  const percentage = stats.totalNilai > 0 ? (cat.totalNilai / stats.totalNilai) * 100 : 0
                  return (
                    <tr key={cat.kategori} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{cat.kategori}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{cat.totalItems}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{cat.totalStok}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-800">{formatRupiah(cat.totalNilai)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${percentage}%`,
                                background: `hsl(${(cat.kategori.length * 40) % 360}, 70%, 50%)`
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-12 text-right">{percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Laporan