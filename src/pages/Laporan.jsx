import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  ArrowDownToLine,
  ArrowUpFromLine,
  Printer,
  Download,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Calendar
} from 'lucide-react'
import { sparepartService } from '../services/sparepartService'
import { transactionService } from '../services/transactionService'
import { db } from '../services/database'
import { toastService } from '../services/toastService'
import { soundService } from '../services/soundService'
import { formatRupiah } from '../utils/format'

const PERIODS = [
  { id: 'harian', label: 'Harian', icon: CalendarDays },
  { id: 'mingguan', label: 'Mingguan', icon: CalendarRange },
  { id: 'bulanan', label: 'Bulanan', icon: CalendarClock },
  { id: 'tahunan', label: 'Tahunan', icon: Calendar }
]

// Helper untuk mendapatkan tanggal lokal dalam format YYYY-MM-DD
// toISOString() menggunakan UTC yang bisa berbeda 1 hari dari waktu lokal Indonesia (UTC+7)
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function Laporan() {
  const [period, setPeriod] = useState('harian')
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [selectedMonth, setSelectedMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  )
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [stats, setStats] = useState(null)
  const [transStats, setTransStats] = useState(null)
  const [periodStats, setPeriodStats] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [topSpareparts, setTopSpareparts] = useState([])
  const [stockMovements, setStockMovements] = useState([])
  const [categoryStats, setCategoryStats] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  // Handler untuk ganti periode - reset data lama agar tidak crash
  const handleChangePeriod = (newPeriod) => {
    if (newPeriod === period) return
    // Reset data report ke null agar render tidak menggunakan data periode lama
    setReportData(null)
    setPeriodStats(null)
    setIsLoading(true)
    setPeriod(newPeriod)
    soundService.click()
  }

  const loadData = useCallback(async () => {
    try {
      const date = new Date(selectedDate + 'T00:00:00')
      const reportDate = period === 'bulanan'
        ? new Date(selectedMonth + '-01T00:00:00')
        : period === 'tahunan'
          ? new Date(selectedYear, 0, 1)
          : date

      // Muat data dasar secara paralel
      const [spareparts, transStatsData, report, periodStatsData, topSpareparts, movements] = await Promise.all([
        sparepartService.getAll(),
        transactionService.getStats(),
        (async () => {
          switch (period) {
            case 'harian': return transactionService.getDailyReport(reportDate)
            case 'mingguan': return transactionService.getWeeklyReport(reportDate)
            case 'bulanan': return transactionService.getMonthlyDetailReport(reportDate)
            case 'tahunan': return transactionService.getYearlyReport(selectedYear)
            default: return null
          }
        })(),
        transactionService.getPeriodStats(period, reportDate),
        transactionService.getTopSpareparts(5, period, reportDate),
        transactionService.getStockMovementsByPeriod(period, reportDate, 10)
      ])

      setStats(sparepartService.getStats(spareparts))
      setTransStats(transStatsData)
      setCategoryStats(sparepartService.getStockByCategory(spareparts))
      setReportData(report)
      setPeriodStats(periodStatsData)
      setTopSpareparts(topSpareparts)
      setStockMovements(movements)
    } catch (error) {
      console.error('Failed to load report data:', error)
      toastService.error('Gagal memuat data laporan')
    } finally {
      setIsLoading(false)
    }
  }, [period, selectedDate, selectedMonth, selectedYear])

  useEffect(() => {
    loadData()

    // Listen untuk perubahan data realtime dari perangkat lain
    const handleDBChange = (e) => {
      const { table: changedTable } = e.detail || {}
      if (!changedTable ||
          changedTable === db.keys.SPAREPARTS ||
          changedTable === db.keys.TRANSACTIONS ||
          changedTable === db.keys.STOCK_MOVEMENTS) {
        loadData()
      }
    }

    window.addEventListener(db.changeEvent, handleDBChange)

    return () => {
      window.removeEventListener(db.changeEvent, handleDBChange)
    }
  }, [loadData])

  if (isLoading || !stats || !transStats || !periodStats || !reportData) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Memuat laporan...</p>
        </div>
      </div>
    )
  }

  const getPeriodTitle = () => {
    switch (period) {
      case 'harian':
        return new Date(reportData.tanggal).toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      case 'mingguan':
        return `${new Date(reportData.mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${new Date(reportData.akhir).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
      case 'bulanan':
        return reportData.bulan
      case 'tahunan':
        return String(reportData.tahun)
      default:
        return ''
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = async () => {
    try {
      setIsExporting(true)
      // Tentukan tanggal filter sesuai periode yang dipilih
      const reportDate = period === 'bulanan'
        ? new Date(selectedMonth + '-01T00:00:00')
        : period === 'tahunan'
          ? new Date(selectedYear, 0, 1)
          : new Date(selectedDate + 'T00:00:00')

      const { csvContent, filename } = await transactionService.exportReportToCSV(period, reportDate)

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.click()
      URL.revokeObjectURL(link.href)
      toastService.success('Laporan berhasil diexport ke CSV')
      soundService.export()
    } catch (error) {
      console.error('Failed to export CSV:', error)
      toastService.error('Gagal export laporan ke CSV')
      soundService.error()
    } finally {
      setIsExporting(false)
    }
  }

  // Hitung nilai maksimum untuk grafik
  const getChartData = () => {
    if (period === 'harian') {
      return []
    }
    return reportData.data || []
  }

  const chartData = getChartData()
  const maxChartValue = Math.max(
    ...chartData.map(d => Math.max(d.masuk || 0, d.keluar || 0)),
    1
  )

  const renderPeriodSelector = () => {
    switch (period) {
      case 'harian':
        return (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        )
      case 'mingguan':
        return (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        )
      case 'bulanan':
        return (
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        )
      case 'tahunan':
        return (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )
      default:
        return null
    }
  }

  const renderChart = () => {
    const chartData = getChartData()

    if (period === 'harian') {
      // Untuk harian, tampilkan transaksi hari itu sebagai list
      return (
        <div className="space-y-2">
          {(reportData.transaksi || []).length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Tidak ada transaksi pada hari ini</p>
          ) : (
            reportData.transaksi.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    t.tipe === 'MASUK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {t.tipe === 'MASUK' ? (
                      <ArrowDownToLine className="w-4 h-4" />
                    ) : (
                      <ArrowUpFromLine className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{t.sparepart?.nama || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">
                      {t.nomor} • {new Date(t.tanggal).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${t.tipe === 'MASUK' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.tipe === 'MASUK' ? '+' : '-'} {t.jumlah} pcs
                  </p>
                  <p className="text-xs text-gray-500">{formatRupiah(t.total)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )
    }

    if (period === 'mingguan') {
      return (
        <div className="space-y-2">
          {chartData.map((d) => {
            const isToday = new Date(d.tanggal).toDateString() === new Date().toDateString()
            return (
              <div key={d.hari} className={`flex items-center gap-3 p-2 rounded-lg ${isToday ? 'bg-brand-50' : ''}`}>
                <span className={`w-16 text-xs font-medium ${isToday ? 'text-brand-700 font-bold' : 'text-gray-500'}`}>
                  {d.hari}
                  {isToday && <span className="block text-[10px] font-bold text-brand-600">Hari Ini</span>}
                </span>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-green-500 h-full rounded-full transition-all"
                        style={{ width: `${(d.masuk / maxChartValue) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-24 text-right">{formatRupiah(d.masuk)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-red-500 h-full rounded-full transition-all"
                        style={{ width: `${(d.keluar / maxChartValue) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-24 text-right">{formatRupiah(d.keluar)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    if (period === 'bulanan') {
      return (
        <div className="space-y-3">
          {chartData.map((w) => (
            <div key={w.minggu} className="flex items-center gap-3">
              <span className="w-14 text-xs font-medium text-gray-500">Minggu {w.minggu}</span>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-green-500 h-full rounded-full transition-all"
                      style={{ width: `${(w.masuk / maxChartValue) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-24 text-right">{formatRupiah(w.masuk)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-red-500 h-full rounded-full transition-all"
                      style={{ width: `${(w.keluar / maxChartValue) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-24 text-right">{formatRupiah(w.keluar)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )
    }

    // Tahun = 12 bulan
    return (
      <div className="space-y-1.5">
        {chartData.map((m) => (
          <div key={m.bulan} className="flex items-center gap-3">
            <span className="w-10 text-xs font-medium text-gray-500">{m.bulan}</span>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-green-500 h-full rounded-full transition-all"
                    style={{ width: `${(m.masuk / maxChartValue) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-24 text-right">{formatRupiah(m.masuk)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-red-500 h-full rounded-full transition-all"
                    style={{ width: `${(m.keluar / maxChartValue) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-24 text-right">{formatRupiah(m.keluar)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const getChartTitle = () => {
    switch (period) {
      case 'harian':
        return 'Detail Transaksi Harian'
      case 'mingguan':
        return 'Transaksi per Hari (Mingguan)'
      case 'bulanan':
        return 'Transaksi per Minggu (Bulanan)'
      case 'tahunan':
        return 'Transaksi per Bulan (Tahunan)'
      default:
        return 'Grafik Transaksi'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Laporan & Analisis</h1>
          <p className="text-gray-500 mt-1">Analisis transaksi dan performa inventori</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
            {isExporting ? 'Mengexport...' : 'Export CSV'}
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25"
          >
            <Printer className="w-4 h-4" />
            Cetak Laporan
          </button>
        </div>
      </div>

      {/* Pilih Periode */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {PERIODS.map(p => {
              const Icon = p.icon
              const isActive = period === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => handleChangePeriod(p.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {p.label}
                </button>
              )
            })}
          </div>
          <div>
            {renderPeriodSelector()}
          </div>
        </div>
      </div>

      {/* Judul periode */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl shadow-md shadow-brand-500/25 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-brand-100 text-sm font-medium">
              Laporan {PERIODS.find(p => p.id === period)?.label}
            </p>
            <h2 className="text-2xl font-bold mt-1">{getPeriodTitle()}</h2>
          </div>
          <div className="text-right">
            <p className="text-brand-100 text-sm">Total Transaksi</p>
            <p className="text-3xl font-bold">{periodStats.totalTransaksi}</p>
          </div>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Barang Masuk</p>
              <p className="text-xl font-bold text-green-600 mt-1">{formatRupiah(periodStats.totalMasuk)}</p>
              <p className="text-xs text-gray-400 mt-1">{periodStats.totalQtyMasuk} pcs</p>
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
              <p className="text-xl font-bold text-red-600 mt-1">{formatRupiah(periodStats.totalKeluar)}</p>
              <p className="text-xs text-gray-400 mt-1">{periodStats.totalQtyKeluar} pcs</p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <ArrowUpFromLine className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Selisih Total</p>
              <p className={`text-xl font-bold mt-1 ${periodStats.selisih >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatRupiah(periodStats.selisih)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{periodStats.totalTransaksi} transaksi</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Rata-rata Masuk</p>
              <p className="text-lg font-bold text-gray-800 mt-1">{formatRupiah(periodStats.rataRataMasuk)}</p>
              <p className="text-xs text-gray-400 mt-1">Rata-rata Keluar: {formatRupiah(periodStats.rataRataKeluar)}</p>
            </div>
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center border border-brand-100">
              <BarChart3 className="w-5 h-5 text-brand-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grafik Periode */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">{getChartTitle()}</h2>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          {renderChart()}
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
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Sparepart Terlaris ({PERIODS.find(p => p.id === period)?.label})
          </h2>
          {topSpareparts.length === 0 ? (
            <p className="text-gray-500 text-sm">Belum ada data penjualan pada periode ini.</p>
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

          {/* Statistik keseluruhan */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Statistik Keseluruhan</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Total Stok (Semua)</p>
                <p className="text-lg font-bold text-gray-800">{stats.totalStok} pcs</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Nilai Stok</p>
                <p className="text-lg font-bold text-gray-800">{formatRupiah(stats.totalNilai)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Modal</p>
                <p className="text-lg font-bold text-gray-800">{formatRupiah(stats.totalModal)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Semua Transaksi</p>
                <p className="text-lg font-bold text-gray-800">{transStats.totalTransaksi}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pergerakan Stok */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            Pergerakan Stok ({PERIODS.find(p => p.id === period)?.label})
          </h2>
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
                    Belum ada pergerakan stok pada periode ini
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

      {/* Ringkasan Keseluruhan */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Ringkasan Keseluruhan</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-xs text-purple-600 font-medium">Total Nilai Stok</p>
            <p className="text-xl font-bold text-purple-800 mt-1">{formatRupiah(stats.totalNilai)}</p>
            <p className="text-xs text-purple-500 mt-1">{stats.totalItems} item</p>
          </div>
          <div className="bg-brand-50 rounded-lg p-4">
            <p className="text-xs text-brand-600 font-medium">Total Modal</p>
            <p className="text-xl font-bold text-brand-800 mt-1">{formatRupiah(stats.totalModal)}</p>
            <p className="text-xs text-brand-500 mt-1">{stats.totalStok} pcs total stok</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-xs text-green-600 font-medium">Total Barang Masuk</p>
            <p className="text-xl font-bold text-green-800 mt-1">{formatRupiah(transStats.totalMasuk)}</p>
            <p className="text-xs text-green-500 mt-1">{transStats.totalQtyMasuk} pcs</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-xs text-red-600 font-medium">Total Barang Keluar</p>
            <p className="text-xl font-bold text-red-800 mt-1">{formatRupiah(transStats.totalKeluar)}</p>
            <p className="text-xs text-red-500 mt-1">{transStats.totalQtyKeluar} pcs</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Laporan