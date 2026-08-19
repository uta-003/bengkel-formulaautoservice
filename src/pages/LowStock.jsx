import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  ArrowDownToLine
} from 'lucide-react'
import { sparepartService } from '../services/sparepartService'
import { db } from '../services/database'
import { toastService } from '../services/toastService'

function LowStock() {
  const [lowStockItems, setLowStockItems] = useState([])
  const [allSpareparts, setAllSpareparts] = useState([])

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const spareparts = await sparepartService.getAll()
        if (!isMounted) return
        setAllSpareparts(spareparts || [])
        setLowStockItems(sparepartService.getLowStock(spareparts))
      } catch (error) {
        console.error('Failed to load data:', error)
        if (isMounted) toastService.error('Gagal memuat data low stock')
      }
    }

    loadData()

    // Listen untuk perubahan data realtime dari perangkat lain
    const handleDBChange = (e) => {
      const { table: changedTable } = e.detail || {}
      if (!changedTable || changedTable === db.keys.SPAREPARTS) {
        loadData()
      }
    }

    window.addEventListener(db.changeEvent, handleDBChange)

    return () => {
      isMounted = false
      window.removeEventListener(db.changeEvent, handleDBChange)
    }
  }, [])

  const criticalItems = lowStockItems.filter(sp => Number(sp.stok) === 0)
  const warningItems = lowStockItems.filter(sp => Number(sp.stok) > 0)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Peringatan Stok Minimum</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">Sparepart yang stoknya berada di bawah atau sama dengan batas minimum</p>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-red-600 font-medium">Stok Habis (0)</p>
              <p className="text-2xl sm:text-3xl font-bold text-red-700 mt-1">{criticalItems.length}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-yellow-600 font-medium">Stok Kritis</p>
              <p className="text-2xl sm:text-3xl font-bold text-yellow-700 mt-1">{warningItems.length}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-green-600 font-medium">Stok Normal</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-700 mt-1">
                {allSpareparts.length - lowStockItems.length}
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {lowStockItems.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
          <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">Semua Stok Normal</h2>
          <p className="text-gray-500 text-sm sm:text-base">Tidak ada sparepart yang berada di bawah stok minimum.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="desktop-table-view bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                Daftar Sparepart Perlu Restock ({lowStockItems.length})
              </h2>
            </div>
            <div className="table-responsive">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kode</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama Sparepart</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Merk</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Stok Saat Ini</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Stok Minimum</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Kekurangan</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lowStockItems.map((sp) => {
                    const kekurangan = sp.stokMinimum - sp.stok
                    const isOut = Number(sp.stok) === 0
                    return (
                      <tr key={sp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{sp.kode}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{sp.nama}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{sp.merk}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold ${
                            isOut ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {sp.stok}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600">{sp.stokMinimum}</td>
                        <td className="px-4 py-3 text-center text-sm font-semibold text-red-600">
                          -{kekurangan}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            isOut
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            <AlertTriangle className="w-3 h-3" />
                            {isOut ? 'Habis' : 'Kritis'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            to="/barang-masuk"
                            className="inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                            Restock
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="mobile-card-view">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-4 border-b border-gray-200">
                <h2 className="text-base font-semibold text-gray-800">
                  Daftar Sparepart Perlu Restock ({lowStockItems.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {lowStockItems.map((sp) => {
                  const kekurangan = sp.stokMinimum - sp.stok
                  const isOut = Number(sp.stok) === 0
                  return (
                    <div key={sp.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate-mobile">{sp.nama}</p>
                          <p className="text-xs text-gray-500">{sp.kode} • {sp.merk}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shrink-0 ${
                          isOut ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          <AlertTriangle className="w-3 h-3" />
                          {isOut ? 'Habis' : 'Kritis'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-[10px] text-gray-500">Stok</p>
                          <p className={`text-sm font-bold ${isOut ? 'text-red-600' : 'text-yellow-600'}`}>{sp.stok}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-[10px] text-gray-500">Minimum</p>
                          <p className="text-sm font-bold text-gray-800">{sp.stokMinimum}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-[10px] text-gray-500">Kurang</p>
                          <p className="text-sm font-bold text-red-600">-{kekurangan}</p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <Link
                          to="/barang-masuk"
                          className="w-full inline-flex items-center justify-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 bg-green-50 rounded-lg py-2.5 touch-target"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                          Restock
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default LowStock