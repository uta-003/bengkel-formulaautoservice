import { useEffect, useRef, useState } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  AlertTriangle,
  X,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Printer
} from 'lucide-react'
import { sparepartService } from '../services/sparepartService'
import { supplierService } from '../services/supplierService'
import { authService } from '../services/authService'
import { rbacService } from '../services/rbacService'
import { toastService } from '../services/toastService'
import { db } from '../services/database'
import SparepartDetail from '../components/SparepartDetail'
import { formatRupiah } from '../utils/format'
import { generateBarcode, generateKodeSparepart } from '../utils/barcode'
import { soundService } from '../services/soundService'
import BarcodeLabel from '../components/BarcodeLabel'

const emptyForm = {
  kode: '',
  nama: '',
  kategori: '',
  merk: '',
  supplierId: '',
  hargaBeli: '',
  hargaJual: '',
  stok: '',
  stokMinimum: '',
  garansiBulan: '',
  lokasi: '',
  barcode: '',
  satuan: 'pcs'
}

function Sparepart() {
  const [spareparts, setSpareparts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [filterKategori, setFilterKategori] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [importResult, setImportResult] = useState('')
  const [selectedForPrint, setSelectedForPrint] = useState(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const fileInputRef = useRef(null)
  const itemsPerPage = 10

  const currentUser = authService.getCurrentUser()
  const canCreate = rbacService.canCreateSparepart(currentUser?.role)

  const loadData = async () => {
    try {
      const [sparepartsData, suppliersData] = await Promise.all([
        sparepartService.getAll(),
        supplierService.getAll()
      ])
      setSpareparts(sparepartsData || [])
      setSuppliers(suppliersData || [])
    } catch (error) {
      console.error('Failed to load sparepart data:', error)
      toastService.error('Gagal memuat data sparepart')
      setSpareparts([])
      setSuppliers([])
    }
  }

  useEffect(() => {
    loadData()

    // Listen untuk perubahan data realtime dari perangkat lain
    const handleDBChange = (e) => {
      const { table: changedTable } = e.detail || {}
      if (!changedTable || changedTable === db.keys.SPAREPARTS || changedTable === db.keys.SUPPLIERS) {
        loadData()
      }
    }

    window.addEventListener(db.changeEvent, handleDBChange)

    return () => {
      window.removeEventListener(db.changeEvent, handleDBChange)
    }
  }, [])

  const categories = sparepartService.getCategories(spareparts)

  const filteredSpareparts = (spareparts || []).filter(sp => {
    const matchesSearch = !search || sparepartService.search(search, spareparts).some(s => s.id === sp.id)
    const matchesKategori = !filterKategori || sp.kategori === filterKategori
    return matchesSearch && matchesKategori
  })

  // Pagination
  const totalPages = Math.ceil(filteredSpareparts.length / itemsPerPage)
  const paginatedSpareparts = filteredSpareparts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterKategori])

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const result = await sparepartService.importFromCSV(event.target.result)
        setImportResult(`Berhasil import ${result.imported} data sparepart${result.errors.length > 0 ? `, ${result.errors.length} error` : ''}`)
        if (result.errors.length > 0) {
          console.warn('Import errors:', result.errors)
        }
        loadData()
        toastService.success(`Berhasil import ${result.imported} data sparepart`)
        soundService.import()
      } catch (err) {
        setImportResult(`Error: ${err.message}`)
        toastService.error(err.message)
        soundService.error()
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleExport = () => {
    const { headers, rows, filename } = sparepartService.exportToCSV(spareparts)
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    soundService.export()
  }

  // Generate barcode otomatis berdasarkan ID sparepart
  const generateBarcodeForForm = () => {
    const existingBarcodes = new Set(spareparts.map(sp => sp.barcode).filter(Boolean))
    let newBarcode
    let counter = 0
    do {
      newBarcode = generateBarcode(spareparts.length + 1 + counter)
      counter++
    } while (existingBarcodes.has(newBarcode) && counter < 100)
    return newBarcode
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.nama || !form.kategori || !form.merk) {
      setError('Nama, kategori, dan merk wajib diisi')
      return
    }
    if (!form.supplierId) {
      setError('Supplier wajib dipilih')
      return
    }
    if (!form.hargaBeli || !form.hargaJual) {
      setError('Harga beli dan harga jual wajib diisi')
      return
    }
    if (!form.stok || !form.stokMinimum) {
      setError('Stok dan stok minimum wajib diisi')
      return
    }

    const data = {
      ...form,
      supplierId: Number(form.supplierId),
      hargaBeli: Number(form.hargaBeli),
      hargaJual: Number(form.hargaJual),
      stok: Number(form.stok),
      stokMinimum: Number(form.stokMinimum),
      garansiBulan: Number(form.garansiBulan || 0)
    }

    try {
      if (editingId) {
        await sparepartService.update(editingId, data)
        toastService.success(`Sparepart "${form.nama}" berhasil diubah`)
        soundService.edit()
      } else {
        await sparepartService.create(data)
        toastService.success(`Sparepart "${form.nama}" berhasil ditambahkan`)
        soundService.add()
      }
      setShowModal(false)
      setForm(emptyForm)
      setEditingId(null)
      loadData()
    } catch (err) {
      setError(err.message)
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleEdit = (sp) => {
    setEditingId(sp.id)
    setForm({
      kode: sp.kode,
      nama: sp.nama,
      kategori: sp.kategori,
      merk: sp.merk,
      supplierId: sp.supplierId,
      hargaBeli: sp.hargaBeli,
      hargaJual: sp.hargaJual,
      stok: sp.stok,
      stokMinimum: sp.stokMinimum,
      garansiBulan: sp.garansiBulan || 0,
      lokasi: sp.lokasi,
      barcode: sp.barcode,
      satuan: sp.satuan || 'pcs'
    })
    setShowModal(true)
  }

  const handleDelete = async (sp) => {
    if (confirm(`Hapus sparepart "${sp.nama}"?`)) {
      try {
        await sparepartService.delete(sp.id)
        toastService.success(`Sparepart "${sp.nama}" berhasil dihapus`)
        soundService.delete()
        loadData()
      } catch (err) {
        toastService.error(err.message)
        soundService.error()
      }
    }
  }

  const handleAdd = () => {
    setEditingId(null)
    const nextId = spareparts.length + 1
    setForm({
      ...emptyForm,
      kode: generateKodeSparepart(nextId),
      barcode: generateBarcodeForForm()
    })
    setError('')
    setShowModal(true)
    soundService.click()
  }

  const handleRegenerateBarcode = () => {
    const newBarcode = generateBarcodeForForm()
    setForm({ ...form, barcode: newBarcode })
    soundService.click()
  }

  const handlePrintLabel = (sp) => {
    setSelectedForPrint(sp)
    setShowPrintModal(true)
    soundService.click()
  }

  const handlePrint = () => {
    if (selectedForPrint) {
      setTimeout(() => {
        window.print()
      }, 300)
    }
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Manajemen Data Sparepart</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Kelola data sparepart inventori</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
          >
            <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Import CSV</span>
            <span className="sm:hidden">Import</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
          {canCreate && (
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25 text-sm"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Tambah Sparepart</span>
              <span className="sm:hidden">Tambah</span>
            </button>
          )}
        </div>
      </div>

      {importResult && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          importResult.startsWith('Error')
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {importResult}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama, kode, merk, barcode, atau supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
          />
        </div>
        <select
          value={filterKategori}
          onChange={(e) => setFilterKategori(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
        >
          <option value="">Semua Kategori</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Table - Desktop & Tablet */}
      <div className="desktop-table-view bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="table-responsive">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Barcode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama Sparepart</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kategori</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Merk</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Harga Beli</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Harga Jual</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Stok</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Min</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSpareparts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    Tidak ada data sparepart
                  </td>
                </tr>
              ) : (
                paginatedSpareparts.map((sp) => (
                  <tr key={sp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{sp.kode}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {sp.barcode || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{sp.nama}</p>
                          <p className="text-xs text-gray-500">Barcode: {sp.barcode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{sp.kategori}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{sp.merk}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{sp.supplier?.nama || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{formatRupiah(sp.hargaBeli)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{formatRupiah(sp.hargaJual)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        sp.stok <= sp.stokMinimum
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {sp.stok <= sp.stokMinimum && <AlertTriangle className="w-3 h-3" />}
                        {sp.stok}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">{sp.stokMinimum}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setDetailId(sp.id)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Detail"
                        >
                          <Package className="w-4 h-4" />
                        </button>
                        {canCreate && (
                          <button
                            onClick={() => handleEdit(sp)}
                            className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canCreate && (
                          <button
                            onClick={() => handleDelete(sp)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handlePrintLabel(sp)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Cetak Label"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card View - Mobile */}
      <div className="mobile-card-view space-y-3">
        {filteredSpareparts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Tidak ada data sparepart</p>
          </div>
        ) : (
          paginatedSpareparts.map((sp) => (
            <div key={sp.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    sp.stok <= sp.stokMinimum ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'
                  }`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate-mobile">{sp.nama}</p>
                    <p className="text-xs text-gray-500">{sp.kode} • {sp.merk}</p>
                    <p className="text-xs text-gray-400 font-mono truncate-mobile mt-0.5">Barcode: {sp.barcode || '-'}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shrink-0 ${
                  sp.stok <= sp.stokMinimum ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {sp.stok <= sp.stokMinimum && <AlertTriangle className="w-3 h-3" />}
                  Stok: {sp.stok}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-500">Kategori</p>
                  <p className="font-medium text-gray-800 truncate-mobile">{sp.kategori}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-500">Supplier</p>
                  <p className="font-medium text-gray-800 truncate-mobile">{sp.supplier?.nama || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-500">Harga Beli</p>
                  <p className="font-medium text-gray-800">{formatRupiah(sp.hargaBeli)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-500">Harga Jual</p>
                  <p className="font-medium text-gray-800">{formatRupiah(sp.hargaJual)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">Min: {sp.stokMinimum} pcs</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setDetailId(sp.id)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors touch-target"
                    title="Detail"
                  >
                    <Package className="w-4 h-4" />
                  </button>
                  {canCreate && (
                    <button
                      onClick={() => handleEdit(sp)}
                      className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors touch-target"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {canCreate && (
                    <button
                      onClick={() => handleDelete(sp)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-target"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handlePrintLabel(sp)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-target"
                    title="Cetak Label"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3">
          <p className="text-xs sm:text-sm text-gray-500">
            Menampilkan {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredSpareparts.length)} dari {filteredSpareparts.length} data
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed touch-target"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/25'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed touch-target"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto modal-mobile">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                {editingId ? 'Edit Sparepart' : 'Tambah Sparepart'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 touch-target">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kode Sparepart</label>
                  <input
                    type="text"
                    className={`${inputClass} bg-gray-100 cursor-not-allowed`}
                    value={form.kode}
                    readOnly
                    disabled
                    placeholder="Otomatis"
                  />
                  <p className="mt-1 text-xs text-gray-500">Kode sparepart otomatis (tidak bisa diubah)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Sparepart *</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.nama}
                    onChange={(e) => setForm({ ...form, nama: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori *</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.kategori}
                    onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                    placeholder="Contoh: Filter, Rem, Kelistrikan"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Merk *</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.merk}
                    onChange={(e) => setForm({ ...form, merk: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                  <select
                    className={inputClass}
                    value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    required
                  >
                    <option value="">Pilih Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.nama}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi Penyimpanan</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.lokasi}
                    onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                    placeholder="Contoh: Rak A-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
                  <select
                    className={inputClass}
                    value={form.satuan}
                    onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                  >
                    <option value="pcs">pcs</option>
                    <option value="box">box</option>
                    <option value="set">set</option>
                    <option value="liter">liter</option>
                    <option value="unit">unit</option>
                    <option value="pasang">pasang</option>
                    <option value="roll">roll</option>
                    <option value="meter">meter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Beli (Rp) *</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.hargaBeli}
                    onChange={(e) => setForm({ ...form, hargaBeli: e.target.value })}
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Jual (Rp) *</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.hargaJual}
                    onChange={(e) => setForm({ ...form, hargaJual: e.target.value })}
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stok Awal *</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.stok}
                    onChange={(e) => setForm({ ...form, stok: e.target.value })}
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stok Minimum *</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.stokMinimum}
                    onChange={(e) => setForm({ ...form, stokMinimum: e.target.value })}
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Garansi (Bulan)</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.garansiBulan}
                    onChange={(e) => setForm({ ...form, garansiBulan: e.target.value })}
                    min="0"
                    placeholder="0 = tanpa garansi"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Garansi sparepart otomatis dibuat saat WO selesai
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className={inputClass}
                      value={form.barcode}
                      onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                      placeholder="Barcode otomatis ter-generate"
                      readOnly={editingId ? false : true}
                    />
                    <button
                      type="button"
                      onClick={handleRegenerateBarcode}
                      className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors touch-target"
                      title="Generate ulang barcode"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  {!editingId && (
                    <p className="mt-1 text-xs text-gray-500">
                      Barcode otomatis berdasarkan ID sparepart (EAN-13)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white pb-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors touch-target"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25 touch-target"
                >
                  {editingId ? 'Simpan Perubahan' : 'Tambah Sparepart'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Sparepart */}
      {detailId && (
        <SparepartDetail
          sparepartId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}

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

export default Sparepart