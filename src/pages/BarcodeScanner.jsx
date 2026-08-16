import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ScanBarcode,
  Search,
  Package,
  AlertTriangle,
  CheckCircle2,
  ArrowDownToLine,
  ArrowUpFromLine
} from 'lucide-react'
import { sparepartService } from '../services/sparepartService'
import { toastService } from '../services/toastService'
import { formatRupiah } from '../utils/format'
import { LoadingScreen } from '../components/LoadingScreen'

function BarcodeScanner() {
  const [barcodeInput, setBarcodeInput] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [recentScans, setRecentScans] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [allSpareparts, setAllSpareparts] = useState([])
  const [loading, setLoading] = useState(true)
  const inputRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const spareparts = await sparepartService.getAll()
        if (isMounted) {
          setAllSpareparts(spareparts || [])
        }
      } catch (error) {
        console.error('Failed to load spareparts:', error)
        if (isMounted) toastService.error('Gagal memuat data sparepart')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isScanning) {
      inputRef.current?.focus()
    }
  }, [isScanning])

  const handleScan = (e) => {
    e.preventDefault()
    setError('')
    setResult(null)

    const barcode = barcodeInput.trim()
    if (!barcode) {
      setError('Masukkan atau scan kode barcode')
      return
    }

    const sparepart = sparepartService.findByBarcode(barcode, allSpareparts)
    if (!sparepart) {
      setError(`Barcode "${barcode}" tidak ditemukan di database`)
      setRecentScans(prev => [
        { barcode, status: 'NOT_FOUND', timestamp: new Date().toISOString() },
        ...prev
      ].slice(0, 10))
      return
    }

    setResult(sparepart)
    setRecentScans(prev => [
      { barcode, status: 'FOUND', sparepartId: sparepart.id, timestamp: new Date().toISOString() },
      ...prev
    ].slice(0, 10))
    setBarcodeInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleScan(e)
    }
  }

  const isLowStock = result && result.stok <= result.stokMinimum

  if (loading) {
    return <LoadingScreen message="Memuat data barcode..." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Barcode Scanner</h1>
        <p className="text-gray-500 mt-1">Scan barcode sparepart untuk melihat informasi stok</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Scanner</h2>
            <button
              onClick={() => setIsScanning(!isScanning)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isScanning
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ScanBarcode className="w-4 h-4" />
              {isScanning ? 'Scanner Aktif' : 'Aktifkan Scanner'}
            </button>
          </div>

          <form onSubmit={handleScan} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kode Barcode
              </label>
              <div className="relative">
                <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Scan barcode atau ketik manual..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  autoFocus={isScanning}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {isScanning
                  ? 'Scanner aktif - arahkan scanner ke barcode sparepart'
                  : 'Klik "Aktifkan Scanner" untuk mode scan otomatis'}
              </p>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Search className="w-5 h-5" />
              Cari Sparepart
            </button>
          </form>

          {error && (
            <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {/* Hasil Scan */}
          {result && (
            <div className={`mt-4 rounded-xl border p-5 ${
              isLowStock ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {isLowStock ? (
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                )}
                <h3 className="font-semibold text-gray-800">
                  {isLowStock ? 'Stok Kritis!' : 'Sparepart Ditemukan'}
                </h3>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{result.nama}</p>
                    <p className="text-sm text-gray-500">{result.kode} • {result.merk}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500">Stok Saat Ini</p>
                    <p className={`text-xl font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                      {result.stok} pcs
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Stok Minimum</p>
                    <p className="text-xl font-bold text-gray-800">{result.stokMinimum} pcs</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Harga Beli</p>
                    <p className="text-sm font-semibold text-gray-800">{formatRupiah(result.hargaBeli)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Harga Jual</p>
                    <p className="text-sm font-semibold text-gray-800">{formatRupiah(result.hargaJual)}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <Link
                    to="/barang-masuk"
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                  >
                    <ArrowDownToLine className="w-4 h-4" />
                    Barang Masuk
                  </Link>
                  <Link
                    to="/barang-keluar"
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                  >
                    <ArrowUpFromLine className="w-4 h-4" />
                    Barang Keluar
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Riwayat Scan */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Riwayat Scan</h2>
          {recentScans.length === 0 ? (
            <p className="text-gray-500 text-sm">Belum ada scan barcode.</p>
          ) : (
            <div className="space-y-3">
              {recentScans.map((scan, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      scan.status === 'FOUND' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {scan.status === 'FOUND' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium text-gray-800">{scan.barcode}</p>
                      <p className="text-xs text-gray-500">
                        {scan.status === 'FOUND' ? 'Ditemukan' : 'Tidak ditemukan'} •{' '}
                        {new Date(scan.timestamp).toLocaleTimeString('id-ID')}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    scan.status === 'FOUND' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {scan.status === 'FOUND' ? 'OK' : 'NOT FOUND'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daftar Barcode Tersedia */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Daftar Barcode Sparepart</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Barcode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama Sparepart</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Stok</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allSpareparts.map((sp) => (
                <tr key={sp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm text-gray-800">{sp.barcode}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{sp.kode}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">{sp.nama}</td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-gray-800">{sp.stok}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      sp.stok <= sp.stokMinimum
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {sp.stok <= sp.stokMinimum && <AlertTriangle className="w-3 h-3" />}
                      {sp.stok <= sp.stokMinimum ? 'Kritis' : 'Normal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default BarcodeScanner