import { db } from './database'
import { authService } from './authService'
import { formatRupiah } from '../utils/format'

// ============================================================
// SERVICE KLAIM ASURANSI
// Alur kerja (workflow) klaim asuransi bengkel:
//
//   1. DRAFT            : Klaim dibuat, data diisi (belum dikirim)
//   2. SUBMITTED        : Klaim disubmit ke perusahaan asuransi
//   3. SURVEY_SCHEDULED : Jadwal survey oleh surveyor asuransi
//   4. SURVEYED         : Survey selesai, hasil survey dicatat
//   5. APPROVED         : Asuransi menyetujui (dengan nilai persetujuan)
//   6. IN_PROGRESS      : Pengerjaan servis berjalan (link ke Work Order)
//   7. COMPLETED        : Servis selesai, biaya aktual final
//   8. INVOICED         : Tagihan dikirim ke asuransi
//   9. PAID             : Asuransi membayar klaim
//  10. CLOSED           : Klaim ditutup
//
//   Cabang:
//   - REJECTED  : ditolak asuransi (dari SUBMITTED/SURVEY_SCHEDULED/SURVEYED/APPROVED)
//   - CANCELLED : dibatalkan bengkel (dari DRAFT/SUBMITTED)
//
// Setiap transisi status tercatat di tabel claim_status_history (audit trail).
// ============================================================

// Helper untuk generate nomor klaim
function generateNomorKlaim(existingItems) {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const count = (existingItems || []).length + 1
  return `CLM-${year}${month}-${String(count).padStart(4, '0')}`
}

// Helper untuk generate kode perusahaan asuransi
function generateKodeAsuransi(existingItems) {
  const count = (existingItems || []).length + 1
  return `INS-${String(count).padStart(3, '0')}`
}

export const CLAIM_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  SURVEY_SCHEDULED: 'SURVEY_SCHEDULED',
  SURVEYED: 'SURVEYED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  INVOICED: 'INVOICED',
  PAID: 'PAID',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED'
}

export const CLAIM_STATUS_LABELS = {
  [CLAIM_STATUS.DRAFT]: 'Draft',
  [CLAIM_STATUS.SUBMITTED]: 'Diajukan',
  [CLAIM_STATUS.SURVEY_SCHEDULED]: 'Jadwal Survey',
  [CLAIM_STATUS.SURVEYED]: 'Sudah Disurvey',
  [CLAIM_STATUS.APPROVED]: 'Disetujui',
  [CLAIM_STATUS.REJECTED]: 'Ditolak',
  [CLAIM_STATUS.IN_PROGRESS]: 'Dikerjakan',
  [CLAIM_STATUS.COMPLETED]: 'Servis Selesai',
  [CLAIM_STATUS.INVOICED]: 'Ditagihkan',
  [CLAIM_STATUS.PAID]: 'Dibayar Asuransi',
  [CLAIM_STATUS.CLOSED]: 'Selesai',
  [CLAIM_STATUS.CANCELLED]: 'Dibatalkan'
}

export const CLAIM_STATUS_COLORS = {
  [CLAIM_STATUS.DRAFT]: 'bg-gray-100 text-gray-700',
  [CLAIM_STATUS.SUBMITTED]: 'bg-blue-100 text-blue-700',
  [CLAIM_STATUS.SURVEY_SCHEDULED]: 'bg-cyan-100 text-cyan-700',
  [CLAIM_STATUS.SURVEYED]: 'bg-teal-100 text-teal-700',
  [CLAIM_STATUS.APPROVED]: 'bg-green-100 text-green-700',
  [CLAIM_STATUS.REJECTED]: 'bg-red-100 text-red-700',
  [CLAIM_STATUS.IN_PROGRESS]: 'bg-yellow-100 text-yellow-700',
  [CLAIM_STATUS.COMPLETED]: 'bg-lime-100 text-lime-700',
  [CLAIM_STATUS.INVOICED]: 'bg-indigo-100 text-indigo-700',
  [CLAIM_STATUS.PAID]: 'bg-emerald-100 text-emerald-700',
  [CLAIM_STATUS.CLOSED]: 'bg-purple-100 text-purple-700',
  [CLAIM_STATUS.CANCELLED]: 'bg-gray-200 text-gray-500'
}

