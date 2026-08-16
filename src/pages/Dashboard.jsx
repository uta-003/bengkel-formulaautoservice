import { useEffect, useState } from 'react'
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
  PieChart
} from 'lucide-react'
import { sparepartService } from '../services/sparepartService'
import { transactionService } from '../services/transactionService'
import { supplierService } from '../services/supplierService'
import { formatRupiah } from '../utils/format'
import { LoadingScreen } from '../components/LoadingScreen'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [transStats, setTransStats] = useState(null)
  const [lowStock, setLowStock] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [supplierCount, setSupplierCount] = useState(0)
  const [categoryStats, setCategoryStats] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const [spareparts, suppliers] = await Promise.all([
          sparepartService.getAll(),
          supplierService.getAll()
        ])

        if (!isMounted) return

        setStats(sparepartService.getStats(spareparts))
        setLowStock(sparepartService.getLowStock(spareparts))
        setCategoryStats(sparepartService.getStockByCategory(spareparts))
        setSupplierCount((suppliers || []).length)
        setTransStats(transactionService.getStats())
        setRecentTransactions(transactionService.getAll().slice(0, 5))
      } catch (err) {
        if (isMounted) {
          setError(err.message)
          console.error('Dashboard error:', err)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  if (error && !stats) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500">Terjadi kesalahan: {error}</p>
      </div>
    )
  }

  if (!stats || !transStats) {
    return <LoadingScreen message="Memuat dashboard..." />
  }

  const cards = [
    {
      title: 'Total Sparepart',
      value: stats.totalItems,
      icon: Package,
      color: 'bg-blue-500',
      link: '/sparepart'
    },
    {
      title: 'Total Stok',
      value: stats.totalStok,
      icon: Boxes,
      color: 'bg-green-500',
      link: '/sparepart'
    },
    {
      title: 'Nilai Stok (Jual)',
      value: formatRupiah(stats.totalNilai),
      icon: Wallet,
      color: 'bg-purple-500',
      link: '/laporan'
    },
    {
      title: 'Low Stock Alert',
      value: stats.lowStockCount,
      icon: AlertTriangle,
      color: 'bg-red-500',
      link: '/low-stock'
    },
    {
      title: 'Total Supplier',
      value: supplierCount,
      icon: Truck,
      color: 'bg-orange-500',
      link: '/supplier'
    },
    {
      title: 'Transaksi Masuk',
      value: formatRupiah(transStats.totalMasuk),
      icon: ArrowDownToLine,
      color: 'bg-cyan-500',
      link: '/barang-masuk'
    },
    {
      title: 'Transaksi Keluar',
      value: formatRupiah(transStats.totalKeluar),
      icon: ArrowUpFromLine,
      color: 'bg-pink-500',
      link: '/barang-keluar'
    },
    {
      title: 'Total Transaksi',
      value: transStats.totalTransaksi,
      icon: TrendingUp,
      color: 'bg-indigo-500',
      link: '/laporan'
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-1">Ringkasan kondisi inventori sparepart</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.title}
            to={card.link}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-800 mt-2">{card.value}</p>
              </div>
              <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center text-white`}>
                <card.icon className="w-6 h-6" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Peringatan Stok Minimum</h2>
            <Link to="/low-stock" className="text-sm text-blue-600 hover:text-blue-700">
              Lihat Semua
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-gray-500 text-sm">Tidak ada sparepart yang stoknya di bawah minimum.</p>
          ) : (
            <div className="space-y-3">
              {lowStock.slice(0, 5).map((sp) => (
                <div key={sp.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <div>
                    <p className="font-medium text-gray-800">{sp.nama}</p>
                    <p className="text-xs text-gray-500">{sp.kode} • {sp.merk}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600">Stok: {sp.stok}</p>
                    <p className="text-xs text-gray-500">Min: {sp.stokMinimum}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Transaksi Terbaru</h2>
            <Link to="/laporan" className="text-sm text-blue-600 hover:text-blue-700">
              Lihat Laporan
            </Link>
          </div>
          {recentTransactions.length === 0 ? (
            <p className="text-gray-500 text-sm">Belum ada transaksi.</p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((t) => (
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
                      <p className="font-medium text-gray-800 text-sm">{t.sparepart?.nama}</p>
                      <p className="text-xs text-gray-500">{t.nomor} • {new Date(t.tanggal).toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>
                  <div className="text-right">
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Distribusi Stok per Kategori</h2>
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
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{cat.kategori}</span>
                    <span className="text-sm text-gray-500">
                      {cat.totalItems} item • {cat.totalStok} pcs • {formatRupiah(cat.totalNilai)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        background: `hsl(${(cat.kategori.length * 40) % 360}, 70%, 50%)`
                      }}
                    />
                  </div>
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