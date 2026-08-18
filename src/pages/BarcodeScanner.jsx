import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ScanBarcode,
  Search,
  Package,
  AlertTriangle,
  CheckCircle2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  CameraOff,
  Loader2
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { sparepartService } from '../services/sparepartService'
import { scanHistoryService } from '../services/scanHistoryService'
import { toastService } from '../services/toastService'
import { soundService } from '../services/soundService'
import { formatRupiah } from '../utils/format'

function BarcodeScanner() {
  const [barcodeInput, setBarcodeInput] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [recentScans, setRecentScans] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [cameraLoading, setCameraLoading] = useState(false)
  const [allSpareparts, setAllSpareparts] = useState([])
  const inputRef = useRef(null)
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)
  const lastScannedRef = useRef('')
  const lastScanTimeRef = useRef(0)
  const isCameraActiveRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const [spareparts, scanHistory] = await Promise.all([
          sparepartService.getAll(),
          scanHistoryService.getRecentScans(20)
        ])
        if (isMounted) {
          setAllSpareparts(spareparts || [])
          setRecentScans(scanHistory || [])
        }
      } catch (error) {
        console.error('Failed to load data:', error)
        if (isMounted) toastService.error('Gagal memuat data')
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

  // Sync ref dengan state isCameraActive
  useEffect(() => {
    isCameraActiveRef.current = isCameraActive
  }, [isCameraActive])

  // Cleanup saat komponen unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const processBarcode = async (barcode) => {
    const cleanedBarcode = String(barcode).trim()
    if (!cleanedBarcode) return

    // Cegah double scan dalam 1.5 detik
    const now = Date.now()
    if (cleanedBarcode === lastScannedRef.current && now - lastScanTimeRef.current < 1500) {
      return
    }
    lastScannedRef.current = cleanedBarcode
    lastScanTimeRef.current = now

    setError('')
    setResult(null)

    // Selalu cari dari data terbaru di database
    let sparepartsList = allSpareparts
    if (sparepartsList.length === 0) {
      try {
        sparepartsList = await sparepartService.getAll()
        if (sparepartsList) setAllSpareparts(sparepartsList)
      } catch (e) {
        console.error('Failed to reload spareparts:', e)
      }
    }
    const sparepart = sparepartService.findByBarcode(cleanedBarcode, sparepartsList)
    if (!sparepart) {
      setError(`Barcode "${cleanedBarcode}" tidak ditemukan di database`)
      // Simpan riwayat scan NOT_FOUND ke Supabase
      const newScan = {
        barcode: cleanedBarcode,
        status: 'NOT_FOUND',
        sparepartId: null,
        sparepartName: null,
        scannedAt: new Date().toISOString()
      }
      setRecentScans(prev => [newScan, ...prev].slice(0, 20))
      scanHistoryService.addScan(newScan)
      soundService.error()
      return
    }

    setResult(sparepart)
    // Simpan riwayat scan FOUND ke Supabase
    const newScan = {
      barcode: cleanedBarcode,
      status: 'FOUND',
      sparepartId: sparepart.id,
      sparepartName: sparepart.nama,
      scannedAt: new Date().toISOString()
    }
    setRecentScans(prev => [newScan, ...prev].slice(0, 20))
    scanHistoryService.addScan(newScan)
    setBarcodeInput('')
    soundService.scan()
  }

  const handleScan = (e) => {
    e.preventDefault()
    setError('')
    setResult(null)

    const barcode = barcodeInput.trim()
    if (!barcode) {
      setError('Masukkan atau scan kode barcode')
      return
    }

    processBarcode(barcode)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleScan(e)
    }
  }

  const startCamera = async () => {
    setCameraError('')
    setCameraLoading(true)

    try {
      // Pastikan elemen scanner tersedia
      if (!scannerRef.current) {
        throw new Error('Elemen scanner tidak ditemukan')
      }

      // Bersihkan elemen jika sudah ada scan area sebelumnya
      scannerRef.current.innerHTML = ''

      const html5QrCode = new Html5Qrcode('barcode-scanner-area')
      html5QrCodeRef.current = html5QrCode

      const cameras = await Html5Qrcode.getCameras()
      if (!cameras || cameras.length === 0) {
        throw new Error('Tidak ada kamera yang terdeteksi')
      }

      // Pilih kamera belakang jika ada (biasanya index terakhir atau id dengan 'back')
      const backCamera = cameras.find(c =>
        c.label.toLowerCase().includes('back') ||
        c.label.toLowerCase().includes('belakang') ||
        c.label.toLowerCase().includes('environment')
      ) || cameras[cameras.length - 1]

      await html5QrCode.start(
        backCamera.id,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          // Sukses scan
          processBarcode(decodedText)
        },
        () => {
          // Error scan (biasanya setiap frame tanpa barcode) - abaikan
        }
      )

      setIsCameraActive(true)
      isCameraActiveRef.current = true
    } catch (err) {
      console.error('Camera error:', err)
      // Bersihkan jika ada yang sudah ter-set
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.clear()
        } catch {
          // abaikan
        }
        html5QrCodeRef.current = null
      }
      isCameraActiveRef.current = false
      setCameraError(
        err.message === 'Tidak ada kamera yang terdeteksi'
          ? 'Tidak ada kamera yang terdeteksi di perangkat ini'
          : 'Gagal mengakses kamera. Pastikan izin kamera diberikan dan gunakan HTTPS atau localhost.'
      )
      soundService.error()
    } finally {
      setCameraLoading(false)
    }
  }

  const stopCamera = async () => {
    if (html5QrCodeRef.current && isCameraActiveRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current.clear()
      } catch (err) {
        console.warn('Error stopping camera:', err)
      }
      html5QrCodeRef.current = null
      setIsCameraActive(false)
      isCameraActiveRef.current = false

      // Bersihkan area scanner
      if (scannerRef.current) {
        scannerRef.current.innerHTML = ''
      }
    }
  }

  const handleToggleCamera = async () => {
    soundService.click()
    if (isCameraActive) {
      await stopCamera()
    } else {
      await startCamera()
    }
  }

  const isLowStock = result && result.stok <= result.stokMinimum

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Barcode Scanner</h1>
        <p className="text-gray-500 mt-1">Scan barcode sparepart menggunakan kamera HP atau masukkan manual</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Scanner</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsScanning(!isScanning)
                  soundService.click()
                }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isScanning
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <ScanBarcode className="w-4 h-4" />
                {isScanning ? 'Keyboard Aktif' : 'Aktifkan Keyboard'}
              </button>
              <button
                onClick={handleToggleCamera}
                disabled={cameraLoading}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isCameraActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-brand-600 text-white hover:bg-brand-700'
                }`}
              >
                {cameraLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCameraActive ? (
                  <CameraOff className="w-4 h-4" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                {cameraLoading ? 'Memuat...' : isCameraActive ? 'Matikan Kamera' : 'Scan dengan Kamera'}
              </button>
            </div>
          </div>

          {/* Area Kamera */}
          <div className="mb-4">
            <div
              id="barcode-scanner-area"
              ref={scannerRef}
              className={`rounded-lg overflow-hidden bg-black transition-all ${
                isCameraActive ? 'block' : 'hidden'
              }`}
            />
            {cameraError && (
              <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                <CameraOff className="w-4 h-4 shrink-0" />
                <div>
                  <p className="font-medium">Kamera tidak dapat diakses</p>
                  <p className="text-xs mt-1">{cameraError}</p>
                </div>
              </div>
            )}
            {!isCameraActive && !cameraError && (
              <div className="mt-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 text-center">
                <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  Klik <span className="font-semibold text-brand-600">"Scan dengan Kamera"</span> untuk mengaktifkan kamera HP
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Arahkan kamera ke barcode sparepart untuk scan otomatis
                </p>
              </div>
            )}
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
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-lg"
                  autoFocus={isScanning}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {isCameraActive
                  ? 'Kamera aktif - arahkan kamera ke barcode sparepart'
                  : isScanning
                    ? 'Mode keyboard aktif - scan barcode menggunakan scanner USB'
                    : 'Gunakan tombol kamera untuk scan otomatis dengan kamera HP'}
              </p>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25"
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
                    <Package className="w-6 h-6 text-brand-600" />
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
                      {scan.sparepartName && (
                        <p className="text-xs text-gray-600">{scan.sparepartName}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {scan.status === 'FOUND' ? 'Ditemukan' : 'Tidak ditemukan'} •{' '}
                        {new Date(scan.scannedAt || scan.timestamp || scan.createdAt).toLocaleTimeString('id-ID')}
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

          {/* Panduan Penggunaan */}
          <div className="mt-6 bg-brand-50 border border-brand-100 rounded-lg p-4">
            <h3 className="font-semibold text-brand-800 text-sm mb-2">Panduan Scan dengan Kamera</h3>
            <ul className="text-xs text-brand-700 space-y-1.5">
              <li>• Klik tombol <span className="font-semibold">"Scan dengan Kamera"</span></li>
              <li>• Izinkan akses kamera saat diminta browser</li>
              <li>• Arahkan kamera ke barcode sparepart</li>
              <li>• Scan akan terjadi otomatis saat barcode terdeteksi</li>
              <li>• Gunakan <span className="font-semibold">HTTPS</span> atau <span className="font-semibold">localhost</span> untuk akses kamera</li>
            </ul>
          </div>
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