// Urutan alur utama untuk progress bar
export const CLAIM_FLOW = [
  CLAIM_STATUS.DRAFT,
  CLAIM_STATUS.SUBMITTED,
  CLAIM_STATUS.SURVEY_SCHEDULED,
  CLAIM_STATUS.SURVEYED,
  CLAIM_STATUS.APPROVED,
  CLAIM_STATUS.IN_PROGRESS,
  CLAIM_STATUS.COMPLETED,
  CLAIM_STATUS.INVOICED,
  CLAIM_STATUS.PAID,
  CLAIM_STATUS.CLOSED
]

export const CLAIM_TYPES = {
  KECELAKAAN: 'Kecelakaan',
  BANJIR: 'Banjir / Bencana Alam',
  KEHILANGAN: 'Kehilangan',
  KERUSAKAN: 'Kerusakan Mendadak',
  LAINNYA: 'Lainnya'
}

export const CLAIM_ITEM_TYPES = {
  PART: 'Sparepart',
  LABOR: 'Jasa'
}

export const CLAIM_DOC_TYPES = {
  FOTO: 'Foto Kerusakan',
  POLIS: 'Polis Asuransi',
  STNK: 'STNK',
  KTP: 'KTP',
  SIM: 'SIM',
  LAPORAN_POLISI: 'Laporan Polisi',
  SURAT_KLAIM: 'Surat Klaim',
  HASIL_SURVEY: 'Hasil Survey',
  LAINNYA: 'Lainnya'
}

export const PAYMENT_METHODS = {
  TRANSFER: 'Transfer Bank',
  TUNAI: 'Tunai',
  KARTU: 'Kartu',
  E_WALLET: 'E-Wallet'
}

// Transisi status yang valid: { dari: [ke...] }
const VALID_TRANSITIONS = {
  [CLAIM_STATUS.DRAFT]: [CLAIM_STATUS.SUBMITTED, CLAIM_STATUS.CANCELLED],
  [CLAIM_STATUS.SUBMITTED]: [CLAIM_STATUS.SURVEY_SCHEDULED, CLAIM_STATUS.REJECTED, CLAIM_STATUS.CANCELLED],
  [CLAIM_STATUS.SURVEY_SCHEDULED]: [CLAIM_STATUS.SURVEYED, CLAIM_STATUS.REJECTED],
  [CLAIM_STATUS.SURVEYED]: [CLAIM_STATUS.APPROVED, CLAIM_STATUS.REJECTED],
  [CLAIM_STATUS.APPROVED]: [CLAIM_STATUS.IN_PROGRESS, CLAIM_STATUS.REJECTED],
  [CLAIM_STATUS.IN_PROGRESS]: [CLAIM_STATUS.COMPLETED],
  [CLAIM_STATUS.COMPLETED]: [CLAIM_STATUS.INVOICED],
  [CLAIM_STATUS.INVOICED]: [CLAIM_STATUS.PAID],
  [CLAIM_STATUS.PAID]: [CLAIM_STATUS.CLOSED],
  [CLAIM_STATUS.REJECTED]: [CLAIM_STATUS.CLOSED],
  [CLAIM_STATUS.CLOSED]: [],
  [CLAIM_STATUS.CANCELLED]: []
}

