import { useEffect, useState } from 'react'
import { workOrderService, WO_STATUS, WO_STATUS_LABELS, WO_STATUS_COLORS } from '../services/workOrderService'
import { invoiceService } from '../services/invoiceService'
import { customerService } from '../services/customerService'
import { vehicleService } from '../services/vehicleService'
import { mechanicService } from '../services/mechanicService'
import { servicePackageService } from '../services/servicePackageService'
import { sparepartService } from '../services/sparepartService'
import { db } from '../services/database'
import { toastService } from '../services/toastService'
import { soundService } from '../services/soundService'
import { formatRupiah, formatDate } from '../utils/format'
import { Plus, Search, Pencil, Trash2, ClipboardList, CheckCircle2, XCircle, Download, Eye, Wrench, Package, FileText, Printer } from 'lucide-react'
import WorkOrderPrint from '../components/WorkOrderPrint'

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"

function WorkOrders() {
  const [workOrders, setWorkOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [servicePackages, setServicePackages] = useState([])
  const [spareparts, setSpareparts] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [printWO, setPrintWO] = useState(null) // data WO untuk area cetak
  const [editingWO, setEditingWO] = useState(null)
  const [form, setForm] = useState({
    customerId: '', vehicleId: '', mechanicId: '', servicePackageId: '',
    kmMasuk: 0, keluhan: '', catatan: '', status: WO_STATUS.OPEN
  })
  // Form tambah item sparepart & jasa pada detail WO
  const [itemForm, setItemForm] = useState({ sparepartId: '', jumlah: '1', hargaSatuan: '' })
  const [laborForm, setLaborForm] = useState({ mechanicId: '', jam: '1', tarifPerJam: '', keterangan: '' })
  const [itemError, setItemError] = useState('')
  const [laborError, setLaborError] = useState('')

  const loadData = async () => {
    try {
      const [woData, custData, vehData, mechData, pkgData, spData] = await Promise.all([
        workOrderService.getAll(),
        customerService.getAll(),
        vehicleService.getAll(),
        mechanicService.getAll(),
        servicePackageService.getAll(),
        sparepartService.getAll()
      ])
      setWorkOrders(woData || [])
      setCustomers(custData || [])
      setVehicles(vehData || [])
      setMechanics(mechData || [])
      setServicePackages(pkgData || [])
      setSpareparts(spData || [])
    } catch (error) {
      console.error('Failed to load work orders:', error)
      toastService.error('Gagal memuat data work order')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const handleDBChange = (e) => {
      const { table } = e.detail || {}
      if (!table || [
        db.keys.WORK_ORDERS, db.keys.WO_ITEMS, db.keys.WO_LABOR,
        db.keys.CUSTOMERS, db.keys.VEHICLES, db.keys.MECHANICS,
        db.keys.SERVICE_PACKAGES, db.keys.SPAREPARTS
      ].includes(table)) {
        loadData()
      }
    }
    window.addEventListener(db.changeEvent, handleDBChange)
    return () => window.removeEventListener(db.changeEvent, handleDBChange)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.customerId) {
      toastService.error('Pilih pelanggan terlebih dahulu')
      return
    }
    if (!form.vehicleId) {
      toastService.error('Pilih kendaraan terlebih dahulu')
      return
    }
    try {
      if (editingWO) {
        await workOrderService.update(editingWO.id, form)
        toastService.success('Work order berhasil diupdate')
      } else {
        await workOrderService.create(form)
        toastService.success('Work order berhasil dibuat')
      }
      soundService.success()
      setShowModal(false)
      setEditingWO(null)
      setForm({
        customerId: '', vehicleId: '', mechanicId: '', servicePackageId: '',
        kmMasuk: 0, keluhan: '', catatan: '', status: WO_STATUS.OPEN
      })
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleEdit = (wo) => {
    setEditingWO(wo)
    setForm({
      customerId: wo.customerId || '',
      vehicleId: wo.vehicleId || '',
      mechanicId: wo.mechanicId || '',
      servicePackageId: wo.servicePackageId || '',
      kmMasuk: wo.kmMasuk || 0,
      keluhan: wo.keluhan || '',
      catatan: wo.catatan || '',
      status: wo.status || WO_STATUS.OPEN
    })
    setShowModal(true)
  }

  const handleDelete = async (wo) => {
    if (!confirm(`Hapus work order "${wo.nomorWo}"?`)) return
    try {
      await workOrderService.delete(wo.id)
      toastService.success('Work order berhasil dihapus')
      soundService.success()
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleStatusChange = async (wo, newStatus) => {
    try {
      await workOrderService.updateStatus(wo.id, newStatus)
      toastService.success(`Status diubah ke ${WO_STATUS_LABELS[newStatus]}`)
      soundService.success()
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  // Muat detail lengkap WO beserta items & labor
  const handleShowDetail = async (wo) => {
    setShowDetail(wo)
    setDetailLoading(true)
    setItemForm({ sparepartId: '', jumlah: '1', hargaSatuan: '' })
    setLaborForm({ mechanicId: '', jam: '1', tarifPerJam: '', keterangan: '' })
    setItemError('')
    setLaborError('')
    try {
      const fullDetail = await workOrderService.getById(wo.id)
      setShowDetail(fullDetail || wo)
    } catch (error) {
      console.error('Failed to load work order detail:', error)
      toastService.error('Gagal memuat detail work order')
    } finally {
      setDetailLoading(false)
    }
  }

  // Refresh detail WO yang sedang terbuka (setelah item/jasa berubah)
  const refreshDetail = async () => {
    if (!showDetail?.id) return
    try {
      const fullDetail = await workOrderService.getById(showDetail.id)
      setShowDetail(fullDetail || showDetail)
    } catch (error) {
      console.error('Failed to refresh work order detail:', error)
    }
  }

  // Tambah item sparepart ke WO (tersimpan di tabel wo_items Supabase)
  const handleAddItem = async (e) => {
    e.preventDefault()
    setItemError('')
    if (!itemForm.sparepartId) {
      setItemError('Pilih sparepart terlebih dahulu')
      return
    }
    try {
      await workOrderService.addItem(showDetail.id, {
        sparepartId: Number(itemForm.sparepartId),
        jumlah: Number(itemForm.jumlah),
        hargaSatuan: itemForm.hargaSatuan === '' ? undefined : Number(itemForm.hargaSatuan)
      })
      soundService.success()
      setItemForm({ sparepartId: '', jumlah: '1', hargaSatuan: '' })
      await refreshDetail()
      loadData()
    } catch (error) {
      setItemError(error.message)
      soundService.error()
    }
  }

  // Hapus item dari WO
  const handleRemoveItem = async (itemId) => {
    if (!confirm('Hapus item ini dari work order?')) return
    try {
      await workOrderService.removeItem(itemId)
      soundService.delete()
      await refreshDetail()
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  // Tambah jasa/mekanik ke WO (tersimpan di tabel wo_labor Supabase)
  const handleAddLabor = async (e) => {
    e.preventDefault()
    setLaborError('')
    if (!laborForm.mechanicId) {
      setLaborError('Pilih mekanik terlebih dahulu')
      return
    }
    try {
      await workOrderService.addLabor(showDetail.id, {
        mechanicId: Number(laborForm.mechanicId),
        jam: Number(laborForm.jam),
        tarifPerJam: laborForm.tarifPerJam === '' ? undefined : Number(laborForm.tarifPerJam),
        keterangan: laborForm.keterangan
      })
      soundService.success()
      setLaborForm({ mechanicId: '', jam: '1', tarifPerJam: '', keterangan: '' })
      await refreshDetail()
      loadData()
    } catch (error) {
      setLaborError(error.message)
      soundService.error()
    }
  }

  // Hapus jasa dari WO
  const handleRemoveLabor = async (laborId) => {
    if (!confirm('Hapus jasa ini dari work order?')) return
    try {
      await workOrderService.removeLabor(laborId)
      soundService.delete()
      await refreshDetail()
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  // Generate faktur dari work order yang selesai
  const handleGenerateInvoice = async (wo) => {
    if (!confirm(`Buat faktur untuk work order "${wo.nomorWo}"?`)) return
    try {
      await invoiceService.generateFromWorkOrder(wo.id)
      toastService.success('Faktur berhasil dibuat')
      soundService.success()
      loadData()
    } catch (error) {
      toastService.error(error.message)
      soundService.error()
    }
  }

  const handleExport = () => {
    const { headers, rows, filename } = workOrderService.exportToCSV(workOrders)
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    toastService.success('Data work order berhasil diexport')
  }

  const filteredWO = workOrderService.filterByStatus(statusFilter, workOrderService.search(search, workOrders))
  const statusStats = workOrderService.getStatusStats(workOrders)

  const getVehiclesForCustomer = (customerId) => {
    if (!customerId) return []
    return vehicles.filter(v => Number(v.customerId) === Number(customerId))
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Manajemen Work Order</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Kelola pekerjaan servis bengkel</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
          <button
            onClick={() => { setEditingWO(null); setForm({ customerId: '', vehicleId: '', mechanicId: '', servicePackageId: '', kmMasuk: 0, keluhan: '', catatan: '', status: WO_STATUS.OPEN }); setShowModal(true) }}
            className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md shadow-brand-500/25 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Buat Work Order</span>
            <span className="sm:hidden">Buat</span>
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor WO, pelanggan, kendaraan, mekanik..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === 'ALL' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Semua ({workOrders.length})
          </button>
          {Object.entries(WO_STATUS).map(([key, value]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === value ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {WO_STATUS_LABELS[value]} ({statusStats[value] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total WO</p>
              <p className="text-lg font-bold text-gray-800">{workOrders.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Wrench className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Dalam Proses</p>
              <p className="text-lg font-bold text-gray-800">{(statusStats[WO_STATUS.OPEN] || 0) + (statusStats[WO_STATUS.IN_PROGRESS] || 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Selesai</p>
              <p className="text-lg font-bold text-gray-800">{(statusStats[WO_STATUS.COMPLETED] || 0) + (statusStats[WO_STATUS.DELIVERED] || 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Estimasi</p>
              <p className="text-lg font-bold text-gray-800">
                {formatRupiah(workOrders.filter(wo => wo.status === WO_STATUS.OPEN || wo.status === WO_STATUS.IN_PROGRESS).reduce((sum, wo) => sum + Number(wo.estimasiBiaya || 0), 0))}
              </p>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">No. WO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pelanggan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kendaraan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Mekanik</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Estimasi</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : filteredWO.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Belum ada data work order</td></tr>
              ) : (
                filteredWO.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold text-brand-600">{wo.nomorWo}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(wo.tanggalMasuk)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{wo.customer?.nama || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {wo.vehicle ? `${wo.vehicle.merk || ''} ${wo.vehicle.tipe || ''} (${wo.vehicle.platNomor || ''})` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{wo.mechanic?.nama || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{formatRupiah(wo.estimasiBiaya || 0)}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-gray-800">{formatRupiah(wo.totalBiaya || 0)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${WO_STATUS_COLORS[wo.status] || 'bg-gray-100 text-gray-600'}`}>
                        {WO_STATUS_LABELS[wo.status] || wo.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleShowDetail(wo)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(wo)}
                          className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(wo)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Modal Tambah/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingWO ? 'Edit Work Order' : 'Buat Work Order'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pelanggan *</label>
                <select
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value, vehicleId: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                >
                  <option value="">-- Pilih Pelanggan --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.nama} ({c.kode})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kendaraan *</label>
                <select
                  value={form.vehicleId}
                  onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                  disabled={!form.customerId}
                >
                  <option value="">{form.customerId ? '-- Pilih Kendaraan --' : 'Pilih pelanggan dulu'}</option>
                  {getVehiclesForCustomer(form.customerId).map(v => (
                    <option key={v.id} value={v.id}>{v.platNomor} - {v.merk || ''} {v.tipe || ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mekanik</label>
                  <select
                    value={form.mechanicId}
                    onChange={(e) => setForm({ ...form, mechanicId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="">-- Pilih Mekanik --</option>
                    {mechanics.filter(m => m.status === 'AKTIF').map(m => (
                      <option key={m.id} value={m.id}>{m.nama}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Package</label>
                  <select
                    value={form.servicePackageId}
                    onChange={(e) => setForm({ ...form, servicePackageId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="">-- Pilih Package --</option>
                    {servicePackages.map(p => (
                      <option key={p.id} value={p.id}>{p.nama} ({formatRupiah(p.harga || 0)})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KM Masuk</label>
                <input
                  type="number"
                  value={form.kmMasuk}
                  onChange={(e) => setForm({ ...form, kmMasuk: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keluhan</label>
                <textarea
                  value={form.keluhan}
                  onChange={(e) => setForm({ ...form, keluhan: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                <textarea
                  value={form.catatan}
                  onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              {editingWO && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    {Object.entries(WO_STATUS).map(([key, value]) => (
                      <option key={key} value={value}>{WO_STATUS_LABELS[value]}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingWO(null) }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                >
                  {editingWO ? 'Update' : 'Simpan'}
                </button>
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
                <h2 className="text-lg font-semibold text-gray-800">Detail Work Order</h2>
                <p className="text-sm text-brand-600 font-medium">{showDetail.nomorWo}</p>
              </div>
              <button
                onClick={() => setShowDetail(null)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
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
                  <p className="text-xs text-gray-500">Mekanik</p>
                  <p className="text-sm font-medium text-gray-800">{showDetail.mechanic?.nama || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Service Package</p>
                  <p className="text-sm font-medium text-gray-800">{showDetail.servicePackage?.nama || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Tanggal Masuk</p>
                  <p className="text-sm font-medium text-gray-800">{formatDate(showDetail.tanggalMasuk)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${WO_STATUS_COLORS[showDetail.status] || 'bg-gray-100 text-gray-600'}`}>
                    {WO_STATUS_LABELS[showDetail.status] || showDetail.status}
                  </span>
                </div>
              </div>

              {showDetail.keluhan && (
                <div>
                  <p className="text-xs text-gray-500">Keluhan</p>
                  <p className="text-sm text-gray-800">{showDetail.keluhan}</p>
                </div>
              )}
              {showDetail.catatan && (
                <div>
                  <p className="text-xs text-gray-500">Catatan</p>
                  <p className="text-sm text-gray-800">{showDetail.catatan}</p>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-500 mb-2">Estimasi Biaya</p>
                <p className="text-lg font-bold text-gray-800">{formatRupiah(showDetail.estimasiBiaya || 0)}</p>
              </div>

              {/* Sparepart Digunakan */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-500 mb-2">Sparepart Digunakan</p>
                {detailLoading ? (
                  <p className="text-sm text-gray-400">Memuat...</p>
                ) : (showDetail.items || []).length === 0 ? (
                  <p className="text-sm text-gray-500">Belum ada sparepart digunakan</p>
                ) : (
                  <div className="space-y-2">
                    {showDetail.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate-mobile">
                            {item.sparepart?.nama || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.jumlah} pcs × {formatRupiah(item.hargaSatuan || 0)} • Stok tersedia: {item.sparepart?.stok ?? '-'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-sm font-semibold text-gray-800">
                            {formatRupiah(item.total || 0)}
                          </span>
                          {showDetail.status !== WO_STATUS.COMPLETED && showDetail.status !== WO_STATUS.DELIVERED && (
                            <button onClick={() => handleRemoveItem(item.id)} className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus Item">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form tambah item (hanya jika WO belum selesai) */}
                {showDetail.status !== WO_STATUS.COMPLETED && showDetail.status !== WO_STATUS.DELIVERED && showDetail.status !== WO_STATUS.CANCELLED && (
                  <form onSubmit={handleAddItem} className="mt-3 space-y-2 bg-brand-50/50 border border-brand-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-brand-700">Tambah Sparepart</p>
                    {itemError && <p className="text-xs text-red-600">{itemError}</p>}
                    <select
                      value={itemForm.sparepartId}
                      onChange={(e) => {
                        const sp = spareparts.find(s => Number(s.id) === Number(e.target.value))
                        setItemForm({
                          ...itemForm,
                          sparepartId: e.target.value,
                          hargaSatuan: sp ? String(sp.hargaJual ?? '') : ''
                        })
                      }}
                      className={inputCls}
                    >
                      <option value="">-- Pilih Sparepart --</option>
                      {spareparts.map(sp => (
                        <option key={sp.id} value={sp.id}>
                          {sp.nama} ({sp.kode}) • Stok: {sp.stok}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Jumlah"
                        value={itemForm.jumlah}
                        onChange={(e) => setItemForm({ ...itemForm, jumlah: e.target.value })}
                        className={inputCls}
                        required
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Harga Satuan"
                        value={itemForm.hargaSatuan}
                        onChange={(e) => setItemForm({ ...itemForm, hargaSatuan: e.target.value })}
                        className={inputCls}
                        required
                      />
                    </div>
                    <button type="submit" className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm">
                      <Plus className="w-4 h-4" />
                      Tambah Item
                    </button>
                  </form>
                )}
              </div>

              {/* Jasa / Tenaga Kerja */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-500 mb-2">Jasa / Tenaga Kerja</p>
                {detailLoading ? (
                  <p className="text-sm text-gray-400">Memuat...</p>
                ) : (showDetail.labor || []).length === 0 ? (
                  <p className="text-sm text-gray-500">Belum ada jasa dicatat</p>
                ) : (
                  <div className="space-y-2">
                    {showDetail.labor.map((lab) => (
                      <div key={lab.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate-mobile">
                            {lab.mechanic?.nama || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {lab.jam} jam × {formatRupiah(lab.tarifPerJam || 0)}
                            {lab.keterangan ? ` • ${lab.keterangan}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-sm font-semibold text-gray-800">
                            {formatRupiah(lab.total || 0)}
                          </span>
                          {showDetail.status !== WO_STATUS.COMPLETED && showDetail.status !== WO_STATUS.DELIVERED && (
                            <button onClick={() => handleRemoveLabor(lab.id)} className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus Jasa">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form tambah jasa (hanya jika WO belum selesai) */}
                {showDetail.status !== WO_STATUS.COMPLETED && showDetail.status !== WO_STATUS.DELIVERED && showDetail.status !== WO_STATUS.CANCELLED && (
                  <form onSubmit={handleAddLabor} className="mt-3 space-y-2 bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-700">Tambah Jasa / Mekanik</p>
                    {laborError && <p className="text-xs text-red-600">{laborError}</p>}
                    <select
                      value={laborForm.mechanicId}
                      onChange={(e) => {
                        const mech = mechanics.find(m => Number(m.id) === Number(e.target.value))
                        setLaborForm({
                          ...laborForm,
                          mechanicId: e.target.value,
                          tarifPerJam: mech ? String(mech.tarifPerJam ?? '') : ''
                        })
                      }}
                      className={inputCls}
                    >
                      <option value="">-- Pilih Mekanik --</option>
                      {mechanics.filter(m => m.status === 'AKTIF').map(m => (
                        <option key={m.id} value={m.id}>{m.nama}</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        placeholder="Jam Kerja"
                        value={laborForm.jam}
                        onChange={(e) => setLaborForm({ ...laborForm, jam: e.target.value })}
                        className={inputCls}
                        required
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Tarif per Jam"
                        value={laborForm.tarifPerJam}
                        onChange={(e) => setLaborForm({ ...laborForm, tarifPerJam: e.target.value })}
                        className={inputCls}
                        required
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Keterangan (opsional)"
                      value={laborForm.keterangan}
                      onChange={(e) => setLaborForm({ ...laborForm, keterangan: e.target.value })}
                      className={inputCls}
                    />
                    <button type="submit" className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                      <Plus className="w-4 h-4" />
                      Tambah Jasa
                    </button>
                  </form>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-500 mb-2">Total Biaya</p>
                <p className="text-lg font-bold text-brand-600">{formatRupiah(showDetail.totalBiaya || 0)}</p>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Sparepart</p>
                    <p className="text-sm font-medium text-gray-800">{formatRupiah(showDetail.totalParts || 0)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Jasa</p>
                    <p className="text-sm font-medium text-gray-800">{formatRupiah(showDetail.totalLabor || 0)}</p>
                  </div>
                </div>
              </div>

              {/* Cetak Work Order */}
              <button
                onClick={() => {
                  setPrintWO(showDetail)
                  setShowDetail(null)
                  setTimeout(() => {
                    window.print()
                    setTimeout(() => setPrintWO(null), 500)
                  }, 300)
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Cetak Work Order
              </button>

              {(showDetail.status === WO_STATUS.COMPLETED || showDetail.status === WO_STATUS.DELIVERED) && (
                <button
                  onClick={() => handleGenerateInvoice(showDetail)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Buat Faktur dari Work Order Ini
                </button>
              )}

              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-500 mb-2">Ubah Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(WO_STATUS).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => {
                        handleStatusChange(showDetail, value)
                        setShowDetail(null)
                      }}
                      disabled={showDetail.status === value}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        showDetail.status === value
                          ? 'bg-brand-600 text-white cursor-default'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {WO_STATUS_LABELS[value]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Area cetak work order (hanya tampil saat print) */}
      {printWO && <WorkOrderPrint workOrder={printWO} />}
    </div>
  )
}

export default WorkOrders
