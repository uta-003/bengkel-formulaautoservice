import { db } from './database'
import { transactionService } from './transactionService'
import { formatRupiah } from '../utils/format'

// Helper untuk generate nomor retur
function generateNomorRetur(existingItems) {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const count = (existingItems || []).length + 1
  return `RTN-${year}${month}-${String(count).padStart(4, '0')}`
}

export const RETURN_TIPE = {
  KE_SUPPLIER: 'KE_SUPPLIER',
  DARI_CUSTOMER: 'DARI_CUSTOMER'
}

export const RETURN_TIPE_LABELS = {
  [RETURN_TIPE.KE_SUPPLIER]: 'Retur ke Supplier',
  [RETURN_TIPE.DARI_CUSTOMER]: 'Retur dari Pelanggan'
}

export const RETURN_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SELESAI: 'SELESAI'
}

export const RETURN_STATUS_LABELS = {
  [RETURN_STATUS.PENDING]: 'Menunggu',
  [RETURN_STATUS.APPROVED]: 'Disetujui',
  [RETURN_STATUS.REJECTED]: 'Ditolak',
  [RETURN_STATUS.SELESAI]: 'Selesai'
}

export const RETURN_STATUS_COLORS = {
  [RETURN_STATUS.PENDING]: 'bg-yellow-100 text-yellow-700',
  [RETURN_STATUS.APPROVED]: 'bg-blue-100 text-blue-700',
  [RETURN_STATUS.REJECTED]: 'bg-red-100 text-red-700',
  [RETURN_STATUS.SELESAI]: 'bg-green-100 text-green-700'
}

export const ALASAN_RETUR = {
  RUSAK: 'Barang Rusak',
  SALAH_KIRIM: 'Salah Kirim',
  TIDAK_SESUAI: 'Tidak Sesuai Spesifikasi',
  KADALUARSA: 'Kadaluarsa / Expired',
  BATAL_BELI: 'Pembelian Dibatalkan'
}

