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
  Loader2,
  RefreshCw,
  SunMedium,
  Printer,
  X,
  Check,
  Trash2
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { MultiFormatReader } from '@zxing/library'
import { sparepartService } from '../services/sparepartService'
import { scanHistoryService } from '../services/scanHistoryService'
import { transactionService } from '../services/transactionService'
import { toastService } from '../services/toastService'
import { db } from '../services/database'
import { soundService } from '../services/soundService'
import { formatRupiah } from '../utils/format'
import BarcodeLabel from '../components/BarcodeLabel'

function BarcodeScanner() {
  const [barcodeInput, setBarcodeInput] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [recentScans, setRecentScans] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraFacing, setCameraFacing] = useState('environment')
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [allCameras, setAllCameras] = useState([])
  const [allSpareparts, setAllSpareparts] = useState([])
  const [selectedForPrint, setSelectedForPrint] = useState(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [engineMode, setEngineMode] = useState('auto') // 'auto' | 'html5' | 'zxing'
  const isSecureContext = typeof window !== 'undefined' ? window.isSecureContext !== false : true
  const inputRef = useRef(null)
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)
  const zxingReaderRef = useRef(null)
  const zxingVideoRef = useRef(null)
  const streamRef = useRef(null)
  const lastScannedRef = useRef('')
  const lastScanTimeRef = useRef(0)
  const isCameraActiveRef = useRef(false)
  const cameraFacingRef = useRef('environment')
  const stopRequestedRef = useRef(false)

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

    // Listen untuk perubahan data realtime dari perangkat lain
    const handleDBChange = (e) => {
      const { table: changedTable } = e.detail || {}
      if (!changedTable || changedTable === db.keys.SPAREPARTS || changedTable === db.keys.SCAN_HISTORY) {
        loadData()
      }
    }

    window.addEventListener(db.changeEvent, handleDBChange)

    return () => {
      isMounted = false
      window.removeEventListener(db.changeEvent, handleDBChange)
      stopAllCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isScanning) {
      inputRef.current?.focus()
    }
  }, [isScanning])

  // Sync ref dengan state
  useEffect(() => {
    isCameraActiveRef.current = isCameraActive
  }, [isCameraActive])

  useEffect(() => {
    cameraFacingRef.current = cameraFacing
  }, [cameraFacing])

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
      // Simpan riwayat scan NOT_FOUND ke database terintegrasi
      const newScan = {
        barcode: cleanedBarcode,
        status: 'NOT_FOUND',
        sparepartId: null,
        sparepartName: null,
        scannedAt: new Date().toISOString()
      }
      setRecentScans(prev => [newScan, ...prev].slice(0, 20))
      try {
        await scanHistoryService.addScan(newScan)
      } catch (e) {
        console.warn('Gagal simpan riwayat scan:', e)
      }
      soundService.error()
      return
    }

    // Cek stok mencukupi sebelum kurangi
    if (Number(sparepart.stok || 0) <= 0) {
      setError(`Stok "${sparepart.nama}" sudah habis (0 pcs). Tidak dapat melakukan scan keluar.`)
      const newScan = {
        barcode: cleanedBarcode,
        status: 'NOT_FOUND',
        sparepartId: sparepart.id,
        sparepartName: sparepart.nama,
        scannedAt: new Date().toISOString()
      }
      setRecentScans(prev => [newScan, ...prev].slice(0, 20))
      try {
        await scanHistoryService.addScan(newScan)
      } catch (e) {
        console.warn('Gagal simpan riwayat scan:', e)
      }
      soundService.error()
      return
    }

    const stokSebelum = Number(sparepart.stok || 0)
    const stokSesudah = stokSebelum - 1

    // Kurangi stok otomatis 1 pcs setiap scan (tercatat sebagai transaksi Barang Keluar)
    try {
      await transactionService.barangKeluar({
        sparepartId: sparepart.id,
        jumlah: 1,
        keterangan: `Scan barcode keluar: ${cleanedBarcode}`
      })
    } catch (e) {
      console.error('Gagal mengurangi stok:', e)
      setError(`Gagal mengurangi stok: ${e.message || 'Terjadi kesalahan'}`)
      soundService.error()
      return
    }

    // Update data sparepart di state lokal
    const updatedSparepart = { ...sparepart, stok: stokSesudah }
    setAllSpareparts(prev => prev.map(sp => sp.id === sparepart.id ? updatedSparepart : sp))
    setResult(updatedSparepart)

    // Simpan riwayat scan FOUND ke database terintegrasi
    const newScan = {
      barcode: cleanedBarcode,
      status: 'FOUND',
      sparepartId: sparepart.id,
      sparepartName: sparepart.nama,
      scannedAt: new Date().toISOString(),
      stokSebelum,
      stokSesudah
    }
    setRecentScans(prev => [newScan, ...prev].slice(0, 20))
    try {
      await scanHistoryService.addScan(newScan)
    } catch (e) {
      console.warn('Gagal simpan riwayat scan:', e)
    }
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

  // Cek dukungan kamera & izin sebelum buka kamera
  const checkCameraSupport = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Browser tidak mendukung akses kamera. Gunakan Chrome, Safari, atau Edge terbaru.')
    }

    // Cek apakah halaman diakses via HTTPS (kamera hanya jalan di secure context)
    if (!window.isSecureContext) {
      throw new Error('BROWSER_SECURITY')
    }

    // Cek izin kamera sudah diberikan atau belum
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'camera' })
      if (permissionStatus.state === 'denied') {
        throw new Error('PERMISSION_DENIED')
      }
    } catch {
      // Beberapa browser tidak support permissions API - lanjutkan saja
    }
  }

  // === Engine 1: Html5Qrcode (primary, paling kompatibel untuk barcode EAN-13) ===
  const startHtml5QrCode = async (facing) => {
    // Bersihkan area scanner terlebih dahulu
    if (scannerRef.current) {
      scannerRef.current.innerHTML = ''
    }

    const html5QrCode = new Html5Qrcode('barcode-scanner-area')
    html5QrCodeRef.current = html5QrCode

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    const config = {
      fps: 10,
      qrbox: { width: isMobile ? 260 : 250, height: isMobile ? 260 : 250 },
      aspectRatio: isMobile ? undefined : 1.0,
      disableFlip: false
    }

    let cameraArgs
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter(d => d.kind === 'videoinput')

    if (videoDevices.length > 1) {
      // Pilih kamera berdasarkan facing yang diminta
      const target = facing === 'environment'
        ? videoDevices.find(d => {
            const label = (d.label || '').toLowerCase()
            return label.includes('back') || label.includes('belakang') || label.includes('rear') || label.includes('environment')
          })
        : videoDevices.find(d => {
            const label = (d.label || '').toLowerCase()
            return label.includes('front') || label.includes('depan') || label.includes('user') || label.includes('selfie')
          })
      cameraArgs = target ? { deviceId: { exact: target.deviceId } } : { facingMode: facing }
    } else {
      // Hanya 1 kamera - pakai facingMode langsung (paling kompatibel mobile)
      cameraArgs = { facingMode: facing }
    }

    // Pastikan elemen video terlihat & memiliki ukuran sebelum start
    scannerRef.current?.classList.remove('hidden')
    scannerRef.current?.classList.add('block')

    await html5QrCode.start(
      cameraArgs,
      config,
      (decodedText) => {
        processBarcode(decodedText)
      },
      () => {
        // Error scan per frame - abaikan (ini normal saat tidak ada barcode)
      }
    )
  }

  // === Engine 2: ZXing (fallback, deteksi lebih lanjut & berbagai format) ===
  const startZxingReader = async (facing) => {
    if (scannerRef.current) {
      scannerRef.current.innerHTML = ''
    }

    const reader = new MultiFormatReader()
    zxingReaderRef.current = reader

    // Buat video element untuk zxing
    const videoEl = document.createElement('video')
    videoEl.setAttribute('muted', 'true')
    videoEl.setAttribute('playsinline', 'true')
    videoEl.style.width = '100%'
    videoEl.style.height = '280px'
    videoEl.style.objectFit = 'cover'
    scannerRef.current?.appendChild(videoEl)
    zxingVideoRef.current = videoEl

    // Akses kamera langsung via getUserMedia (lebih reliable)
    const constraints = {
      audio: false,
      video: {
        facingMode: facing === 'environment' ? 'environment' : 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    streamRef.current = stream
    videoEl.srcObject = stream
    await videoEl.play()

    // Mulai decoding loop
    const decodeLoop = async () => {
      if (!zxingReaderRef.current || stopRequestedRef.current || !zxingVideoRef.current) return
      try {
        const result = await zxingReaderRef.current.decodeFromVideoElement(zxingVideoRef.current)
        if (result) {
          processBarcode(result.getText())
        }
      } catch (e) {
        // No barcode ditemukan di frame ini - tetap coba
      }
      // Loop terus
      setTimeout(decodeLoop, 100)
    }
    decodeLoop()
  }

  // === Multi-engine start (auto fallback) ===
  const startCamera = async () => {
    setCameraError('')
    setCameraLoading(true)
    stopRequestedRef.current = false

    try {
      await checkCameraSupport()

      // Pastikan elemen scanner tersedia
      if (!scannerRef.current) {
        throw new Error('Elemen scanner tidak ditemukan')
      }

      // Bersihkan elemen scan area
      scannerRef.current.innerHTML = ''

      // Aktifkan UI SEBELUM start() (penting - video perlu punya ukuran)
      scannerRef.current.classList.remove('hidden')
      scannerRef.current.classList.add('block')
      setIsCameraActive(true)
      isCameraActiveRef.current = true

      // Siapkan enumerateDevices untuk pendeteksian kamera
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(d => d.kind === 'videoinput')
        setAllCameras(videoDevices)
      } catch {
        setAllCameras([])
      }

      const facing = cameraFacingRef.current || 'environment'

      try {
        // Coba html5-qrcode dulu (paling baik untuk barcode EAN)
        await startHtml5QrCode(facing)
        setEngineMode('html5')
      } catch (html5Error) {
        console.warn('html5-qrcode gagal, coba ZXing:', html5Error)
        // Bersihkan
        if (html5QrCodeRef.current) {
          try {
            await html5QrCodeRef.current.stop()
            html5QrCodeRef.current.clear()
          } catch {}
          html5QrCodeRef.current = null
        }
        scannerRef.current.innerHTML = ''

        // Coba ZXing sebagai fallback
        try {
          await startZxingReader(facing)
          setEngineMode('zxing')
        } catch (zxingError) {
          console.error('ZXing juga gagal:', zxingError)
          throw html5Error // Lapor error dari engine utama
        }
      }

      setCameraLoading(false)
    } catch (err) {
      console.error('Camera error:', err)
      await stopAllCamera()
      setCameraError(getCameraErrorMessage(err))
      soundService.error()
      setCameraLoading(false)
    }
  }

  const getCameraErrorMessage = (err) => {
    if (err?.message === 'BROWSER_SECURITY') {
      return 'Kamera hanya dapat diakses melalui HTTPS atau localhost. Halaman ini sedang dibuka melalui HTTP biasa, sehingga browser memblokir akses kamera. Gunakan https:// atau http://localhost.'
    }
    if (err?.message === 'PERMISSION_DENIED' || err?.name === 'NotAllowedError') {
      return 'Izin kamera ditolak. Klik ikon gembok 🔒 di address bar browser, lalu izinkan akses kamera, kemudian coba lagi.'
    }
    if (err?.name === 'NotFoundError' || err?.message === 'Tidak ada kamera yang terdeteksi') {
      return 'Tidak ada kamera yang terdeteksi di perangkat ini.'
    }
    if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
      return 'Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi lain yang memakai kamera, lalu coba lagi.'
    }
    if (err?.name === 'OverconstrainedError') {
      return 'Kamera tidak mendukung mode yang diminta. Coba ganti kamera atau gunakan mode auto.'
    }
    return err?.message || 'Gagal mengakses kamera. Pastikan izin kamera diberikan dan gunakan HTTPS atau localhost.'
  }

  const stopAllCamera = async () => {
    stopRequestedRef.current = true

    // Stop HTML5 QR
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current.clear()
      } catch (err) {
        console.warn('Error stopping html5 camera:', err)
      }
      html5QrCodeRef.current = null
    }

    // Stop ZXing
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset()
      } catch {}
      zxingReaderRef.current = null
    }

    // Stop semua media tracks
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop())
      } catch {}
      streamRef.current = null
    }

    // Bersihkan video
    if (zxingVideoRef.current) {
      zxingVideoRef.current.srcObject = null
      zxingVideoRef.current = null
    }

    // Bersihkan area scanner
    if (scannerRef.current) {
      scannerRef.current.innerHTML = ''
    }

    setIsCameraActive(false)
    isCameraActiveRef.current = false
    setIsTorchOn(false)
  }

  const handleToggleCamera = async () => {
    soundService.click()
    if (isCameraActive) {
      await stopAllCamera()
    } else {
      await startCamera()
    }
  }

  const handleToggleTorch = async () => {
    soundService.click()
    const nextState = !isTorchOn
    setIsTorchOn(nextState)
    try {
      // Jika memakai stream langsung, toggle torch via track constraints
      if (streamRef.current) {
        const track = streamRef.current.getVideoTracks()[0]
        await track.applyConstraints({ advanced: [{ torch: nextState }] })
      }
      // Visual effect untuk semua mode
      const scannerArea = document.getElementById('barcode-scanner-area')
      if (scannerArea) {
        scannerArea.style.filter = nextState ? 'brightness(1.25)' : 'none'
      }
    } catch (err) {
      console.warn('Torch tidak didukung:', err)
      setError('Fitur senter tidak didukung pada kamera ini')
    }
  }

  // Ganti kamera depan/belakang
  const handleSwitchCamera = async () => {
    soundService.click()
    const newFacing = cameraFacingRef.current === 'environment' ? 'user' : 'environment'
    cameraFacingRef.current = newFacing
    setCameraFacing(newFacing)

    // Jika kamera sedang aktif, restart dengan kamera baru
    if (isCameraActive) {
      await stopAllCamera()
      await startCamera()
    }
  }

  const handleRetryCamera = async () => {
    await stopAllCamera()
    await startCamera()
  }

  const handlePrintLabel = (sparepart) => {
    setSelectedForPrint(sparepart)
    setShowPrintModal(true)
    soundService.click()
  }

  const handlePrint = () => {
    if (selectedForPrint) {
      // Tunggu render barcode selesai lalu print
      setTimeout(() => {
        window.print()
      }, 300)
    }
  }

  // Konfirmasi scan (tandai status OK)
  const handleConfirmScan = async (scan) => {
    if (!scan || scan.id === null || scan.id === undefined) return
    soundService.click()
    try {
      await scanHistoryService.updateStatus(scan.id, 'OK')
      setRecentScans(prev => prev.map(s =>
        s.id === scan.id ? { ...s, status: 'OK' } : s
      ))
      toastService.success('Scan dikonfirmasi')
    } catch (e) {
      console.error('Gagal konfirmasi scan:', e)
      toastService.error('Gagal mengkonfirmasi scan')
    }
  }

  // Hapus riwayat scan
  const handleDeleteScan = async (scan) => {
    if (!scan || scan.id === null || scan.id === undefined) return
    soundService.click()
    try {
      await scanHistoryService.deleteScan(scan.id)
      setRecentScans(prev => prev.filter(s => s.id !== scan.id))
      toastService.success('Riwayat scan dihapus')
    } catch (e) {
      console.error('Gagal hapus riwayat scan:', e)
      toastService.error('Gagal menghapus riwayat scan')
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
              className={`relative rounded-lg overflow-hidden bg-black transition-all scanline-animation ${
                isCameraActive || cameraLoading ? 'block' : 'hidden'
              }`}
              style={{ minHeight: isCameraActive || cameraLoading ? '280px' : '0' }}
            />
            {isCameraActive && (
              <div className="flex items-center justify-center mt-3">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  Engine: <b>{engineMode === 'zxing' ? 'ZXing Advanced' : 'Html5 QR'}</b>
                </span>
              </div>
            )}
            {isCameraActive && allCameras.length > 1 && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSwitchCamera}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Ganti ke Kamera {cameraFacing === 'environment' ? 'Depan' : 'Belakang'}
                </button>
                <button
                  onClick={handleToggleTorch}
                  className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                    isTorchOn
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={isTorchOn ? 'Matikan Senter' : 'Nyalakan Senter'}
                >
                  <SunMedium className="w-4 h-4" />
                  Sent
                </button>
              </div>
            )}
            {cameraError && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                <div className="flex items-start gap-2">
                  <CameraOff className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Kamera tidak dapat diakses</p>
                    <p className="text-xs mt-1">{cameraError}</p>
                    <button
                      onClick={handleRetryCamera}
                      className="mt-2 inline-flex items-center font-semibold text-red-800 hover:text-red-900 gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Coba lagi
                    </button>
                  </div>
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
            {!isSecureContext && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg">
                <p className="font-medium">⚠️ Halaman ini bukan secure context</p>
                <p className="text-xs mt-0.5">
                  Kamera diblokir browser karena diakses melalui HTTP biasa.
                  Gunakan <span className="font-semibold">https://</span> atau{' '}
                  <span className="font-semibold">http://localhost</span>.
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

                <div className="flex flex-col sm:flex-row gap-2 pt-3">
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
                  <button
                    onClick={() => handlePrintLabel(result)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Cetak Label
                  </button>
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
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        scan.status === 'FOUND' || scan.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {scan.status === 'FOUND' || scan.status === 'OK' ? (
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
                          {scan.status === 'OK' ? 'Dikonfirmasi' : scan.status === 'FOUND' ? 'Ditemukan' : 'Tidak ditemukan'} •{' '}
                          {new Date(scan.scannedAt || scan.timestamp || scan.createdAt).toLocaleTimeString('id-ID')}
                        </p>
                        {scan.stokSebelum !== null && scan.stokSesudah !== null && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Stok: <span className="font-medium text-gray-700">{scan.stokSebelum} → {scan.stokSesudah} pcs</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      scan.status === 'OK' ? 'bg-blue-100 text-blue-700' : scan.status === 'FOUND' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {scan.status === 'OK' ? 'OK' : scan.status === 'FOUND' ? 'FOUND' : 'NOT FOUND'}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={() => handleConfirmScan(scan)}
                      disabled={scan.status === 'OK'}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="w-3.5 h-3.5" />
                      OK
                    </button>
                    <button
                      onClick={() => handleDeleteScan(scan)}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus
                    </button>
                  </div>
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
              <li>• Gunakan tombol <span className="font-semibold">Senter</span> untuk lampu saat ruangan gelap</li>
              <li>• Gunakan tombol <span className="font-semibold">"Cetak Label"</span> untuk mencetak barcode label</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Daftar Barcode Tersedia */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Daftar Barcode Sparepart</h2>
          <span className="text-xs text-gray-500">{allSpareparts.length} items</span>
        </div>
        <div className="table-responsive">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Barcode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama Sparepart</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Stok</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Label</th>
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
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handlePrintLabel(sp)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                      title="Cetak label barcode"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Cetak Label
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cetak Label */}
      {showPrintModal && selectedForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowPrintModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Cetak Label Barcode</h2>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {/* Preview label */}
              <div className="labels-grid">
                <BarcodeLabel sparepart={selectedForPrint} />
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Printer className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold mb-1">Cara mencetak:</p>
                    <ol className="list-decimal ml-4 space-y-0.5">
                      <li>Klik tombol <b>Cetak Label</b></li>
                      <li>Pilih printer stiker/label di dialog print</li>
                      <li>Label barcode siap ditempel & bisa discan dengan kamera HP</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Label
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BarcodeScanner
