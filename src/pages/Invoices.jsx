import { useEffect, useState } from 'react'
import { invoiceService, INVOICE_STATUS, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, METODE_BAYAR, METODE_BAYAR_LABELS } from '../services/invoiceService'
import { workOrderService } from '../services/workOrderService'
import { db } from '../services/database'
import { toastService } from '../services/toastService'
import { soundService } from '../services/soundService'
import { formatRupiah, formatDate } from '../utils/format'
import { Plus, Search, Pencil, Trash2, FileText, CheckCircle2, XCircle, Download, Eye, Banknote, CreditCard, Printer, Wallet } from 'lucide-react'
import InvoicePrint from '../components/InvoicePrint'

function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [editingInvoice, setEditingInvoice] = useState(null)
  // Pembayaran parsial & cetak
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [paymentForm, setPaymentForm] = useState({ jumlah: '', metodeBayar: METODE_BAYAR.TUNAI, referensi: '' })
  const [printData, setPrintData] = useState(null) // { invoice, payments }
  const [form, setForm] = useState({
    workOrderId: '', customerId: '', vehicleId: '',
    totalBiaya: 0, diskon: 0, pajak: 0, grandTotal: 0,
    status: INVOICE_STATUS.PENDING, metodeBayar: '', keterangan: ''
  })

  const loadData = async () => {
    try {
      const [invData, woData] = await Promise.all([
        invoiceService.getAll(),
        workOrderService.getAll()
      ])
      setInvoices(invData || [])
      setWorkOrders(woData || [])
    } catch (error) {
      console.error('Failed to load invoices:', error)
      toastService.error('Gagal memuat data faktur')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const handleDBChange = (e) => {
      const { table } = e.detail || {}
      if (!table || [db.keys.INVOICES, db.keys.WORK_ORDERS, db.keys.CUSTOMERS, db.keys.VEHICLES].includes(table)) {
        loadData()
      }
    }
    window.addEventListener(db.changeEvent, handleDBChange)
    return () => window.removeEventListener(db.changeEvent, handleDBChange)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.workOrderId) {
      toastService.error('Pilih work order terlebih dahulu')
      return
    }
    try {
      if (editingInvoice) {
        await invoiceService.update(editingInvoice.id, form)
        toastService.success('Faktur berhasil diupdate')
      } else {
        await invoiceService.create(form)
        toastService.success('Faktur berhasil dibuat')
      }
      soundService.success()
      setShowModal(false)
      setEditingInvoice(null)
      setForm({
        workOrderId: '', customerId: '', vehicleId: '',
        totalBiaya: 0, diskon: 0, pajak: 0, grandTotal: 0,
        status: INVOICE_STATUS.PENDING, metodeBayar: '', keterangan: ''
      })
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleEdit = (inv) => {
    setEditingInvoice(inv)
    setForm({
      workOrderId: inv.workOrderId || '',
      customerId: inv.customerId || '',
      vehicleId: inv.vehicleId || '',
      totalBiaya: inv.totalBiaya || 0,
      diskon: inv.diskon || 0,
      pajak: inv.pajak || 0,
      grandTotal: inv.grandTotal || 0,
      status: inv.status || INVOICE_STATUS.PENDING,
      metodeBayar: inv.metodeBayar || '',
      keterangan: inv.keterangan || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (inv) => {
    if (!confirm(`Hapus faktur "${inv.nomorInvoice}"?`)) return
    try {
      await invoiceService.delete(inv.id)
      toastService.success('Faktur berhasil dihapus')
      soundService.success()
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleMarkAsPaid = async (inv) => {
    const metode = prompt('Metode pembayaran (TUNAI, TRANSFER, KARTU, E_WALLET, KREDIT):', METODE_BAYAR.TUNAI)
    if (!metode) return
    try {
      await invoiceService.markAsPaid(inv.id, metode.toUpperCase())
      toastService.success('Faktur ditandai lunas')
      soundService.success()
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleCancel = async (inv) => {
    if (!confirm(`Batalkan faktur "${inv.nomorInvoice}"?`)) return
    try {
      await invoiceService.cancel(inv.id)
      toastService.success('Faktur dibatalkan')
      soundService.success()
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  // Buka modal pembayaran parsial
  const openPaymentModal = (inv) => {
    const sisa = Number(inv.sisaBayar ?? Math.max((inv.grandTotal || 0) - (inv.jumlahDibayar || 0), 0))
    setPaymentTarget(inv)
    setPaymentForm({ jumlah: String(sisa), metodeBayar: METODE_BAYAR.TUNAI, referensi: '' })
  }

  // Proses pembayaran parsial/penuh
  const handleSubmitPayment = async (e) => {
    e.preventDefault()
    if (!paymentTarget) return
    try {
      await invoiceService.addPayment(paymentTarget.id, {
        jumlah: Number(paymentForm.jumlah),
        metodeBayar: paymentForm.metodeBayar,
        referensi: paymentForm.referensi
      })
      toastService.success('Pembayaran berhasil dicatat')
      soundService.success()
      setPaymentTarget(null)
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  // Cetak invoice: muat data terbaru + riwayat pembayaran lalu panggil window.print()
  const handlePrint = async (inv) => {
    try {
      toastService.info('Menyiapkan halaman cetak...')
      const fresh = await invoiceService.getById(inv.id)
      const payments = await invoiceService.getPayments(inv.id)
      setPrintData({ invoice: fresh || inv, payments })
      // Tunggu render selesai sebelum mencetak
      setTimeout(() => {
        window.print()
        setTimeout(() => setPrintData(null), 500)
      }, 300)
    } catch {
      toastService.error('Gagal menyiapkan cetakan')
      soundService.error()
    }
  }

  const handleExport = () => {
    const { headers, rows, filename } = invoiceService.exportToCSV(invoices)
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    toastService.success('Data faktur berhasil diexport')
  }

  const filteredInvoices = invoiceService.filterByStatus(statusFilter, invoiceService.search(search, invoices))
  const statusStats = invoiceService.getStatusStats(invoices)
  const totalRevenue = invoiceService.getTotalRevenue(invoices)
  const totalOutstanding = invoiceService.getTotalOutstanding(invoices)

  const handleWOSelect = (woId) => {
    const wo = workOrders.find(w => Number(w.id) === Number(woId))
    if (wo) {
      // Reset diskon & pajak saat memilih WO agar grandTotal = totalBiaya WO (akurat dari awal)
      setForm({
        ...form,
        workOrderId: woId,
        customerId: wo.customerId || '',
        vehicleId: wo.vehicleId || '',
        totalBiaya: Number(wo.totalBiaya || 0),
        diskon: 0,
        pajak: 0,
        grandTotal: Number(wo.totalBiaya || 0)
      })
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Manajemen Faktur</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Kelola faktur & pembayaran bengkel</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button onClick={handleExport} className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
          <button onClick={() => { setEditingInvoice(null); setForm({ workOrderId: '', customerId: '', vehicleId: '', totalBiaya: 0, diskon: 0, pajak: 0, grandTotal: 0, status: INVOICE_STATUS.PENDING, metodeBayar: '', keterangan: '' }); setShowModal(true) }} className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25 text-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Buat Faktur</span>
            <span className="sm:hidden">Buat</span>
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor invoice, pelanggan, kendaraan, no. WO..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setStatusFilter('ALL')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === 'ALL' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Semua ({invoices.length})
          </button>
          {Object.entries(INVOICE_STATUS).map(([key, value]) => (
            <button key={key} onClick={() => setStatusFilter(value)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === value ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {INVOICE_STATUS_LABELS[value]} ({statusStats[value] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center"><FileText className="w-5 h-5 text-brand-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Faktur</p>
              <p className="text-lg font-bold text-gray-800">{invoices.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Lunas</p>
              <p className="text-lg font-bold text-gray-800">{statusStats[INVOICE_STATUS.PAID] || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center"><Banknote className="w-5 h-5 text-yellow-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Belum Dibayar</p>
              <p className="text-lg font-bold text-gray-800">{formatRupiah(totalOutstanding)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center"><CreditCard className="w-5 h-5 text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Pendapatan</p>
              <p className="text-lg font-bold text-gray-800">{formatRupiah(totalRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">No. Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pelanggan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kendaraan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">No. WO</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Grand Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Dibayar / Sisa</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Metode</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">Belum ada data faktur</td></tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold text-brand-600">{inv.nomorInvoice}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(inv.tanggalInvoice)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{inv.customer?.nama || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {inv.vehicle ? `${inv.vehicle.merk || ''} ${inv.vehicle.tipe || ''} (${inv.vehicle.platNomor || ''})` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{inv.workOrder?.nomorWo || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-gray-800">{formatRupiah(inv.grandTotal || 0)}</td>
                    <td className="px-4 py-3 text-center text-xs">
                      <p className="text-green-600 font-medium">{formatRupiah(inv.jumlahDibayar || 0)}</p>
                      {(inv.sisaBayar ?? Math.max((inv.grandTotal || 0) - (inv.jumlahDibayar || 0), 0)) > 0 && (
                        <p className="text-red-500">Sisa: {formatRupiah(inv.sisaBayar ?? Math.max((inv.grandTotal || 0) - (inv.jumlahDibayar || 0), 0))}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                        {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {inv.metodeBayar ? METODE_BAYAR_LABELS[inv.metodeBayar] || inv.metodeBayar : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setShowDetail(inv)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Detail"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => handlePrint(inv)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Cetak Invoice"><Printer className="w-4 h-4" /></button>
                        <button onClick={() => handleEdit(inv)} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                        {(inv.status === INVOICE_STATUS.PENDING || inv.status === INVOICE_STATUS.PARTIAL) && (
                          <>
                            <button onClick={() => openPaymentModal(inv)} className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Catat Pembayaran"><Wallet className="w-4 h-4" /></button>
                            <button onClick={() => handleMarkAsPaid(inv)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Tandai Lunas"><CheckCircle2 className="w-4 h-4" /></button>
                          </>
                        )}
                        {inv.status !== INVOICE_STATUS.CANCELLED && inv.status !== INVOICE_STATUS.PAID && (
                          <button onClick={() => handleCancel(inv)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Batalkan"><XCircle className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => handleDelete(inv)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">{editingInvoice ? 'Edit Faktur' : 'Buat Faktur'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Order *</label>
                <select
                  value={form.workOrderId}
                  onChange={(e) => handleWOSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                  disabled={!!editingInvoice}
                >
                  <option value="">-- Pilih Work Order --</option>
                  {workOrders.map(wo => (
                    <option key={wo.id} value={wo.id}>{wo.nomorWo} - {wo.customer?.nama || ''} ({formatRupiah(wo.totalBiaya || 0)})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Biaya</label>
                  <input type="number" value={form.totalBiaya} onChange={(e) => setForm({ ...form, totalBiaya: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diskon</label>
                  <input type="number" value={form.diskon} onChange={(e) => setForm({ ...form, diskon: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" min="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pajak</label>
                  <input type="number" value={form.pajak} onChange={(e) => setForm({ ...form, pajak: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grand Total (Otomatis)</label>
                  <input
                    type="number"
                    value={Number(form.totalBiaya || 0) - Number(form.diskon || 0) + Number(form.pajak || 0)}
                    readOnly
                    disabled
                    className="w-full px-3 py-2 bg-gray-50 text-gray-600 rounded-lg cursor-not-allowed"
                    min="0"
                  />
                </div>
              </div>
              {editingInvoice && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500">
                      {Object.entries(INVOICE_STATUS).map(([key, value]) => (
                        <option key={key} value={value}>{INVOICE_STATUS_LABELS[value]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Metode Bayar</label>
                    <select value={form.metodeBayar} onChange={(e) => setForm({ ...form, metodeBayar: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500">
                      <option value="">-- Pilih Metode --</option>
                      {Object.entries(METODE_BAYAR).map(([key, value]) => (
                        <option key={key} value={value}>{METODE_BAYAR_LABELS[value]}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                <textarea value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingInvoice(null) }} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">Batal</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">{editingInvoice ? 'Update' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Detail Faktur</h2>
                <p className="text-sm text-brand-600 font-medium">{showDetail.nomorInvoice}</p>
              </div>
              <button onClick={() => setShowDetail(null)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Pelanggan</p>
                  <p className="text-sm font-medium text-gray-800">{showDetail.customer?.nama || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Kendaraan</p>
                  <p className="text-sm font-medium text-gray-800">
                    {showDetail.vehicle ? `${showDetail.vehicle.merk || ''} ${showDetail.vehicle.tipe || ''} (${showDetail.vehicle.platNomor || ''})` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Work Order</p>
                  <p className="text-sm font-medium text-gray-800">{showDetail.workOrder?.nomorWo || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Tanggal Invoice</p>
                  <p className="text-sm font-medium text-gray-800">{formatDate(showDetail.tanggalInvoice)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${INVOICE_STATUS_COLORS[showDetail.status] || 'bg-gray-100 text-gray-600'}`}>
                    {INVOICE_STATUS_LABELS[showDetail.status] || showDetail.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Metode Bayar</p>
                  <p className="text-sm font-medium text-gray-800">{showDetail.metodeBayar ? METODE_BAYAR_LABELS[showDetail.metodeBayar] || showDetail.metodeBayar : '-'}</p>
                </div>
              </div>

              {showDetail.keterangan && (
                <div>
                  <p className="text-xs text-gray-500">Keterangan</p>
                  <p className="text-sm text-gray-800">{showDetail.keterangan}</p>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Biaya</span>
                  <span className="font-medium text-gray-800">{formatRupiah(showDetail.totalBiaya || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Diskon</span>
                  <span className="font-medium text-gray-800">-{formatRupiah(showDetail.diskon || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pajak</span>
                  <span className="font-medium text-gray-800">+{formatRupiah(showDetail.pajak || 0)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2">
                  <span className="text-gray-800">Grand Total</span>
                  <span className="text-brand-600">{formatRupiah(showDetail.grandTotal || 0)}</span>
                </div>
              </div>

              {/* Ringkasan pembayaran parsial */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sudah Dibayar</span>
                  <span className="font-medium text-green-600">{formatRupiah(showDetail.jumlahDibayar || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sisa Tagihan</span>
                  <span className={`font-bold ${(showDetail.sisaBayar ?? Math.max((showDetail.grandTotal || 0) - (showDetail.jumlahDibayar || 0), 0)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatRupiah(showDetail.sisaBayar ?? Math.max((showDetail.grandTotal || 0) - (showDetail.jumlahDibayar || 0), 0))}
                  </span>
                </div>
              </div>

              {(showDetail.status === INVOICE_STATUS.PENDING || showDetail.status === INVOICE_STATUS.PARTIAL) && (
                <div className="border-t border-gray-200 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => { openPaymentModal(showDetail); setShowDetail(null) }}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    Catat Pembayaran
                  </button>
                  <button
                    onClick={() => { handleMarkAsPaid(showDetail); setShowDetail(null) }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Tandai Lunas
                  </button>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <button
                  onClick={() => { handlePrint(showDetail); setShowDetail(null) }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pembayaran Parsial */}
      {paymentTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="modal-mobile bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Catat Pembayaran</h2>
                <p className="text-sm text-brand-600 font-medium">{paymentTarget.nomorInvoice}</p>
              </div>
              <button onClick={() => setPaymentTarget(null)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Grand Total</span>
                  <span className="font-medium">{formatRupiah(paymentTarget.grandTotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sudah Dibayar</span>
                  <span className="font-medium text-green-600">{formatRupiah(paymentTarget.jumlahDibayar || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1">
                  <span className="text-gray-700 font-medium">Sisa Tagihan</span>
                  <span className="font-bold text-red-600">
                    {formatRupiah(paymentTarget.sisaBayar ?? Math.max((paymentTarget.grandTotal || 0) - (paymentTarget.jumlahDibayar || 0), 0))}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Bayar *</label>
                <input
                  type="number"
                  min="1"
                  max={Number(paymentTarget.sisaBayar ?? 0)}
                  value={paymentForm.jumlah}
                  onChange={(e) => setPaymentForm({ ...paymentForm, jumlah: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <p className="mt-1 text-xs text-gray-400">Kosongkan sisa dengan mengisi penuh untuk melunasi otomatis</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Metode Bayar *</label>
                <select
                  value={paymentForm.metodeBayar}
                  onChange={(e) => setPaymentForm({ ...paymentForm, metodeBayar: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  {Object.entries(METODE_BAYAR).map(([key, value]) => (
                    <option key={key} value={value}>{METODE_BAYAR_LABELS[value]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referensi (opsional)</label>
                <input
                  type="text"
                  value={paymentForm.referensi}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referensi: e.target.value })}
                  placeholder="No. transfer / no. struk..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setPaymentTarget(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">Batal</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">Simpan Pembayaran</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Area cetak invoice (hanya tampil saat print) */}
      {printData && <InvoicePrint invoice={printData.invoice} payments={printData.payments} />}
    </div>
  )
}

export default Invoices