export const returnService = {
  async getAll() {
    const [returns, spareparts, suppliers, customers, workOrders] = await Promise.all([
      db.getAll(db.keys.RETURNS),
      db.getAll(db.keys.SPAREPARTS),
      db.getAll(db.keys.SUPPLIERS),
      db.getAll(db.keys.CUSTOMERS),
      db.getAll(db.keys.WORK_ORDERS)
    ])

    const sparepartMap = new Map(spareparts.map(sp => [Number(sp.id), sp]))
    const supplierMap = new Map(suppliers.map(s => [Number(s.id), s]))
    const customerMap = new Map(customers.map(c => [Number(c.id), c]))
    const woMap = new Map(workOrders.map(wo => [Number(wo.id), wo]))

    return returns.map(r => ({
      ...r,
      sparepart: sparepartMap.get(Number(r.sparepartId)) || null,
      supplier: supplierMap.get(Number(r.supplierId)) || null,
      customer: customerMap.get(Number(r.customerId)) || null,
      workOrder: woMap.get(Number(r.workOrderId)) || null
    })).sort((a, b) => new Date(b.tanggalRetur) - new Date(a.tanggalRetur))
  },

  async getById(id) {
    const all = await this.getAll()
    return all.find(r => Number(r.id) === Number(id)) || null
  },

  // Buat retur baru (status awal PENDING, stok belum berubah)
  async create(data) {
    if (!data.sparepartId) throw new Error('Sparepart wajib dipilih')
    if (!data.jumlah || Number(data.jumlah) <= 0) throw new Error('Jumlah retur harus lebih dari 0')

    const sparepart = await db.getById(db.keys.SPAREPARTS, data.sparepartId)
    if (!sparepart) throw new Error('Sparepart tidak ditemukan')

    // Retur ke supplier hanya bisa jika stok masih ada di gudang
    if (data.tipe === RETURN_TIPE.KE_SUPPLIER && Number(sparepart.stok || 0) < Number(data.jumlah)) {
      throw new Error(`Stok tidak mencukupi untuk diretur. Stok tersedia: ${sparepart.stok}`)
    }

    const existing = await db.getAll(db.keys.RETURNS)
    const nomorRetur = data.nomorRetur || generateNomorRetur(existing)

    return db.insert(db.keys.RETURNS, {
      nomorRetur,
      tipe: data.tipe || RETURN_TIPE.KE_SUPPLIER,
      status: RETURN_STATUS.PENDING,
      sparepartId: data.sparepartId,
      supplierId: data.supplierId || (data.tipe === RETURN_TIPE.KE_SUPPLIER ? sparepart.supplierId : null),
      customerId: data.customerId || null,
      workOrderId: data.workOrderId || null,
      transactionId: data.transactionId || null,
      jumlah: Number(data.jumlah),
      hargaSatuan: Number(data.hargaSatuan ?? sparepart.hargaBeli ?? 0),
      total: Number(data.jumlah) * Number(data.hargaSatuan ?? sparepart.hargaBeli ?? 0),
      alasan: data.alasan || '',
      catatan: data.catatan || '',
      tanggalRetur: data.tanggalRetur || new Date().toISOString(),
      createdAt: new Date().toISOString()
    })
  },

  // Setujui retur & proses penyesuaian stok
  // KE_SUPPLIER   -> stok dikurangi (barang keluar ke supplier)
  // DARI_CUSTOMER -> stok ditambah (barang masuk kembali)
  async approve(id) {
    const retur = await db.getById(db.keys.RETURNS, id)
    if (!retur) throw new Error('Data retur tidak ditemukan')
    if (retur.status !== RETURN_STATUS.PENDING) {
      throw new Error('Hanya retur dengan status Menunggu yang dapat disetujui')
    }

    const sparepart = await db.getById(db.keys.SPAREPARTS, retur.sparepartId)
    if (!sparepart) throw new Error('Sparepart tidak ditemukan')

    if (retur.tipe === RETURN_TIPE.KE_SUPPLIER) {
      if (Number(sparepart.stok || 0) < Number(retur.jumlah)) {
        throw new Error(`Stok tidak mencukupi. Stok tersedia: ${sparepart.stok}`)
      }
      await transactionService.barangKeluar({
        sparepartId: retur.sparepartId,
        jumlah: retur.jumlah,
        hargaSatuan: retur.hargaSatuan,
        keterangan: `Retur ke supplier ${retur.nomorRetur}`
      })
    } else {
      await transactionService.barangMasuk({
        sparepartId: retur.sparepartId,
        jumlah: retur.jumlah,
        hargaSatuan: retur.hargaSatuan,
        keterangan: `Retur dari pelanggan ${retur.nomorRetur}`
      })
    }

    return this.update(id, { status: RETURN_STATUS.APPROVED })
  },

  async reject(id, catatan = '') {
    const retur = await db.getById(db.keys.RETURNS, id)
    if (!retur) throw new Error('Data retur tidak ditemukan')
    if (retur.status !== RETURN_STATUS.PENDING) {
      throw new Error('Hanya retur dengan status Menunggu yang dapat ditolak')
    }
    return this.update(id, { status: RETURN_STATUS.REJECTED, catatan: catatan || retur.catatan })
  },

  // Tandai selesai (barang sudah dikirim/diterima fisik)
  async complete(id) {
    const retur = await db.getById(db.keys.RETURNS, id)
    if (!retur) throw new Error('Data retur tidak ditemukan')
    if (retur.status !== RETURN_STATUS.APPROVED) {
      throw new Error('Hanya retur yang sudah disetujui yang dapat diselesaikan')
    }
    return this.update(id, {
      status: RETURN_STATUS.SELESAI,
      tanggalSelesai: new Date().toISOString()
    })
  },

  async update(id, data) {
    if (data.jumlah !== undefined && data.hargaSatuan !== undefined) {
      data.total = Number(data.jumlah) * Number(data.hargaSatuan)
    }
    await db.update(db.keys.RETURNS, id, data)
    return this.getById(id)
  },

  async delete(id) {
    const retur = await db.getById(db.keys.RETURNS, id)
    if (!retur) throw new Error('Data retur tidak ditemukan')
    if (retur.status === RETURN_STATUS.APPROVED && !retur.tanggalSelesai) {
      // Retur disetujui tapi belum selesai fisik -> stok sudah bergerak, tolak penghapusan
      throw new Error('Retur yang sudah disetujui harus diselesaikan terlebih dahulu sebelum dihapus')
    }
    await db.remove(db.keys.RETURNS, id)
    return true
  },

  // ---- Metode murni sinkron ----
  search(query, items = []) {
    const q = (query || '').toLowerCase()
    if (!q) return items
    return items.filter(r =>
      (r.nomorRetur || '').toLowerCase().includes(q) ||
      ((r.sparepart && r.sparepart.nama) || '').toLowerCase().includes(q) ||
      ((r.sparepart && r.sparepart.kode) || '').toLowerCase().includes(q) ||
      ((r.supplier && r.supplier.nama) || '').toLowerCase().includes(q) ||
      ((r.customer && r.customer.nama) || '').toLowerCase().includes(q) ||
      (r.alasan || '').toLowerCase().includes(q)
    )
  },

  filterByTipe(tipe, items = []) {
    if (!tipe || tipe === 'ALL') return items
    return items.filter(r => r.tipe === tipe)
  },

  filterByStatus(status, items = []) {
    if (!status || status === 'ALL') return items
    return items.filter(r => r.status === status)
  },

  getStatusStats(items = []) {
    const stats = {}
    Object.values(RETURN_STATUS).forEach(s => {
      stats[s] = items.filter(r => r.status === s).length
    })
    return stats
  },

  exportToCSV(items = []) {
    const headers = ['No. Retur', 'Tanggal', 'Tipe', 'Status', 'Sparepart', 'Supplier/Pelanggan', 'Jumlah', 'Harga Satuan', 'Total', 'Alasan']
    const rows = items.map(r => [
      r.nomorRetur || '',
      r.tanggalRetur ? new Date(r.tanggalRetur).toLocaleDateString('id-ID') : '',
      RETURN_TIPE_LABELS[r.tipe] || r.tipe,
      RETURN_STATUS_LABELS[r.status] || r.status,
      r.sparepart?.nama || '',
      r.tipe === RETURN_TIPE.KE_SUPPLIER ? (r.supplier?.nama || '') : (r.customer?.nama || ''),
      r.jumlah,
      formatRupiah(r.hargaSatuan || 0),
      formatRupiah(r.total || 0),
      r.alasan || ''
    ])
    return { headers, rows, filename: `retur_${new Date().toISOString().slice(0, 10)}.csv` }
  }
}