export const insuranceClaimService = {
  // ==================== PERUSAHAAN ASURANSI ====================

  async getCompanies() {
    const companies = await db.getAll(db.keys.INSURANCE_COMPANIES)
    return (companies || []).sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
  },

  async createCompany(data) {
    if (!data.nama) throw new Error('Nama perusahaan asuransi wajib diisi')
    const existing = await db.getAll(db.keys.INSURANCE_COMPANIES)
    return db.insert(db.keys.INSURANCE_COMPANIES, {
      kode: data.kode || generateKodeAsuransi(existing),
      nama: data.nama,
      jenisAsuransi: data.jenisAsuransi || 'UMUM',
      telepon: data.telepon || '',
      email: data.email || '',
      alamat: data.alamat || '',
      kontakPerson: data.kontakPerson || '',
      teleponKontak: data.teleponKontak || '',
      nomorRekening: data.nomorRekening || '',
      catatan: data.catatan || '',
      status: data.status || 'AKTIF',
      createdAt: new Date().toISOString()
    })
  },

  async updateCompany(id, data) {
    await db.update(db.keys.INSURANCE_COMPANIES, id, { ...data, updatedAt: new Date().toISOString() })
    return db.getById(db.keys.INSURANCE_COMPANIES, id)
  },

  async deleteCompany(id) {
    // Cek apakah masih ada klaim terkait
    const claims = await db.getAll(db.keys.INSURANCE_CLAIMS)
    const related = (claims || []).filter(c => Number(c.insuranceCompanyId) === Number(id))
    if (related.length > 0) {
      throw new Error(`Tidak dapat menghapus: masih ada ${related.length} klaim terkait perusahaan ini`)
    }
    await db.remove(db.keys.INSURANCE_COMPANIES, id)
    return true
  },

  // ==================== KLAIM ====================

  // Ambil semua klaim dengan data ter-enrich (company, customer, vehicle, WO, invoice)
  async getAll() {
    const [claims, companies, customers, vehicles, workOrders, invoices] = await Promise.all([
      db.getAll(db.keys.INSURANCE_CLAIMS),
      db.getAll(db.keys.INSURANCE_COMPANIES),
      db.getAll(db.keys.CUSTOMERS),
      db.getAll(db.keys.VEHICLES),
      db.getAll(db.keys.WORK_ORDERS),
      db.getAll(db.keys.INVOICES)
    ])

    const companyMap = new Map(companies.map(c => [Number(c.id), c]))
    const customerMap = new Map(customers.map(c => [Number(c.id), c]))
    const vehicleMap = new Map(vehicles.map(v => [Number(v.id), v]))
    const woMap = new Map(workOrders.map(wo => [Number(wo.id), wo]))
    const invMap = new Map(invoices.map(inv => [Number(inv.id), inv]))

    return (claims || []).map(c => ({
      ...c,
      company: companyMap.get(Number(c.insuranceCompanyId)) || null,
      customer: customerMap.get(Number(c.customerId)) || null,
      vehicle: vehicleMap.get(Number(c.vehicleId)) || null,
      workOrder: woMap.get(Number(c.workOrderId)) || null,
      invoice: invMap.get(Number(c.invoiceId)) || null
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },

  async getById(id) {
    const claim = await db.getById(db.keys.INSURANCE_CLAIMS, id)
    if (!claim) return null

    const [company, customer, vehicle, workOrder, invoice, items, documents, history] = await Promise.all([
      claim.insuranceCompanyId ? db.getById(db.keys.INSURANCE_COMPANIES, claim.insuranceCompanyId) : Promise.resolve(null),
      claim.customerId ? db.getById(db.keys.CUSTOMERS, claim.customerId) : Promise.resolve(null),
      claim.vehicleId ? db.getById(db.keys.VEHICLES, claim.vehicleId) : Promise.resolve(null),
      claim.workOrderId ? db.getById(db.keys.WORK_ORDERS, claim.workOrderId) : Promise.resolve(null),
      claim.invoiceId ? db.getById(db.keys.INVOICES, claim.invoiceId) : Promise.resolve(null),
      this.getItems(id),
      this.getDocuments(id),
      this.getStatusHistory(id)
    ])

    return {
      ...claim,
      company,
      customer,
      vehicle,
      workOrder,
      invoice,
      items,
      documents,
      history
    }
  },

  // Buat klaim baru (status DRAFT)
  async create(data) {
    if (!data.insuranceCompanyId) throw new Error('Perusahaan asuransi wajib dipilih')
    if (!data.customerId) throw new Error('Pelanggan wajib dipilih')
    if (!data.nomorPolis) throw new Error('Nomor polis wajib diisi')
    if (!data.jenisKlaim) throw new Error('Jenis klaim wajib dipilih')

    const existing = await db.getAll(db.keys.INSURANCE_CLAIMS)
    const nomorKlaim = data.nomorKlaim || generateNomorKlaim(existing)

    const claim = await db.insert(db.keys.INSURANCE_CLAIMS, {
      nomorKlaim,
      insuranceCompanyId: data.insuranceCompanyId,
      customerId: data.customerId,
      vehicleId: data.vehicleId || null,
      workOrderId: data.workOrderId || null,
      invoiceId: null,
      nomorPolis: data.nomorPolis,
      namaTertanggung: data.namaTertanggung || '',
      jenisKlaim: data.jenisKlaim,
      tanggalKejadian: data.tanggalKejadian || null,
      lokasiKejadian: data.lokasiKejadian || '',
      deskripsiKerusakan: data.deskripsiKerusakan || '',
      estimasiBiaya: Number(data.estimasiBiaya || 0),
      approvedAmount: 0,
      actualCost: 0,
      deductible: Number(data.deductible || 0),
      status: CLAIM_STATUS.DRAFT,
      catatan: data.catatan || '',
      createdAt: new Date().toISOString()
    })

    // Catat riwayat status awal
    await this.logStatus(claim.id, null, CLAIM_STATUS.DRAFT, 'Klaim dibuat')

    // Simpan item klaim jika ada
    if (Array.isArray(data.items) && data.items.length > 0) {
      for (const item of data.items) {
        await this.addItem(claim.id, item)
      }
    }

    return this.getById(claim.id)
  },

  async update(id, data) {
    await db.update(db.keys.INSURANCE_CLAIMS, id, { ...data, updatedAt: new Date().toISOString() })
    return this.getById(id)
  },

  async delete(id) {
    const claim = await db.getById(db.keys.INSURANCE_CLAIMS, id)
    if (!claim) throw new Error('Klaim tidak ditemukan')
    // Hanya klaim DRAFT/CANCELLED/REJECTED yang bisa dihapus
    if (![CLAIM_STATUS.DRAFT, CLAIM_STATUS.CANCELLED, CLAIM_STATUS.REJECTED].includes(claim.status)) {
      throw new Error('Hanya klaim berstatus Draft, Dibatalkan, atau Ditolak yang dapat dihapus')
    }

    // Hapus data terkait
    const [items, documents, history] = await Promise.all([
      db.getAll(db.keys.CLAIM_ITEMS),
      db.getAll(db.keys.CLAIM_DOCUMENTS),
      db.getAll(db.keys.CLAIM_STATUS_HISTORY)
    ])
    for (const item of items) {
      if (Number(item.claimId) === Number(id)) await db.remove(db.keys.CLAIM_ITEMS, item.id)
    }
    for (const doc of documents) {
      if (Number(doc.claimId) === Number(id)) await db.remove(db.keys.CLAIM_DOCUMENTS, doc.id)
    }
    for (const h of history) {
      if (Number(h.claimId) === Number(id)) await db.remove(db.keys.CLAIM_STATUS_HISTORY, h.id)
    }

    await db.remove(db.keys.INSURANCE_CLAIMS, id)
    return true
  },

  // ==================== ALUR KERJA (WORKFLOW) ====================

  // Catat perubahan status ke riwayat
  async logStatus(claimId, statusFrom, statusTo, catatan = '') {
    const currentUser = authService.getCurrentUser()
    return db.insert(db.keys.CLAIM_STATUS_HISTORY, {
      claimId,
      statusFrom,
      statusTo,
      changedBy: currentUser?.nama || currentUser?.username || 'Sistem',
      catatan,
      createdAt: new Date().toISOString()
    })
  },

  // Validasi & eksekusi transisi status
  async transition(claimId, toStatus, { catatan = '', extraData = {} } = {}) {
    const claim = await db.getById(db.keys.INSURANCE_CLAIMS, claimId)
    if (!claim) throw new Error('Klaim tidak ditemukan')

    const allowed = VALID_TRANSITIONS[claim.status] || []
    if (!allowed.includes(toStatus)) {
      throw new Error(`Transisi tidak valid: dari "${CLAIM_STATUS_LABELS[claim.status]}" ke "${CLAIM_STATUS_LABELS[toStatus]}"`)
    }

    const now = new Date().toISOString()
    const updateData = { status: toStatus, ...extraData }

    // Set timestamp sesuai status tujuan
    if (toStatus === CLAIM_STATUS.SUBMITTED) updateData.submittedAt = now
    if (toStatus === CLAIM_STATUS.APPROVED) updateData.approvedAt = now
    if (toStatus === CLAIM_STATUS.COMPLETED) updateData.completedAt = now
    if (toStatus === CLAIM_STATUS.INVOICED) updateData.invoicedAt = now
    if (toStatus === CLAIM_STATUS.PAID) updateData.paidAt = now
    if (toStatus === CLAIM_STATUS.CLOSED) updateData.closedAt = now

    await db.update(db.keys.INSURANCE_CLAIMS, claimId, { ...updateData, updatedAt: now })
    await this.logStatus(claimId, claim.status, toStatus, catatan)

    return this.getById(claimId)
  },

  // 1. Submit klaim ke asuransi: DRAFT -> SUBMITTED
  async submit(claimId, catatan = '') {
    const claim = await db.getById(db.keys.INSURANCE_CLAIMS, claimId)
    if (!claim) throw new Error('Klaim tidak ditemukan')
    if (!claim.nomorPolis) throw new Error('Nomor polis wajib diisi sebelum submit')
    if (!claim.deskripsiKerusakan) throw new Error('Deskripsi kerusakan wajib diisi sebelum submit')
    if (Number(claim.estimasiBiaya || 0) <= 0) throw new Error('Estimasi biaya wajib diisi sebelum submit')
    return this.transition(claimId, CLAIM_STATUS.SUBMITTED, { catatan: catatan || 'Klaim diajukan ke perusahaan asuransi' })
  },

  // 2. Jadwalkan survey: SUBMITTED -> SURVEY_SCHEDULED
  async scheduleSurvey(claimId, { surveyorName, surveyDate, catatan = '' }) {
    if (!surveyorName) throw new Error('Nama surveyor wajib diisi')
    if (!surveyDate) throw new Error('Tanggal survey wajib diisi')
    return this.transition(claimId, CLAIM_STATUS.SURVEY_SCHEDULED, {
      catatan: catatan || `Survey dijadwalkan oleh ${surveyorName}`,
      extraData: { surveyorName, surveyDate }
    })
  },

  // 3. Selesaikan survey: SURVEY_SCHEDULED -> SURVEYED
  async completeSurvey(claimId, { surveyResult, catatan = '' }) {
    if (!surveyResult) throw new Error('Hasil survey wajib diisi')
    return this.transition(claimId, CLAIM_STATUS.SURVEYED, {
      catatan: catatan || 'Survey selesai dilakukan',
      extraData: { surveyResult }
    })
  },

  // 4. Setujui klaim: SURVEYED -> APPROVED
  async approve(claimId, { approvedAmount, catatan = '' }) {
    const nominal = Number(approvedAmount || 0)
    if (nominal <= 0) throw new Error('Nilai persetujuan (approved amount) wajib lebih dari 0')
    return this.transition(claimId, CLAIM_STATUS.APPROVED, {
      catatan: catatan || `Klaim disetujui sebesar ${formatRupiah(nominal)}`,
      extraData: { approvedAmount: nominal }
    })
  },

  // 5. Tolak klaim: SUBMITTED/SURVEY_SCHEDULED/SURVEYED/APPROVED -> REJECTED
  async reject(claimId, { rejectionReason, catatan = '' }) {
    if (!rejectionReason) throw new Error('Alasan penolakan wajib diisi')
    return this.transition(claimId, CLAIM_STATUS.REJECTED, {
      catatan: catatan || `Klaim ditolak: ${rejectionReason}`,
      extraData: { rejectionReason }
    })
  },

  // 6. Mulai pengerjaan: APPROVED -> IN_PROGRESS
  async startRepair(claimId, { workOrderId = null, catatan = '' } = {}) {
    const extraData = {}
    if (workOrderId) extraData.workOrderId = workOrderId
    return this.transition(claimId, CLAIM_STATUS.IN_PROGRESS, {
      catatan: catatan || 'Pengerjaan servis dimulai',
      extraData
    })
  },

  // 7. Selesaikan servis: IN_PROGRESS -> COMPLETED
  async completeRepair(claimId, { actualCost, catatan = '' }) {
    const nominal = Number(actualCost || 0)
    if (nominal <= 0) throw new Error('Biaya aktual wajib lebih dari 0')
    return this.transition(claimId, CLAIM_STATUS.COMPLETED, {
      catatan: catatan || `Servis selesai, biaya aktual ${formatRupiah(nominal)}`,
      extraData: { actualCost: nominal }
    })
  },

  // 8. Tagih ke asuransi: COMPLETED -> INVOICED
  // invoiceId opsional: link ke invoice yang sudah dibuat dari WO
  async invoiceToInsurance(claimId, { invoiceId = null, catatan = '' } = {}) {
    const extraData = {}
    if (invoiceId) extraData.invoiceId = invoiceId
    return this.transition(claimId, CLAIM_STATUS.INVOICED, {
      catatan: catatan || 'Tagihan dikirim ke perusahaan asuransi',
      extraData
    })
  },

  // 9. Catat pembayaran asuransi: INVOICED -> PAID
  async markPaid(claimId, { paymentMethod, paymentReference = '', paidAmount = null, catatan = '' }) {
    if (!paymentMethod) throw new Error('Metode pembayaran wajib dipilih')
    const claim = await db.getById(db.keys.INSURANCE_CLAIMS, claimId)
    if (!claim) throw new Error('Klaim tidak ditemukan')

    const extraData = { paymentMethod, paymentReference }
    // Jika nominal pembayaran diberikan dan berbeda dari approved, update approvedAmount
    if (paidAmount !== null && paidAmount !== undefined && Number(paidAmount) > 0) {
      extraData.approvedAmount = Number(paidAmount)
    }
    return this.transition(claimId, CLAIM_STATUS.PAID, {
      catatan: catatan || `Pembayaran diterima via ${PAYMENT_METHODS[paymentMethod] || paymentMethod}`,
      extraData
    })
  },

  // 10. Tutup klaim: PAID/REJECTED -> CLOSED
  async close(claimId, catatan = '') {
    return this.transition(claimId, CLAIM_STATUS.CLOSED, { catatan: catatan || 'Klaim ditutup' })
  },

  // Batalkan klaim: DRAFT/SUBMITTED -> CANCELLED
  async cancel(claimId, catatan = '') {
    return this.transition(claimId, CLAIM_STATUS.CANCELLED, { catatan: catatan || 'Klaim dibatalkan' })
  },

  // ==================== ITEM KLAIM ====================

  async getItems(claimId) {
    const [items, spareparts] = await Promise.all([
      db.getAll(db.keys.CLAIM_ITEMS),
      db.getAll(db.keys.SPAREPARTS)
    ])
    const sparepartMap = new Map(spareparts.map(sp => [Number(sp.id), sp]))
    return (items || [])
      .filter(item => Number(item.claimId) === Number(claimId))
      .map(item => ({
        ...item,
        sparepart: sparepartMap.get(Number(item.sparepartId)) || null
      }))
  },

  async addItem(claimId, { sparepartId = null, tipe = 'PART', deskripsi = '', jumlah = 1, hargaSatuan = 0 }) {
    const jumlahNum = Number(jumlah || 1)
    const hargaNum = Number(hargaSatuan || 0)
    return db.insert(db.keys.CLAIM_ITEMS, {
      claimId,
      sparepartId: sparepartId || null,
      tipe,
      deskripsi,
      jumlah: jumlahNum,
      hargaSatuan: hargaNum,
      total: jumlahNum * hargaNum,
      createdAt: new Date().toISOString()
    })
  },

  async removeItem(itemId) {
    await db.remove(db.keys.CLAIM_ITEMS, itemId)
    return true
  },

  // ==================== DOKUMEN KLAIM ====================

  async getDocuments(claimId) {
    const documents = await db.getAll(db.keys.CLAIM_DOCUMENTS)
    return (documents || [])
      .filter(doc => Number(doc.claimId) === Number(claimId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },

  async addDocument(claimId, { namaDokumen, tipeDokumen = 'LAINNYA', urlDokumen = '', keterangan = '' }) {
    if (!namaDokumen) throw new Error('Nama dokumen wajib diisi')
    const currentUser = authService.getCurrentUser()
    return db.insert(db.keys.CLAIM_DOCUMENTS, {
      claimId,
      namaDokumen,
      tipeDokumen,
      urlDokumen,
      keterangan,
      uploadedBy: currentUser?.nama || currentUser?.username || 'Sistem',
      createdAt: new Date().toISOString()
    })
  },

  async removeDocument(docId) {
    await db.remove(db.keys.CLAIM_DOCUMENTS, docId)
    return true
  },

  // ==================== RIWAYAT STATUS ====================

  async getStatusHistory(claimId) {
    const history = await db.getAll(db.keys.CLAIM_STATUS_HISTORY)
    return (history || [])
      .filter(h => Number(h.claimId) === Number(claimId))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  },

  // ==================== STATISTIK & UTILITAS ====================

  getStatusStats(items = []) {
    const stats = {}
    Object.values(CLAIM_STATUS).forEach(s => {
      stats[s] = items.filter(c => c.status === s).length
    })
    return stats
  },

  // Ringkasan keuangan klaim
  getFinancialSummary(items = []) {
    const active = items.filter(c => ![CLAIM_STATUS.CANCELLED, CLAIM_STATUS.REJECTED].includes(c.status))
    return {
      totalKlaim: items.length,
      klaimAktif: active.length,
      totalEstimasi: active.reduce((sum, c) => sum + Number(c.estimasiBiaya || 0), 0),
      totalDisetujui: items
        .filter(c => [CLAIM_STATUS.APPROVED, CLAIM_STATUS.IN_PROGRESS, CLAIM_STATUS.COMPLETED, CLAIM_STATUS.INVOICED, CLAIM_STATUS.PAID, CLAIM_STATUS.CLOSED].includes(c.status))
        .reduce((sum, c) => sum + Number(c.approvedAmount || 0), 0),
      totalDibayar: items
        .filter(c => [CLAIM_STATUS.PAID, CLAIM_STATUS.CLOSED].includes(c.status))
        .reduce((sum, c) => sum + Number(c.approvedAmount || 0), 0),
      totalDeductible: active.reduce((sum, c) => sum + Number(c.deductible || 0), 0)
    }
  },

  search(query, items = []) {
    const q = (query || '').toLowerCase()
    if (!q) return items
    return items.filter(c =>
      (c.nomorKlaim || '').toLowerCase().includes(q) ||
      (c.nomorPolis || '').toLowerCase().includes(q) ||
      (c.namaTertanggung || '').toLowerCase().includes(q) ||
      ((c.company && c.company.nama) || '').toLowerCase().includes(q) ||
      ((c.customer && c.customer.nama) || '').toLowerCase().includes(q) ||
      ((c.vehicle && c.vehicle.platNomor) || '').toLowerCase().includes(q) ||
      (c.deskripsiKerusakan || '').toLowerCase().includes(q)
    )
  },

  filterByStatus(status, items = []) {
    if (!status || status === 'ALL') return items
    return items.filter(c => c.status === status)
  },

  // Cek apakah transisi dari status tertentu ke status tujuan valid
  canTransition(fromStatus, toStatus) {
    return (VALID_TRANSITIONS[fromStatus] || []).includes(toStatus)
  },

  // Ambil daftar aksi yang tersedia untuk status tertentu (untuk UI)
  getAvailableActions(status) {
    const actions = []
    if (this.canTransition(status, CLAIM_STATUS.SUBMITTED)) actions.push('submit')
    if (this.canTransition(status, CLAIM_STATUS.SURVEY_SCHEDULED)) actions.push('scheduleSurvey')
    if (this.canTransition(status, CLAIM_STATUS.SURVEYED)) actions.push('completeSurvey')
    if (this.canTransition(status, CLAIM_STATUS.APPROVED)) actions.push('approve')
    if (this.canTransition(status, CLAIM_STATUS.REJECTED)) actions.push('reject')
    if (this.canTransition(status, CLAIM_STATUS.IN_PROGRESS)) actions.push('startRepair')
    if (this.canTransition(status, CLAIM_STATUS.COMPLETED)) actions.push('completeRepair')
    if (this.canTransition(status, CLAIM_STATUS.INVOICED)) actions.push('invoice')
    if (this.canTransition(status, CLAIM_STATUS.PAID)) actions.push('markPaid')
    if (this.canTransition(status, CLAIM_STATUS.CLOSED)) actions.push('close')
    if (this.canTransition(status, CLAIM_STATUS.CANCELLED)) actions.push('cancel')
    return actions
  },

  exportToCSV(items = []) {
    const headers = ['No. Klaim', 'Perusahaan Asuransi', 'Pelanggan', 'Kendaraan', 'No. Polis', 'Jenis Klaim', 'Tanggal Kejadian', 'Estimasi', 'Disetujui', 'Biaya Aktual', 'Deductible', 'Status']
    const rows = items.map(c => [
      c.nomorKlaim || '',
      c.company?.nama || '',
      c.customer?.nama || '',
      c.vehicle?.platNomor || '',
      c.nomorPolis || '',
      CLAIM_TYPES[c.jenisKlaim] || c.jenisKlaim,
      c.tanggalKejadian ? new Date(c.tanggalKejadian).toLocaleDateString('id-ID') : '',
      c.estimasiBiaya || 0,
      c.approvedAmount || 0,
      c.actualCost || 0,
      c.deductible || 0,
      CLAIM_STATUS_LABELS[c.status] || c.status
    ])
    return { headers, rows, filename: `klaim_asuransi_${new Date().toISOString().slice(0, 10)}.csv` }
  }
}