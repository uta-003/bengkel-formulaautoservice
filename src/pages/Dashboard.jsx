import { useEffect, useState } from 'react'
import { SkeletonLoader as Skeleton } from '../components/Skeleton'
import { Link } from 'react-router-dom'
import {
  Package,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Truck,
  TrendingUp,
  Wallet,
  Boxes,
  PieChart,
  Gauge,
  ScanBarcode,
  RefreshCw
} from 'lucide-react'
import { sparepartService } from '../services/sparepartService'
import { transactionService } from '../services/transactionService'
import { supplierService } from '../services/supplierService'
import { db } from '../services/database'
import { formatRupiah } from '../utils/format'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [transStats, setTransStats] = useState(null)
  const [lowStock, setLowStock] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [supplierCount, setSupplierCount] = useState(0)
  const [categoryStats, setCategoryStats] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const [spareparts, suppliers, transStatsData, recentTransData] = await Promise.all([
          sparepartService.getAll(),
          supplierService.getAll(),
          transactionService.getStats(),
          transactionService.getRecentTransactions(5)
        ])

        if (!isMounted) return

        setStats(sparepartService.getStats(spareparts))
        setLowStock(sparepartService.getLowStock(spareparts))
        setCategoryStats(sparepartService.getStockByCategory(spareparts))
        setSupplierCount((suppliers || []).length)
        setTransStats(transStatsData)
        setRecentTransactions(recentTransData)
      } catch (err) {
        if (isMounted) {
          setError(err.message)
          console.error('Dashboard error:', err)
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadData()

    // Listen untuk perubahan data realtime dari perangkat lain
    const handleDBChange = (e) => {
      const { table: changedTable } = e.detail || {}
      // Refresh dashboard saat spareparts, suppliers, atau transactions berubah
      if (!changedTable ||
          changedTable === db.keys.SPAREPARTS ||
          changedTable === db.keys.SUPPLIERS ||
          changedTable === db.keys.TRANSACTIONS) {
        loadData()
      }
    }

    window.addEventListener(db.changeEvent, handleDBChange)

    return () => {
      isMounted = false
      window.removeEventListener(db.changeEvent, handleDBChange)
    }
  }, [])

  if (error && !stats) {
    return (
      <div className="text-center py-20">
        <div className="max-w-md mx-auto px-4">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Gagal Memuat Data</h2>
          <p className="text-red-500 mb-2">{error}</p>
          <p className="text-gray-500 text-sm mb-4">
            Tidak dapat terhubung ke server. Periksa koneksi internet Anda dan coba lagi.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Muat Ulang
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || !stats || !transStats) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 p-6 sm:p-8">
          <Skeleton className="h-8 w-48 bg-white/20" />
          <Skeleton className="h-4 w-72 bg-white/20 mt-2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  const cards = [
    {
      title: 'Total Sparepart',
      value: stats.totalItems,
      icon: Package,
      color: 'bg-gradient-to-br from-brand-500 to-brand-700',
      link: '/sparepart'
    },
    {
      title: 'Total Stok',
      value: stats.totalStok,
      icon: Boxes,
      color: 'bg-gradient-to-br from-brand-400 to-brand-600',
      link: '/sparepart'
    },
    {
      title: 'Nilai Stok (Jual)',
      value: formatRupiah(stats.totalNilai),
      icon: Wallet,
      color: 'bg-gradient-to-br from-brand-600 to-brand-800',
      link: '/laporan'
    },
    {
      title: 'Low Stock Alert',
      value: stats.lowStockCount,
      icon: AlertTriangle,
      color: 'bg-gradient-to-br from-[#ff5252] to-[#a70000]',
      link: '/low-stock'
    },
    {
      title: 'Total Supplier',
      value: supplierCount,
      icon: Truck,
      color: 'bg-gradient-to-br from-brand-300 to-brand-500',
      link: '/supplier'
    },
    {
      title: 'Transaksi Masuk',
      value: formatRupiah(transStats.totalMasuk),
      icon: ArrowDownToLine,
      color: 'bg-gradient-to-br from-brand-500 to-brand-300',
      link: '/barang-masuk'
    },
    {
      title: 'Transaksi Keluar',
      value: formatRupiah(transStats.totalKeluar),
      icon: ArrowUpFromLine,
      color: 'bg-gradient-to-br from-[#a70000] to-[#ff5252]',
      link: '/barang-keluar'
    },
    {
      title: 'Total Transaksi',
      value: transStats.totalTransaksi,
      icon: TrendingUp,
      color: 'bg-gradient-to-br from-brand-700 to-brand-400',
      link: '/laporan'
    }
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="relative overflow-hidden bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 rounded-2xl p-5 sm:p-8 text-white shadow-lg shadow-brand-500/20">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-black/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-5 h-5 sm:w-6 sm:h-6 text-brand-100" />
              <span className="text-[10px] sm:text-xs font-semibold text-brand-100 uppercase tracking-widest">Formula Auto Service</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-bold">Dashboard</h1>
            <p className="text-brand-100 mt-1 text-sm sm:text-base">Ringkasan kondisi inventori sparepart</p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 w-fit">
            <div className="text-right">
              <p className="text-[10px] sm:text-xs text-brand-100">Status Sistem</p>
              <p className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse-slow" />
                Online
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <Link
          to="/sparepart"
          className="group bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 hover:border-brand-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-brand-50 rounded-lg flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors shrink-0">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-brand-600 group-hover:text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate-mobile">Kelola Sparepart</p>
              <p className="hidden sm:block text-xs text-gray-500">Tambah / ubah data</p>
            </div>
          </div>
        </Link>
        <Link
          to="/barang-masuk"
          className="group bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 hover:border-brand-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-brand-50 rounded-lg flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors shrink-0">
              <ArrowDownToLine className="w-4 h-4 sm:w-5 sm:h-5 text-brand-600 group-hover:text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate-mobile">Barang Masuk</p>
              <p className="hidden sm:block text-xs text-gray-500">Catat penerimaan</p>
            </div>
          </div>
        </Link>
        <Link
          to="/barang-keluar"
          className="group bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 hover:border-brand-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-brand-50 rounded-lg flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors shrink-0">
              <ArrowUpFromLine className="w-4 h-4 sm:w-5 sm:h-5 text-brand-600 group-hover:text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate-mobile">Barang Keluar</p>
              <p className="hidden sm:block text-xs text-gray-500">Catat pengeluaran</p>
            </div>
          </div>
        </Link>
        <Link
          to="/barcode"
          className="group bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 hover:border-brand-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-brand-50 rounded-lg flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors shrink-0">
              <ScanBarcode className="w-4 h-4 sm:w-5 sm:h-5 text-brand-600 group-hover:text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate-mobile">Scan Barcode</p>
              <p className="hidden sm:block text-xs text-gray-500">Cari sparepart</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {cards.map((card) => (
          <Link
            key={card.title}
            to={card.link}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-sm text-gray-500 truncate-mobile">{card.title}</p>
                <p className="text-base sm:text-2xl font-bold text-gray-800 mt-1 sm:mt-2 truncate-mobile">{card.value}</p>
              </div>
              <div className={`w-8 h-8 sm:w-12 sm:h-12 ${card.color} rounded-lg flex items-center justify-center text-white shrink-0`}>
                <card.icon className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800">Peringatan Stok Minimum</h2>
            <Link to="/low-stock" className="text-xs sm:text-sm text-brand-600 hover:text-brand-700 font-medium">
              Lihat Semua
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-gray-500 text-sm">Tidak ada sparepart yang stoknya di bawah minimum.</p>
          ) : (
            <div className="space-y-3">
              {lowStock.slice(0, 5).map((sp) => (
                <div key={sp.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate-mobile">{sp.nama}</p>
                    <p className="text-xs text-gray-500 truncate-mobile">{sp.kode} • {sp.merk}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-semibold text-red-600">Stok: {sp.stok}</p>
                    <p className="text-xs text-gray-500">Min: {sp.stokMinimum}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800">Transaksi Terbaru</h2>
            <Link to="/laporan" className="text-xs sm:text-sm text-brand-600 hover:text-brand-700 font-medium">
              Lihat Laporan
            </Link>
          </div>
          {recentTransactions.length === 0 ? (
            <p className="text-gray-500 text-sm">Belum ada transaksi.</p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      t.tipe === 'MASUK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {t.tipe === 'MASUK' ? (
                        <ArrowDownToLine className="w-4 h-4" />
                      ) : (
                        <ArrowUpFromLine className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate-mobile">{t.sparepart?.nama}</p>
                      <p className="text-xs text-gray-500 truncate-mobile">{t.nomor} • {new Date(t.tanggal).toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className={`text-sm font-semibold ${t.tipe === 'MASUK' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.tipe === 'MASUK' ? '+' : '-'}{t.jumlah} pcs
                    </p>
                    <p className="text-xs text-gray-500">{formatRupiah(t.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Distribusi Stok per Kategori */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800">Distribusi Stok per Kategori</h2>
          <PieChart className="w-5 h-5 text-gray-400" />
        </div>
        {categoryStats.length === 0 ? (
          <p className="text-gray-500 text-sm">Belum ada data kategori.</p>
        ) : (
          <div className="space-y-4">
            {categoryStats.map((cat) => {
              const percentage = stats.totalStok > 0 ? (cat.totalStok / stats.totalStok) * 100 : 0
              return (
                <div key={cat.kategori}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-sm font-medium text-gray-700 truncate-mobile">{cat.kategori}</span>
                    <span className="text-xs sm:text-sm text-gray-500 shrink-0">
                      {cat.totalItems} item • {cat.totalStok} pcs
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 sm:h-4 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        background: `hsl(${(cat.kategori.length * 40) % 360}, 70%, 50%)`
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatRupiah(cat.totalNilai)}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard