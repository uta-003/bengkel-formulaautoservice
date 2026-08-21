import { useEffect, useState } from 'react'
import {
  Plus,
  Search,
  Trash2,
  X,
  Shield,
  Download,
  AlertTriangle,
  Send,
  CalendarClock,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Wrench,
  FileText,
  Wallet,
  Lock,
  Ban,
  Building2,
  Pencil,
  Paperclip,
  History,
  ChevronLeft
} from 'lucide-react'
import {
  insuranceClaimService,
  CLAIM_STATUS,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  CLAIM_FLOW,
  CLAIM_TYPES,
  CLAIM_ITEM_TYPES,
  CLAIM_DOC_TYPES,
  PAYMENT_METHODS
} from '../services/insuranceClaimService'
import { customerService } from '../services/customerService'
import { vehicleService } from '../services/vehicleService'
import { workOrderService } from '../services/workOrderService'
import { authService } from '../services/authService'
import { rbacService } from '../services/rbacService'
import { toastService } from '../services/toastService'
import { db } from '../services/database'
import { soundService } from '../services/soundService'
import { formatRupiah } from '../utils/format'

const emptyClaimForm = {
  insuranceCompanyId: '',
  customerId: '',
  vehicleId: '',
  workOrderId: '',
  nomorPolis: '',
  namaTertanggung: '',
  jenisKlaim: 'KECELAKAAN',
  tanggalKejadian: '',
  lokasiKejadian: '',
  deskripsiKerusakan: '',
  estimasiBiaya: '',
  deductible: ''
}

const emptyCompanyForm = {
  nama: '',
  jenisAsuransi: 'UMUM',
  telepon: '',
  email: '',
  alamat: '',
  kontakPerson: '',
  teleponKontak: '',
  nomorRekening: '',
  catatan: ''
}

