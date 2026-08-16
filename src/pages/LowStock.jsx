import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  ArrowDownToLine
} from 'lucide-react'
import { sparepartService } from '../services/sparepartService'
import { toastService } from '../services/toastService'
import { LoadingScreen } from '../components/LoadingScreen'

function LowStock() {
  const [lowStockItems, setLowStockItems] = useState([])
  const [allSpareparts, setAllSpareparts] = useState([])
  const [loading, setLoading] = useState(true)

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
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  const criticalItems = lowStockItems.filter(sp => Number(sp.stok) === 0)
  const warningItems = lowStockItems.filter(sp => Number(sp.stok) > 0)

  if (loading) {
    return <LoadingScreen message="Memuat data low stock..." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Peringatan Stok Minimum</h1>
        <p className="text-gray-500 mt-1">Sparepart yang stoknya berada di bawah atau sama dengan batas minimum</p>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Stok Habis (0)</p>
              <p className="text-3xl font-bold text-red-700 mt-1">{criticalItems.length}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium">Stok Kritis</p>
              <p className="text-3xl font-bold text-yellow-700 mt-1">{warningItems.length}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Stok Normal</p>
              <p className="text-3xl font-bold text-green-700 mt-1">
                {allSpareparts.length - lowStockItems.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {lowStockItems.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Semua Stok Normal</h2>
          <p className="text-gray-500">Tidak ada sparepart yang berada di bawah stok minimum.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Daftar Sparepart Perlu Restock ({lowStockItems.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
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
      )}
    </div>
  )
}

export default LowStock