import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  MapPin
} from 'lucide-react'
import { sparepartService } from '../services/sparepartService'
import { transactionService } from '../services/transactionService'
import { db } from '../services/database'
import { formatRupiah } from '../utils/format'

function SparepartDetail({ sparepartId, onClose }) {
  const [sparepart, setSparepart] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      if (!sparepartId) return
      try {
        const [spDetail, spTransactions] = await Promise.all([
          sparepartService.getById(sparepartId),
          transactionService.getBySparepartId(sparepartId)
        ])
        if (isMounted) {
          setSparepart(spDetail)
          setTransactions(spTransactions)
        }
      } catch (error) {
        console.error('Failed to load detail:', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()

    // Listen untuk perubahan data realtime dari perangkat lain
    const handleDBChange = (e) => {
      const { table: changedTable } = e.detail || {}
      if (!changedTable ||
          changedTable === db.keys.SPAREPARTS ||
          changedTable === db.keys.TRANSACTIONS) {
        loadData()
      }
    }

    window.addEventListener(db.changeEvent, handleDBChange)

    return () => {
      isMounted = false
      window.removeEventListener(db.changeEvent, handleDBChange)
    }
  }, [sparepartId])

  if (loading) return null
  if (!sparepart) return null

  const isLowStock = sparepart.stok <= sparepart.stokMinimum
  const totalMasuk = transactions.filter(t => t.tipe === 'MASUK').reduce((sum, t) => sum + t.jumlah, 0)
  const totalKeluar = transactions.filter(t => t.tipe === 'KELUAR').reduce((sum, t) => sum + t.jumlah, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto modal-mobile">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800">Detail Sparepart</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 touch-target">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Info Utama */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-brand-50 rounded-xl flex items-center justify-center border border-brand-100 shrink-0">
                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-brand-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-xl font-bold text-gray-800 truncate-mobile">{sparepart.nama}</h3>
                <p className="text-xs sm:text-sm text-gray-500">{sparepart.kode} • {sparepart.merk}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {isLowStock && <AlertTriangle className="w-3 h-3" />}
                    {isLowStock ? 'Stok Kritis' : 'Stok Normal'}
                  </span>
                  <span className="text-xs text-gray-500">{sparepart.satuan || 'pcs'}</span>
                </div>
              </div>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <p className="text-xs sm:text-sm text-gray-500">Stok Saat Ini</p>
              <p className={`text-2xl sm:text-3xl font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                {sparepart.stok}
              </p>
              <p className="text-xs text-gray-500">Min: {sparepart.stokMinimum}</p>
            </div>
          </div>

          {/* Info Detail */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-gray-500">Kategori</p>
              <p className="text-sm font-medium text-gray-800 truncate-mobile">{sparepart.kategori}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-gray-500">Harga Beli</p>
              <p className="text-sm font-medium text-gray-800">{formatRupiah(sparepart.hargaBeli)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-gray-500">Harga Jual</p>
              <p className="text-sm font-medium text-gray-800">{formatRupiah(sparepart.hargaJual)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-gray-500">Supplier</p>
              <p className="text-sm font-medium text-gray-800 truncate-mobile">{sparepart.supplier?.nama || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-gray-500">Lokasi</p>
              <p className="text-sm font-medium text-gray-800 flex items-center gap-1 truncate-mobile">
                <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                {sparepart.lokasi || '-'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-gray-500">Barcode</p>
              <p className="text-sm font-medium text-gray-800 font-mono truncate-mobile">{sparepart.barcode || '-'}</p>
            </div>
          </div>

          {/* Statistik Transaksi */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-700 font-medium">Total Barang Masuk</p>
              </div>
              <p className="text-2xl font-bold text-green-700 mt-1">{totalMasuk} {sparepart.satuan || 'pcs'}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <ArrowUpFromLine className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-700 font-medium">Total Barang Keluar</p>
              </div>
              <p className="text-2xl font-bold text-red-700 mt-1">{totalKeluar} {sparepart.satuan || 'pcs'}</p>
            </div>
          </div>

          {/* Riwayat Transaksi */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Riwayat Transaksi</h4>
            {transactions.length === 0 ? (
              <p className="text-gray-500 text-sm">Belum ada transaksi untuk sparepart ini.</p>
            ) : (
              <div className="space-y-2">
                {transactions.slice(0, 10).map((t) => (
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
                        <p className="text-sm font-medium text-gray-800">{t.nomor}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(t.tanggal).toLocaleDateString('id-ID')} • {t.supplier?.nama || '-'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${t.tipe === 'MASUK' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.tipe === 'MASUK' ? '+' : '-'}{t.jumlah} {sparepart.satuan || 'pcs'}
                      </p>
                      <p className="text-xs text-gray-500">{formatRupiah(t.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aksi */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white pb-2">
            <Link
              to="/barang-masuk"
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm touch-target"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Barang Masuk
            </Link>
            <Link
              to="/barang-keluar"
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm touch-target"
            >
              <ArrowUpFromLine className="w-4 h-4" />
              Barang Keluar
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SparepartDetail