function InsuranceClaims() {
  const [claims, setClaims] = useState([])
  const [companies, setCompanies] = useState([])
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [isLoading, setIsLoading] = useState(true)

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [claimForm, setClaimForm] = useState(emptyClaimForm)
  const [formError, setFormError] = useState('')

  const [detailId, setDetailId] = useState(null)
  const [detail, setDetail] = useState(null)

  // Modal aksi workflow (survey/approve/reject/payment)
  const [actionModal, setActionModal] = useState(null) // { type, claim }
  const [actionForm, setActionForm] = useState({})

  // Modal perusahaan asuransi
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [companyList, setCompanyList] = useState([])
  const [editingCompanyId, setEditingCompanyId] = useState(null)
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm)

  // Item & dokumen form di detail
  const [itemForm, setItemForm] = useState({ tipe: 'PART', sparepartId: '', deskripsi: '', jumlah: '1', hargaSatuan: '' })
  const [docForm, setDocForm] = useState({ namaDokumen: '', tipeDokumen: 'FOTO', urlDokumen: '', keterangan: '' })

  const currentUser = authService.getCurrentUser()
  const canManage = rbacService.canCreateTransaction(currentUser?.role) ||
    rbacService.canCreateSparepart(currentUser?.role)

  const loadData = async () => {
    try {
      const [claimsData, companiesData, customersData, vehiclesData, woData] = await Promise.all([
        insuranceClaimService.getAll(),
        insuranceClaimService.getCompanies(),
        customerService.getAll(),
        vehicleService.getAll(),
        workOrderService.getAll()
      ])
      setClaims(claimsData || [])
      setCompanies(companiesData || [])
      setCustomers(customersData || [])
      setVehicles(vehiclesData || [])
      setWorkOrders(woData || [])
    } catch (err) {
      console.error('Gagal memuat data klaim asuransi:', err)
      toastService.error('Gagal memuat data klaim asuransi')
    } finally {
      setIsLoading(false)
    }
  }

  const loadDetail = async (id) => {
    try {
      const data = await insuranceClaimService.getById(id)
      setDetail(data)
    } catch {
      toastService.error('Gagal memuat detail klaim')
    }
  }

  useEffect(() => {
    loadData()

    const handleDBChange = (e) => {
      const { table: changedTable } = e.detail || {}
      if (!changedTable ||
          changedTable === db.keys.INSURANCE_CLAIMS ||
          changedTable === db.keys.INSURANCE_COMPANIES ||
          changedTable === db.keys.CLAIM_ITEMS ||
          changedTable === db.keys.CLAIM_DOCUMENTS ||
          changedTable === db.keys.CLAIM_STATUS_HISTORY) {
        loadData()
        if (detailId) loadDetail(detailId)
      }
    }

    window.addEventListener(db.changeEvent, handleDBChange)
    return () => window.removeEventListener(db.changeEvent, handleDBChange)
  }, [detailId])

  let filtered = statusFilter !== 'ALL' ? insuranceClaimService.filterByStatus(statusFilter, claims) : claims
  if (search) filtered = insuranceClaimService.search(search, filtered)

  const stats = insuranceClaimService.getFinancialSummary(claims)
  const statusStats = insuranceClaimService.getStatusStats(claims)

  // ==================== FORM KLAIM ====================
  const openCreateForm = () => {
    setEditingId(null)
    setClaimForm(emptyClaimForm)
    setFormError('')
    setShowFormModal(true)
  }

  const openEditForm = (claim) => {
    setEditingId(claim.id)
    setClaimForm({
      insuranceCompanyId: claim.insuranceCompanyId || '',
      customerId: claim.customerId || '',
      vehicleId: claim.vehicleId || '',
      workOrderId: claim.workOrderId || '',
      nomorPolis: claim.nomorPolis || '',
      namaTertanggung: claim.namaTertanggung || '',
      jenisKlaim: claim.jenisKlaim || 'KECELAKAAN',
      tanggalKejadian: claim.tanggalKejadian ? claim.tanggalKejadian.slice(0, 10) : '',
      lokasiKejadian: claim.lokasiKejadian || '',
      deskripsiKerusakan: claim.deskripsiKerusakan || '',
      estimasiBiaya: claim.estimasiBiaya || '',
      deductible: claim.deductible || ''
    })
    setFormError('')
    setShowFormModal(true)
  }

  const handleSubmitClaim = async (e) => {
    e.preventDefault()
    setFormError('')
    try {
      if (editingId) {
        await insuranceClaimService.update(editingId, {
          ...claimForm,
          estimasiBiaya: Number(claimForm.estimasiBiaya || 0),
          deductible: Number(claimForm.deductible || 0),
          tanggalKejadian: claimForm.tanggalKejadian || null
        })
        toastService.success('Klaim berhasil diperbarui')
        soundService.edit()
      } else {
        await insuranceClaimService.create({
          ...claimForm,
          estimasiBiaya: Number(claimForm.estimasiBiaya || 0),
          deductible: Number(claimForm.deductible || 0),
          tanggalKejadian: claimForm.tanggalKejadian || null
        })
        toastService.success('Klaim berhasil dibuat (status: Draft)')
        soundService.add()
      }
      setShowFormModal(false)
      loadData()
    } catch (err) {
      setFormError(err.message)
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleDeleteClaim = async (claim) => {
    if (!confirm(`Hapus klaim ${claim.nomorKlaim}?`)) return
    try {
      await insuranceClaimService.delete(claim.id)
      toastService.success('Klaim dihapus')
      soundService.delete()
      if (detailId === claim.id) setDetailId(null)
      loadData()
    } catch (err) {
      toastService.error(err.message)
      soundService.error()
    }
  }

  // ==================== AKSI WORKFLOW ====================
  const openActionModal = (type, claim) => {
    setActionModal({ type, claim })
    // Default form per aksi
    switch (type) {
      case 'scheduleSurvey':
        setActionForm({ surveyorName: '', surveyDate: '' })
        break
      case 'completeSurvey':
        setActionForm({ surveyResult: '' })
        break
      case 'approve':
        setActionForm({ approvedAmount: claim.estimasiBiaya || '' })
        break
      case 'reject':
        setActionForm({ rejectionReason: '' })
        break
      case 'startRepair':
        setActionForm({ workOrderId: claim.workOrderId || '' })
        break
      case 'completeRepair':
        setActionForm({ actualCost: claim.estimasiBiaya || '' })
        break
      case 'invoice':
        setActionForm({ invoiceId: '' })
        break
      case 'markPaid':
        setActionForm({ paymentMethod: 'TRANSFER', paymentReference: '', paidAmount: claim.approvedAmount || '' })
        break
      default:
        setActionForm({})
    }
  }

  const handleSubmitAction = async (e) => {
    e.preventDefault()
    if (!actionModal) return
    const { type, claim } = actionModal
    try {
      let result
      switch (type) {
        case 'submit':
          result = await insuranceClaimService.submit(claim.id)
          break
        case 'scheduleSurvey':
          result = await insuranceClaimService.scheduleSurvey(claim.id, actionForm)
          break
        case 'completeSurvey':
          result = await insuranceClaimService.completeSurvey(claim.id, actionForm)
          break
        case 'approve':
          result = await insuranceClaimService.approve(claim.id, actionForm)
          break
        case 'reject':
          result = await insuranceClaimService.reject(claim.id, actionForm)
          break
        case 'startRepair':
          result = await insuranceClaimService.startRepair(claim.id, actionForm)
          break
        case 'completeRepair':
          result = await insuranceClaimService.completeRepair(claim.id, actionForm)
          break
        case 'invoice':
          result = await insuranceClaimService.invoiceToInsurance(claim.id, actionForm)
          break
        case 'markPaid':
          result = await insuranceClaimService.markPaid(claim.id, actionForm)
          break
        case 'close':
          result = await insuranceClaimService.close(claim.id)
          break
        case 'cancel':
          result = await insuranceClaimService.cancel(claim.id)
          break
        default:
          return
      }
      toastService.success(`Status klaim → ${CLAIM_STATUS_LABELS[result.status]}`)
      soundService.success()
      setActionModal(null)
      loadData()
      if (detailId === claim.id) loadDetail(detailId)
    } catch (err) {
      toastService.error(err.message)
      soundService.error()
    }
  }

  // ==================== PERUSAHAAN ASURANSI ====================
  const openCompanyModal = async () => {
    setShowCompanyModal(true)
    try {
      const data = await insuranceClaimService.getCompanies()
      setCompanyList(data || [])
    } catch {
      toastService.error('Gagal memuat daftar perusahaan asuransi')
    }
  }

  const handleSaveCompany = async (e) => {
    e.preventDefault()
    try {
      if (editingCompanyId) {
        await insuranceClaimService.updateCompany(editingCompanyId, companyForm)
        toastService.success('Perusahaan asuransi diperbarui')
      } else {
        await insuranceClaimService.createCompany(companyForm)
        toastService.success('Perusahaan asuransi ditambahkan')
      }
      soundService.success()
      setEditingCompanyId(null)
      setCompanyForm(emptyCompanyForm)
      const data = await insuranceClaimService.getCompanies()
      setCompanyList(data || [])
      loadData()
    } catch (err) {
      toastService.error(err.message)
      soundService.error()
    }
  }

  const handleDeleteCompany = async (company) => {
    if (!confirm(`Hapus perusahaan asuransi "${company.nama}"?`)) return
    try {
      await insuranceClaimService.deleteCompany(company.id)
      toastService.success('Perusahaan asuransi dihapus')
      soundService.delete()
      const data = await insuranceClaimService.getCompanies()
      setCompanyList(data || [])
      loadData()
    } catch (err) {
      toastService.error(err.message)
      soundService.error()
    }
  }

  // ==================== ITEM & DOKUMEN ====================
  const handleAddItem = async (e) => {
    e.preventDefault()
    if (!detail) return
    try {
      await insuranceClaimService.addItem(detail.id, {
        tipe: itemForm.tipe,
        sparepartId: itemForm.sparepartId || null,
        deskripsi: itemForm.deskripsi || (itemForm.sparepartId ? undefined : ''),
        jumlah: Number(itemForm.jumlah || 1),
        hargaSatuan: Number(itemForm.hargaSatuan || 0)
      })
      setItemForm({ tipe: 'PART', sparepartId: '', deskripsi: '', jumlah: '1', hargaSatuan: '' })
      await loadDetail(detail.id)
      toastService.success('Item ditambahkan')
      soundService.add()
    } catch (err) {
      toastService.error(err.message)
    }
  }

  const handleRemoveItem = async (itemId) => {
    if (!confirm('Hapus item ini dari klaim?')) return
    try {
      await insuranceClaimService.removeItem(itemId)
      await loadDetail(detailId)
      toastService.success('Item dihapus')
      soundService.delete()
    } catch (err) {
      toastService.error(err.message)
    }
  }

  const handleAddDocument = async (e) => {
    e.preventDefault()
    if (!detail) return
    try {
      await insuranceClaimService.addDocument(detail.id, docForm)
      setDocForm({ namaDokumen: '', tipeDokumen: 'FOTO', urlDokumen: '', keterangan: '' })
      await loadDetail(detail.id)
      toastService.success('Dokumen ditambahkan')
      soundService.add()
    } catch (err) {
      toastService.error(err.message)
    }
  }

  const handleRemoveDocument = async (docId) => {
    if (!confirm('Hapus dokumen ini?')) return
    try {
      await insuranceClaimService.removeDocument(docId)
      await loadDetail(detailId)
      toastService.success('Dokumen dihapus')
      soundService.delete()
    } catch (err) {
      toastService.error(err.message)
    }
  }

  const handleExportCSV = () => {
    const { headers, rows, filename } = insuranceClaimService.exportToCSV(filtered)
    const csvContent = [headers, ...rows].map(row => row.join(',')).join(String.fromCharCode(10))
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    toastService.success('CSV berhasil diunduh')
  }

  const getVehiclesForCustomer = (customerId) => {
    if (!customerId) return []
    return vehicles.filter(v => Number(v.customerId) === Number(customerId))
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"

  // ==================== LABEL AKSI WORKFLOW ====================
  const ACTION_META = {
    submit: { label: 'Ajukan ke Asuransi', icon: Send, color: 'bg-blue-600 hover:bg-blue-700' },
    scheduleSurvey: { label: 'Jadwalkan Survey', icon: CalendarClock, color: 'bg-cyan-600 hover:bg-cyan-700' },
    completeSurvey: { label: 'Input Hasil Survey', icon: ClipboardCheck, color: 'bg-teal-600 hover:bg-teal-700' },
    approve: { label: 'Setujui Klaim', icon: CheckCircle2, color: 'bg-green-600 hover:bg-green-700' },
    reject: { label: 'Tolak Klaim', icon: XCircle, color: 'bg-red-600 hover:bg-red-700' },
    startRepair: { label: 'Mulai Pengerjaan', icon: Wrench, color: 'bg-yellow-600 hover:bg-yellow-700' },
    completeRepair: { label: 'Selesaikan Servis', icon: CheckCircle2, color: 'bg-lime-600 hover:bg-lime-700' },
    invoice: { label: 'Tagih ke Asuransi', icon: FileText, color: 'bg-indigo-600 hover:bg-indigo-700' },
    markPaid: { label: 'Catat Pembayaran', icon: Wallet, color: 'bg-emerald-600 hover:bg-emerald-700' },
    close: { label: 'Tutup Klaim', icon: Lock, color: 'bg-purple-600 hover:bg-purple-700' },
    cancel: { label: 'Batalkan Klaim', icon: Ban, color: 'bg-gray-500 hover:bg-gray-600' }
  }

  // ==================== DETAIL VIEW ====================
  if (detailId && detail) {
    const actions = canManage ? insuranceClaimService.getAvailableActions(detail.status) : []
    const flowIndex = CLAIM_FLOW.indexOf(detail.status)

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <button onClick={() => { setDetailId(null); setDetail(null) }}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-1">
              <ChevronLeft className="w-4 h-4" /> Kembali
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2 flex-wrap">
              <Shield className="w-6 h-6 text-brand-600 shrink-0" />
              <span className="truncate-mobile">{detail.nomorKlaim}</span>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${CLAIM_STATUS_COLORS[detail.status]}`}>
                {CLAIM_STATUS_LABELS[detail.status]}
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5 truncate-mobile">
              {detail.company?.nama || '-'} • Polis: {detail.nomorPolis}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {canManage && ![CLAIM_STATUS.CLOSED, CLAIM_STATUS.CANCELLED].includes(detail.status) && (
              <button onClick={() => openEditForm(detail)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors touch-target">
                <Pencil className="w-4 h-4" /> Edit
              </button>
            )}
          </div>
        </div>

        {/* Progress alur kerja */}
        {!['REJECTED', 'CANCELLED'].includes(detail.status) && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center min-w-max gap-0">
              {CLAIM_FLOW.map((step, idx) => {
                const done = flowIndex >= idx && flowIndex !== -1
                const current = flowIndex === idx
                return (
                  <div key={step} className="flex items-center">
                    <div className="flex flex-col items-center px-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        current ? 'bg-brand-600 text-white ring-4 ring-brand-100' :
                        done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                      }`}>
                        {done && !current ? '✓' : idx + 1}
                      </div>
                      <span className={`text-[9px] mt-1 w-16 text-center leading-tight ${current ? 'text-brand-700 font-bold' : done ? 'text-green-600' : 'text-gray-400'}`}>
                        {CLAIM_STATUS_LABELS[step]}
                      </span>
                    </div>
                    {idx < CLAIM_FLOW.length - 1 && (
                      <div className={`h-0.5 w-6 sm:w-10 mb-5 ${flowIndex > idx ? 'bg-green-400' : 'bg-gray-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Info penolakan */}
        {detail.status === CLAIM_STATUS.REJECTED && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <XCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">Klaim Ditolak</p>
              <p>{detail.rejectionReason || '-'}</p>
            </div>
          </div>
        )}

        {/* Aksi workflow */}
        {actions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aksi Tersedia</p>
            <div className="flex flex-wrap gap-2">
              {actions.map(actionKey => {
                const meta = ACTION_META[actionKey]
                const Icon = meta.icon
                return (
                  <button key={actionKey} onClick={() => openActionModal(actionKey, detail)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white rounded-lg transition-colors touch-target ${meta.color}`}>
                    <Icon className="w-4 h-4" /> {meta.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Ringkasan biaya */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
            <p className="text-[10px] sm:text-xs text-gray-500">Estimasi Biaya</p>
            <p className="text-base sm:text-xl font-bold text-gray-800">{formatRupiah(detail.estimasiBiaya || 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
            <p className="text-[10px] sm:text-xs text-gray-500">Disetujui Asuransi</p>
            <p className="text-base sm:text-xl font-bold text-green-600">{formatRupiah(detail.approvedAmount || 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
            <p className="text-[10px] sm:text-xs text-gray-500">Biaya Aktual</p>
            <p className="text-base sm:text-xl font-bold text-blue-600">{formatRupiah(detail.actualCost || 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
            <p className="text-[10px] sm:text-xs text-gray-500">Partisipasi Pelanggan</p>
            <p className="text-base sm:text-xl font-bold text-orange-600">{formatRupiah(detail.deductible || 0)}</p>
          </div>
        </div>

        {/* Detail informasi */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-2.5 text-sm">
            <h3 className="font-semibold text-gray-800 mb-2">Informasi Klaim</h3>
            <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">Perusahaan</span><span className="font-medium text-right truncate-mobile">{detail.company?.nama || '-'}</span></div>
            <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">Pelanggan</span><span className="font-medium text-right truncate-mobile">{detail.customer?.nama || '-'}</span></div>
            <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">Kendaraan</span><span className="font-medium text-right truncate-mobile">{detail.vehicle ? `${detail.vehicle.platNomor} (${detail.vehicle.merk || ''} ${detail.vehicle.tipe || ''})` : '-'}</span></div>
            <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">No. Polis</span><span className="font-medium text-right">{detail.nomorPolis || '-'}</span></div>
            <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">Tertanggung</span><span className="font-medium text-right truncate-mobile">{detail.namaTertanggung || '-'}</span></div>
            <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">Jenis Klaim</span><span className="font-medium text-right">{CLAIM_TYPES[detail.jenisKlaim] || detail.jenisKlaim}</span></div>
            <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">Tgl Kejadian</span><span className="font-medium text-right">{detail.tanggalKejadian ? new Date(detail.tanggalKejadian).toLocaleDateString('id-ID') : '-'}</span></div>
            <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">Lokasi</span><span className="font-medium text-right truncate-mobile">{detail.lokasiKejadian || '-'}</span></div>
            {detail.workOrder && (
              <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">Work Order</span><span className="font-medium text-right text-brand-600">{detail.workOrder.nomorWo}</span></div>
            )}
            {detail.invoice && (
              <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">Invoice</span><span className="font-medium text-right text-indigo-600">{detail.invoice.nomorInvoice}</span></div>
            )}
            {detail.surveyorName && (
              <>
                <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">Surveyor</span><span className="font-medium text-right">{detail.surveyorName}</span></div>
                <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">Tgl Survey</span><span className="font-medium text-right">{detail.surveyDate ? new Date(detail.surveyDate).toLocaleDateString('id-ID') : '-'}</span></div>
              </>
            )}
            {detail.surveyResult && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-gray-500 text-xs mb-1">Hasil Survey</p>
                <p className="text-gray-800 bg-gray-50 rounded-lg p-2.5 text-xs leading-relaxed">{detail.surveyResult}</p>
              </div>
            )}
            {detail.deskripsiKerusakan && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-gray-500 text-xs mb-1">Deskripsi Kerusakan</p>
                <p className="text-gray-800 bg-gray-50 rounded-lg p-2.5 text-xs leading-relaxed">{detail.deskripsiKerusakan}</p>
              </div>
            )}
            {detail.paymentMethod && (
              <div className="flex justify-between gap-2 pt-2 border-t border-gray-100">
                <span className="text-gray-500 shrink-0">Pembayaran</span>
                <span className="font-medium text-right">{PAYMENT_METHODS[detail.paymentMethod] || detail.paymentMethod}{detail.paymentReference ? ` (${detail.paymentReference})` : ''}</span>
              </div>
            )}
          </div>

          {/* Riwayat status */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" /> Riwayat Status
            </h3>
            {(detail.history || []).length === 0 ? (
              <p className="text-sm text-gray-400">Belum ada riwayat.</p>
            ) : (
              <div className="space-y-0 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                {detail.history.map((h, idx) => (
                  <div key={h.id || idx} className="relative pl-6 pb-4 last:pb-0">
                    <span className={`absolute left-0 top-1 w-3.5 h-3.5 rounded-full ring-2 ring-white ${
                      idx === detail.history.length - 1 ? 'bg-brand-500' : 'bg-green-400'
                    }`} />
                    <p className="text-sm font-medium text-gray-800">
                      {h.statusFrom ? `${CLAIM_STATUS_LABELS[h.statusFrom] || h.statusFrom} → ` : ''}
                      {CLAIM_STATUS_LABELS[h.statusTo] || h.statusTo}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(h.createdAt).toLocaleString('id-ID')} • {h.changedBy}
                    </p>
                    {h.catatan && <p className="text-xs text-gray-500 mt-0.5 italic">{h.catatan}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Item klaim */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Rincian Item Klaim</h3>
          {(detail.items || []).length > 0 && (
            <div className="table-responsive mb-4">
              <table className="w-full text-sm min-w-[420px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Item</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-600 w-14">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600 w-28">Harga</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600 w-28">Total</th>
                    {canManage && <th className="px-3 py-2 w-12"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detail.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1.5 ${
                          item.tipe === 'PART' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {CLAIM_ITEM_TYPES[item.tipe] || item.tipe}
                        </span>
                        <span className="text-gray-800">{item.sparepart?.nama || item.deskripsi || '-'}</span>
                      </td>
                      <td className="px-3 py-2 text-center">{item.jumlah}</td>
                      <td className="px-3 py-2 text-right">{formatRupiah(item.hargaSatuan || 0)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatRupiah(item.total || 0)}</td>
                      {canManage && (
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => handleRemoveItem(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && !['CLOSED', 'CANCELLED'].includes(detail.status) && (
            <form onSubmit={handleAddItem} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
              <select value={itemForm.tipe} onChange={(e) => setItemForm({ ...itemForm, tipe: e.target.value })} className={`${inputClass} col-span-1`}>
                <option value="PART">Sparepart</option>
                <option value="LABOR">Jasa</option>
              </select>
              {itemForm.tipe === 'PART' ? (
                <select value={itemForm.sparepartId} onChange={(e) => setItemForm({ ...itemForm, sparepartId: e.target.value })} className={`${inputClass} col-span-2 sm:col-span-2`}>
                  <option value="">-- Pilih Sparepart --</option>
                  {/* spareparts tidak dimuat di halaman ini; gunakan deskripsi manual */}
                  <option value="">(gunakan deskripsi manual)</option>
                </select>
              ) : (
                <input type="text" placeholder="Deskripsi jasa..." value={itemForm.deskripsi} onChange={(e) => setItemForm({ ...itemForm, deskripsi: e.target.value })} className={`${inputClass} col-span-2`} />
              )}
              {itemForm.tipe === 'PART' && (
                <input type="text" placeholder="Deskripsi (opsional)" value={itemForm.deskripsi} onChange={(e) => setItemForm({ ...itemForm, deskripsi: e.target.value })} className={`${inputClass} col-span-2 hidden sm:block`} />
              )}
              <input type="number" min="1" placeholder="Qty" value={itemForm.jumlah} onChange={(e) => setItemForm({ ...itemForm, jumlah: e.target.value })} className={`${inputClass} col-span-1`} />
              <input type="number" min="0" placeholder="Harga" value={itemForm.hargaSatuan} onChange={(e) => setItemForm({ ...itemForm, hargaSatuan: e.target.value })} className={`${inputClass} col-span-1`} />
              <button type="submit" className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium touch-target">
                <Plus className="w-4 h-4" /> Tambah
              </button>
            </form>
          )}
        </div>

        {/* Dokumen klaim */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-gray-400" /> Dokumen Pendukung
          </h3>
          {(detail.documents || []).length > 0 && (
            <div className="space-y-2 mb-4">
              {detail.documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate-mobile">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-600 mr-1.5">
                        {CLAIM_DOC_TYPES[doc.tipeDokumen] || doc.tipeDokumen}
                      </span>
                      {doc.namaDokumen}
                    </p>
                    <p className="text-xs text-gray-400 truncate-mobile">
                      {new Date(doc.createdAt).toLocaleString('id-ID')} • {doc.uploadedBy}
                      {doc.urlDokumen && (
                        <> • <a href={doc.urlDokumen} target="_blank" rel="noreferrer" className="text-brand-600 underline">Buka Link</a></>
                      )}
                    </p>
                  </div>
                  {canManage && (
                    <button onClick={() => handleRemoveDocument(doc.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canManage && !['CLOSED', 'CANCELLED'].includes(detail.status) && (
            <form onSubmit={handleAddDocument} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
              <input type="text" required placeholder="Nama dokumen *" value={docForm.namaDokumen} onChange={(e) => setDocForm({ ...docForm, namaDokumen: e.target.value })} className={`${inputClass} col-span-2`} />
              <select value={docForm.tipeDokumen} onChange={(e) => setDocForm({ ...docForm, tipeDokumen: e.target.value })} className={inputClass}>
                {Object.entries(CLAIM_DOC_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <input type="url" placeholder="URL dokumen/foto" value={docForm.urlDokumen} onChange={(e) => setDocForm({ ...docForm, urlDokumen: e.target.value })} className={`${inputClass} col-span-2 sm:col-span-1`} />
              <button type="submit" className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium touch-target">
                <Plus className="w-4 h-4" /> Tambah
              </button>
            </form>
          )}
        </div>

        {/* Modal aksi workflow */}
        {actionModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="modal-mobile bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
                <h2 className="text-lg font-bold text-gray-800">{ACTION_META[actionModal.type]?.label}</h2>
                <button onClick={() => setActionModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmitAction} className="p-5 space-y-4">
                <p className="text-sm text-gray-500">
                  Klaim <span className="font-semibold text-gray-800">{actionModal.claim.nomorKlaim}</span> —{' '}
                  {CLAIM_STATUS_LABELS[actionModal.claim.status]} → {CLAIM_STATUS_LABELS[{
                    submit: CLAIM_STATUS.SUBMITTED,
                    scheduleSurvey: CLAIM_STATUS.SURVEY_SCHEDULED,
                    completeSurvey: CLAIM_STATUS.SURVEYED,
                    approve: CLAIM_STATUS.APPROVED,
                    reject: CLAIM_STATUS.REJECTED,
                    startRepair: CLAIM_STATUS.IN_PROGRESS,
                    completeRepair: CLAIM_STATUS.COMPLETED,
                    invoice: CLAIM_STATUS.INVOICED,
                    markPaid: CLAIM_STATUS.PAID,
                    close: CLAIM_STATUS.CLOSED,
                    cancel: CLAIM_STATUS.CANCELLED
                  }[actionModal.type]]}
                </p>

                {actionModal.type === 'scheduleSurvey' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Surveyor *</label>
                      <input type="text" required value={actionForm.surveyorName || ''} onChange={(e) => setActionForm({ ...actionForm, surveyorName: e.target.value })} className={inputClass} placeholder="Nama surveyor asuransi" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal & Jam Survey *</label>
                      <input type="datetime-local" required value={actionForm.surveyDate || ''} onChange={(e) => setActionForm({ ...actionForm, surveyDate: e.target.value })} className={inputClass} />
                    </div>
                  </>
                )}

                {actionModal.type === 'completeSurvey' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Hasil Survey *</label>
                    <textarea required rows="4" value={actionForm.surveyResult || ''} onChange={(e) => setActionForm({ ...actionForm, surveyResult: e.target.value })} className={`${inputClass} resize-none`} placeholder="Ringkasan hasil survey surveyor asuransi..." />
                  </div>
                )}

                {actionModal.type === 'approve' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nilai Disetujui (Rp) *</label>
                    <input type="number" required min="1" value={actionForm.approvedAmount || ''} onChange={(e) => setActionForm({ ...actionForm, approvedAmount: e.target.value })} className={inputClass} />
                    <p className="mt-1 text-xs text-gray-400">Estimasi awal: {formatRupiah(actionModal.claim.estimasiBiaya || 0)}</p>
                  </div>
                )}

                {actionModal.type === 'reject' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Alasan Penolakan *</label>
                    <textarea required rows="3" value={actionForm.rejectionReason || ''} onChange={(e) => setActionForm({ ...actionForm, rejectionReason: e.target.value })} className={`${inputClass} resize-none`} placeholder="Alasan penolakan dari asuransi..." />
                  </div>
                )}

                {actionModal.type === 'startRepair' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Work Order (opsional)</label>
                    <select value={actionForm.workOrderId || ''} onChange={(e) => setActionForm({ ...actionForm, workOrderId: e.target.value })} className={inputClass}>
                      <option value="">-- Tanpa Work Order --</option>
                      {workOrders.map(wo => (
                        <option key={wo.id} value={wo.id}>{wo.nomorWo} - {wo.customer?.nama || ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {actionModal.type === 'completeRepair' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Biaya Aktual (Rp) *</label>
                    <input type="number" required min="1" value={actionForm.actualCost || ''} onChange={(e) => setActionForm({ ...actionForm, actualCost: e.target.value })} className={inputClass} />
                  </div>
                )}

                {actionModal.type === 'invoice' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Link Invoice (opsional)</label>
                    <select value={actionForm.invoiceId || ''} onChange={(e) => setActionForm({ ...actionForm, invoiceId: e.target.value })} className={inputClass}>
                      <option value="">-- Tanpa Invoice --</option>
                      {workOrders.filter(wo => Number(wo.id) === Number(actionModal.claim.workOrderId)).map(wo => (
                        <option key={wo.id} value={wo.id}>Buat dari WO {wo.nomorWo} (buat invoice dulu di menu Faktur)</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-400">Untuk membuat invoice dari WO terkait, buka menu Faktur → Buat Faktur.</p>
                  </div>
                )}

                {actionModal.type === 'markPaid' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Metode Pembayaran *</label>
                      <select value={actionForm.paymentMethod || 'TRANSFER'} onChange={(e) => setActionForm({ ...actionForm, paymentMethod: e.target.value })} className={inputClass}>
                        {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Nominal Dibayar (Rp)</label>
                      <input type="number" min="0" value={actionForm.paidAmount || ''} onChange={(e) => setActionForm({ ...actionForm, paidAmount: e.target.value })} className={inputClass} />
                      <p className="mt-1 text-xs text-gray-400">Disetujui: {formatRupiah(actionModal.claim.approvedAmount || 0)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Referensi (opsional)</label>
                      <input type="text" value={actionForm.paymentReference || ''} onChange={(e) => setActionForm({ ...actionForm, paymentReference: e.target.value })} className={inputClass} placeholder="No. transfer / bukti bayar" />
                    </div>
                  </>
                )}

                {['submit', 'close', 'cancel'].includes(actionModal.type) && (
                  <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                    {actionModal.type === 'submit' && 'Klaim akan diajukan ke perusahaan asuransi dan menunggu jadwal survey.'}
                    {actionModal.type === 'close' && 'Klaim akan ditutup secara permanen.'}
                    {actionModal.type === 'cancel' && 'Klaim akan dibatalkan. Pastikan Anda yakin.'}
                  </p>
                )}

                <div className="flex gap-3 pt-2 pb-safe">
                  <button type="button" onClick={() => setActionModal(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors touch-target">
                    Batal
                  </button>
                  <button type="submit" className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors touch-target ${ACTION_META[actionModal.type]?.color}`}>
                    Konfirmasi
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ==================== LIST VIEW ====================
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-600" />
            Klaim Asuransi
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola klaim asuransi kendaraan pelanggan</p>
        </div>
        <div className="flex flex-wrap gap-2 mobile-stack-buttons">
          <button onClick={openCompanyModal}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors touch-target">
            <Building2 className="w-4 h-4" /> Perusahaan
          </button>
          <button onClick={handleExportCSV} disabled={filtered.length === 0}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors touch-target disabled:opacity-50">
            <Download className="w-4 h-4" /> CSV
          </button>
          {canManage && (
            <button onClick={openCreateForm}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors shadow-sm touch-target">
              <Plus className="w-4 h-4" /> Klaim Baru
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
          <p className="text-[10px] sm:text-xs text-gray-500">Total Klaim</p>
          <p className="text-base sm:text-xl font-bold text-gray-800">{stats.totalKlaim} <span className="text-xs font-normal text-gray-400">({stats.klaimAktif} aktif)</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
          <p className="text-[10px] sm:text-xs text-gray-500">Total Estimasi</p>
          <p className="text-base sm:text-xl font-bold text-blue-600">{formatRupiah(stats.totalEstimasi)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
          <p className="text-[10px] sm:text-xs text-gray-500">Disetujui Asuransi</p>
          <p className="text-base sm:text-xl font-bold text-green-600">{formatRupiah(stats.totalDisetujui)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
          <p className="text-[10px] sm:text-xs text-gray-500">Sudah Dibayar</p>
          <p className="text-base sm:text-xl font-bold text-emerald-600">{formatRupiah(stats.totalDibayar)}</p>
        </div>
      </div>

      {/* Search & filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari no. klaim, polis, pelanggan, plat..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === 'ALL' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Semua ({claims.length})
          </button>
          {[CLAIM_STATUS.DRAFT, CLAIM_STATUS.SUBMITTED, CLAIM_STATUS.SURVEY_SCHEDULED, CLAIM_STATUS.SURVEYED, CLAIM_STATUS.APPROVED, CLAIM_STATUS.IN_PROGRESS, CLAIM_STATUS.COMPLETED, CLAIM_STATUS.INVOICED, CLAIM_STATUS.PAID, CLAIM_STATUS.REJECTED].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {CLAIM_STATUS_LABELS[s]} ({statusStats[s] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Tabel desktop */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="table-responsive">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">No. Klaim</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Asuransi / Polis</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Pelanggan / Kendaraan</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Jenis</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Estimasi</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Disetujui</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-400">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-400">Belum ada klaim asuransi.</td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => { setDetailId(c.id); loadDetail(c.id) }}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-700">{c.nomorKlaim}</p>
                    <p className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString('id-ID')}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-800 truncate max-w-[160px]">{c.company?.nama || '-'}</p>
                    <p className="text-xs text-gray-400">Polis: {c.nomorPolis || '-'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-800 truncate max-w-[150px]">{c.customer?.nama || '-'}</p>
                    <p className="text-xs text-gray-400">{c.vehicle?.platNomor || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{CLAIM_TYPES[c.jenisKlaim] || c.jenisKlaim}</td>
                  <td className="px-4 py-3 text-right">{formatRupiah(c.estimasiBiaya || 0)}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">{formatRupiah(c.approvedAmount || 0)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${CLAIM_STATUS_COLORS[c.status]}`}>
                      {CLAIM_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {[CLAIM_STATUS.DRAFT, CLAIM_STATUS.CANCELLED, CLAIM_STATUS.REJECTED].includes(c.status) && canManage && (
                        <button onClick={() => handleDeleteClaim(c)} title="Hapus"
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card view mobile */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">Memuat data...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">Belum ada klaim asuransi.</div>
        ) : filtered.map((c) => (
          <div key={c.id}
            className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm active:bg-gray-50"
            onClick={() => { setDetailId(c.id); loadDetail(c.id) }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-brand-700 truncate-mobile">{c.nomorKlaim}</p>
                <p className="text-xs text-gray-400 truncate-mobile">{c.company?.nama || '-'} • Polis: {c.nomorPolis || '-'}</p>
              </div>
              <span className={`shrink-0 inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${CLAIM_STATUS_COLORS[c.status]}`}>
                {CLAIM_STATUS_LABELS[c.status]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div>
                <p className="text-gray-400">Pelanggan</p>
                <p className="text-gray-700 font-medium truncate-mobile">{c.customer?.nama || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400">Kendaraan</p>
                <p className="text-gray-700 font-medium truncate-mobile">{c.vehicle?.platNomor || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400">Estimasi</p>
                <p className="text-gray-700 font-medium">{formatRupiah(c.estimasiBiaya || 0)}</p>
              </div>
              <div>
                <p className="text-gray-400">Disetujui</p>
                <p className="text-green-600 font-medium">{formatRupiah(c.approvedAmount || 0)}</p>
              </div>
            </div>
            {[CLAIM_STATUS.DRAFT, CLAIM_STATUS.CANCELLED, CLAIM_STATUS.REJECTED].includes(c.status) && canManage && (
              <div className="flex justify-end pt-2" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => handleDeleteClaim(c)}
                  className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg active:bg-gray-200">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal form klaim */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="modal-mobile bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-800">{editingId ? 'Edit Klaim' : 'Klaim Asuransi Baru'}</h2>
              <button onClick={() => setShowFormModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitClaim} className="p-5 space-y-4">
              {formError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Perusahaan Asuransi *</label>
                  <select required value={claimForm.insuranceCompanyId} onChange={(e) => setClaimForm({ ...claimForm, insuranceCompanyId: e.target.value })} className={inputClass}>
                    <option value="">-- Pilih Perusahaan --</option>
                    {companies.filter(c => c.status === 'AKTIF').map(c => (
                      <option key={c.id} value={c.id}>{c.kode ? `${c.kode} - ` : ''}{c.nama}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nomor Polis *</label>
                  <input type="text" required value={claimForm.nomorPolis} onChange={(e) => setClaimForm({ ...claimForm, nomorPolis: e.target.value })} className={inputClass} placeholder="No. polis asuransi" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Pelanggan *</label>
                  <select required value={claimForm.customerId} onChange={(e) => setClaimForm({ ...claimForm, customerId: e.target.value, vehicleId: '' })} className={inputClass}>
                    <option value="">-- Pilih Pelanggan --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.nama}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Kendaraan</label>
                  <select value={claimForm.vehicleId} onChange={(e) => setClaimForm({ ...claimForm, vehicleId: e.target.value })} className={inputClass} disabled={!claimForm.customerId}>
                    <option value="">{claimForm.customerId ? '-- Pilih Kendaraan --' : 'Pilih pelanggan dulu'}</option>
                    {getVehiclesForCustomer(claimForm.customerId).map(v => (
                      <option key={v.id} value={v.id}>{v.platNomor} - {v.merk || ''} {v.tipe || ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Tertanggung</label>
                  <input type="text" value={claimForm.namaTertanggung} onChange={(e) => setClaimForm({ ...claimForm, namaTertanggung: e.target.value })} className={inputClass} placeholder="Nama pemegang polis" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Klaim *</label>
                  <select required value={claimForm.jenisKlaim} onChange={(e) => setClaimForm({ ...claimForm, jenisKlaim: e.target.value })} className={inputClass}>
                    {Object.entries(CLAIM_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Kejadian</label>
                  <input type="date" value={claimForm.tanggalKejadian} onChange={(e) => setClaimForm({ ...claimForm, tanggalKejadian: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Lokasi Kejadian</label>
                  <input type="text" value={claimForm.lokasiKejadian} onChange={(e) => setClaimForm({ ...claimForm, lokasiKejadian: e.target.value })} className={inputClass} placeholder="Lokasi kejadian" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimasi Biaya (Rp) *</label>
                  <input type="number" required min="0" value={claimForm.estimasiBiaya} onChange={(e) => setClaimForm({ ...claimForm, estimasiBiaya: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Partisipasi Pelanggan (Rp)</label>
                  <input type="number" min="0" value={claimForm.deductible} onChange={(e) => setClaimForm({ ...claimForm, deductible: e.target.value })} className={inputClass} placeholder="0" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Deskripsi Kerusakan *</label>
                  <textarea required rows="3" value={claimForm.deskripsiKerusakan} onChange={(e) => setClaimForm({ ...claimForm, deskripsiKerusakan: e.target.value })} className={`${inputClass} resize-none`} placeholder="Jelaskan kerusakan yang terjadi..." />
                </div>
              </div>

              <div className="flex gap-3 pt-2 pb-safe">
                <button type="button" onClick={() => setShowFormModal(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors touch-target">
                  Batal
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors touch-target">
                  {editingId ? 'Simpan Perubahan' : 'Buat Klaim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal perusahaan asuransi */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="modal-mobile bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-600" /> Perusahaan Asuransi
              </h2>
              <button onClick={() => { setShowCompanyModal(false); setEditingCompanyId(null); setCompanyForm(emptyCompanyForm) }} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Form tambah/edit */}
              <form onSubmit={handleSaveCompany} className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">{editingCompanyId ? 'Edit Perusahaan' : 'Tambah Perusahaan Baru'}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" required placeholder="Nama perusahaan *" value={companyForm.nama} onChange={(e) => setCompanyForm({ ...companyForm, nama: e.target.value })} className={inputClass} />
                  <select value={companyForm.jenisAsuransi} onChange={(e) => setCompanyForm({ ...companyForm, jenisAsuransi: e.target.value })} className={inputClass}>
                    <option value="UMUM">Asuransi Umum</option>
                    <option value="KENDARAAN">Asuransi Kendaraan</option>
                    <option value="JIWA">Asuransi Jiwa</option>
                    <option value="PROPERTI">Asuransi Properti</option>
                  </select>
                  <input type="tel" placeholder="Telepon" value={companyForm.telepon} onChange={(e) => setCompanyForm({ ...companyForm, telepon: e.target.value })} className={inputClass} />
                  <input type="email" placeholder="Email" value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} className={inputClass} />
                  <input type="text" placeholder="Kontak person" value={companyForm.kontakPerson} onChange={(e) => setCompanyForm({ ...companyForm, kontakPerson: e.target.value })} className={inputClass} />
                  <input type="tel" placeholder="Telepon kontak" value={companyForm.teleponKontak} onChange={(e) => setCompanyForm({ ...companyForm, teleponKontak: e.target.value })} className={inputClass} />
                  <input type="text" placeholder="Nomor rekening pembayaran" value={companyForm.nomorRekening} onChange={(e) => setCompanyForm({ ...companyForm, nomorRekening: e.target.value })} className={`${inputClass} sm:col-span-2`} />
                  <input type="text" placeholder="Alamat" value={companyForm.alamat} onChange={(e) => setCompanyForm({ ...companyForm, alamat: e.target.value })} className={`${inputClass} sm:col-span-2`} />
                </div>
                <div className="flex gap-2">
                  {editingCompanyId && (
                    <button type="button" onClick={() => { setEditingCompanyId(null); setCompanyForm(emptyCompanyForm) }} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">
                      Batal Edit
                    </button>
                  )}
                  <button type="submit" className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium touch-target">
                    <Plus className="w-4 h-4" /> {editingCompanyId ? 'Simpan Perubahan' : 'Tambah Perusahaan'}
                  </button>
                </div>
              </form>

              {/* Daftar perusahaan */}
              <div className="space-y-2">
                {companyList.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Belum ada perusahaan asuransi.</p>
                ) : companyList.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate-mobile">
                        <span className="text-[10px] font-mono text-gray-400 mr-1.5">{c.kode}</span>
                        {c.nama}
                        {c.status !== 'AKTIF' && <span className="ml-1.5 text-[10px] text-red-500">(Nonaktif)</span>}
                      </p>
                      <p className="text-xs text-gray-400 truncate-mobile">
                        {c.telepon || '-'} {c.kontakPerson ? `• CP: ${c.kontakPerson}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditingCompanyId(c.id); setCompanyForm({ nama: c.nama, jenisAsuransi: c.jenisAsuransi || 'UMUM', telepon: c.telepon || '', email: c.email || '', alamat: c.alamat || '', kontakPerson: c.kontakPerson || '', teleponKontak: c.teleponKontak || '', nomorRekening: c.nomorRekening || '', catatan: c.catatan || '' }) }}
                        className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteCompany(c)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InsuranceClaims