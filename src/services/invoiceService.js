import { db } from './database'
import { formatRupiah } from '../utils/format'

// Helper untuk generate nomor invoice
function generateNomorInvoice(existingItems) {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const count = (existingItems || []).length + 1
  return `INV-${year}${month}${day}-${String(count).padStart(4, '0')}`
}

export const INVOICE_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  PARTIAL: 'PARTIAL'
}

export const INVOICE_STATUS_LABELS = {
  [INVOICE_STATUS.PENDING]: 'Belum Dibayar',
  [INVOICE_STATUS.PAID]: 'Lunas',
  [INVOICE_STATUS.CANCELLED]: 'Dibatalkan',
  [INVOICE_STATUS.PARTIAL]: 'Sebagian'
}

export const INVOICE_STATUS_COLORS = {
  [INVOICE_STATUS.PENDING]: 'bg-yellow-100 text-yellow-700',
  [INVOICE_STATUS.PAID]: 'bg-green-100 text-green-700',
  [INVOICE_STATUS.CANCELLED]: 'bg-red-100 text-red-700',
  [INVOICE_STATUS.PARTIAL]: 'bg-blue-100 text-blue-700'
}

export const METODE_BAYAR = {
  TUNAI: 'TUNAI',
  TRANSFER: 'TRANSFER',
  KARTU: 'KARTU',
  E_WALLET: 'E_WALLET',
  KREDIT: 'KREDIT'
}

export const METODE_BAYAR_LABELS = {
  [METODE_BAYAR.TUNAI]: 'Tunai',
  [METODE_BAYAR.TRANSFER]: 'Transfer',
  [METODE_BAYAR.KARTU]: 'Kartu',
  [METODE_BAYAR.E_WALLET]: 'E-Wallet',
  [METODE_BAYAR.KREDIT]: 'Kredit'
}

export const invoiceService = {
  async getAll() {
    const [invoices, customers, vehicles, workOrders] = await Promise.all([
      db.getAll(db.keys.INVOICES),
      db.getAll(db.keys.CUSTOMERS),
      db.getAll(db.keys.VEHICLES),
      db.getAll(db.keys.WORK_ORDERS)
    ])

    const customerMap = new Map(customers.map(c => [Number(c.id), c]))
    const vehicleMap = new Map(vehicles.map(v => [Number(v.id), v]))
    const workOrderMap = new Map(workOrders.map(wo => [Number(wo.id), wo]))

    return invoices.map(inv => ({
      ...inv,
      customer: customerMap.get(Number(inv.customerId)) || null,
      vehicle: vehicleMap.get(Number(inv.vehicleId)) || null,
      workOrder: workOrderMap.get(Number(inv.workOrderId)) || null
    })).sort((a, b) => new Date(b.tanggalInvoice) - new Date(a.tanggalInvoice))
  },

  async getById(id) {
    const invoice = await db.getById(db.keys.INVOICES, id)
    if (!invoice) return null

    const [customer, vehicle, workOrder] = await Promise.all([
      db.getById(db.keys.CUSTOMERS, invoice.customerId),
      db.getById(db.keys.VEHICLES, invoice.vehicleId),
      db.getById(db.keys.WORK_ORDERS, invoice.workOrderId)
    ])

    return {
      ...invoice,
      customer: customer || null,
      vehicle: vehicle || null,
      workOrder: workOrder || null
    }
  },

  // Generate invoice from work order
  async generateFromWorkOrder(workOrderId) {
    const wo = await db.getById(db.keys.WORK_ORDERS, workOrderId)
    if (!wo) throw new Error('Work order tidak ditemukan')

    const existing = await db.getAll(db.keys.INVOICES)
    const nomorInvoice = generateNomorInvoice(existing)

    const invoice = await db.insert(db.keys.INVOICES, {
      nomorInvoice,
      workOrderId: wo.id,
      customerId: wo.customerId,
      vehicleId: wo.vehicleId,
      totalLabor: wo.totalLabor || 0,
      totalParts: wo.totalParts || 0,
      totalBiaya: wo.totalBiaya || 0,
      diskon: 0,
      pajak: 0,
      grandTotal: wo.totalBiaya || 0,
      jumlahDibayar: 0,
      sisaBayar: Number(wo.totalBiaya || 0),
      status: INVOICE_STATUS.PENDING,
      tanggalInvoice: new Date().toISOString(),
      metodeBayar: null,
      keterangan: '',
      createdAt: new Date().toISOString()
    })

    return this.getById(invoice.id)
  },

  async create(data) {
    const existing = await db.getAll(db.keys.INVOICES)
    const nomorInvoice = data.nomorInvoice || generateNomorInvoice(existing)

    // Hitung grand total
    const totalBiaya = Number(data.totalBiaya || 0)
    const diskon = Number(data.diskon || 0)
    const pajak = Number(data.pajak || 0)
    const grandTotal = totalBiaya - diskon + pajak

    const dibayarAwal = Number(data.jumlahDibayar || 0)
    return db.insert(db.keys.INVOICES, {
      ...data,
      nomorInvoice,
      grandTotal,
      jumlahDibayar: dibayarAwal,
      sisaBayar: Math.max(grandTotal - dibayarAwal, 0),
      status: data.status || (dibayarAwal >= grandTotal && grandTotal > 0 ? INVOICE_STATUS.PAID : dibayarAwal > 0 ? INVOICE_STATUS.PARTIAL : INVOICE_STATUS.PENDING),
      tanggalInvoice: data.tanggalInvoice || new Date().toISOString(),
      createdAt: new Date().toISOString()
    })
  },

  // Ambil riwayat pembayaran sebuah invoice
  async getPayments(invoiceId) {
    const payments = await db.getAll(db.keys.INVOICE_PAYMENTS)
    return payments
      .filter(p => Number(p.invoiceId) === Number(invoiceId))
      .sort((a, b) => new Date(b.tanggalBayar) - new Date(a.tanggalBayar))
  },

  // Catat pembayaran (parsial atau penuh)
  // Status invoice otomatis menjadi PARTIAL / PAID sesuai akumulasi pembayaran
  async addPayment(invoiceId, { jumlah, metodeBayar = METODE_BAYAR.TUNAI, referensi = '', keterangan = '', tanggalBayar = null }) {
    const invoice = await db.getById(db.keys.INVOICES, invoiceId)
    if (!invoice) throw new Error('Invoice tidak ditemukan')
    if (invoice.status === INVOICE_STATUS.CANCELLED) {
      throw new Error('Invoice sudah dibatalkan, tidak dapat menerima pembayaran')
    }

    const grandTotal = Number(invoice.grandTotal || 0)
    const dibayarSebelumnya = Number(invoice.jumlahDibayar || 0)
    const sisaSebelumnya = Math.max(grandTotal - dibayarSebelumnya, 0)
    const nominal = Number(jumlah || 0)

    if (nominal <= 0) throw new Error('Jumlah pembayaran harus lebih dari 0')
    if (nominal > sisaSebelumnya) {
      throw new Error(`Pembayaran melebihi sisa tagihan. Sisa tagihan: ${formatRupiah(sisaSebelumnya)}`)
    }

    // Simpan riwayat pembayaran ke tabel invoice_payments
    await db.insert(db.keys.INVOICE_PAYMENTS, {
      invoiceId,
      jumlah: nominal,
      metodeBayar,
      referensi,
      keterangan,
      tanggalBayar: tanggalBayar || new Date().toISOString(),
      createdAt: new Date().toISOString()
    })

    const totalDibayar = dibayarSebelumnya + nominal
    const sisaBayar = Math.max(grandTotal - totalDibayar, 0)
    const lunas = sisaBayar <= 0

    return this.update(invoiceId, {
      jumlahDibayar: totalDibayar,
      sisaBayar,
      status: lunas ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIAL,
      metodeBayar: metodeBayar,
      tanggalBayar: lunas ? (tanggalBayar || new Date().toISOString()) : invoice.tanggalBayar
    })
  },

  async update(id, data) {
    // Hitung ulang grand total jika ada perubahan komponen biaya
    if (data.totalBiaya !== undefined || data.diskon !== undefined || data.pajak !== undefined) {
      const existing = await db.getById(db.keys.INVOICES, id)
      const totalBiaya = data.totalBiaya !== undefined ? Number(data.totalBiaya || 0) : Number(existing.totalBiaya || 0)
      const diskon = data.diskon !== undefined ? Number(data.diskon || 0) : Number(existing.diskon || 0)
      const pajak = data.pajak !== undefined ? Number(data.pajak || 0) : Number(existing.pajak || 0)
      const grandTotalBaru = totalBiaya - diskon + pajak
      data.grandTotal = grandTotalBaru

      // Hitung ulang sisa bayar & status agar selalu konsisten dengan grand total baru
      const dibayar = Number(existing.jumlahDibayar || 0)
      const sisaBaru = Math.max(grandTotalBaru - dibayar, 0)
      data.sisaBayar = sisaBaru
      // Status hanya dihitung ulang otomatis jika pemanggil tidak mengirim status eksplisit
      if (data.status === undefined) {
        if (existing.status === INVOICE_STATUS.CANCELLED) {
          data.status = existing.status
        } else if (sisaBaru <= 0 && grandTotalBaru > 0) {
          data.status = INVOICE_STATUS.PAID
        } else if (dibayar > 0) {
          data.status = INVOICE_STATUS.PARTIAL
        } else {
          data.status = INVOICE_STATUS.PENDING
        }
      }
    }
    return db.update(db.keys.INVOICES, id, data)
  },

  async markAsPaid(id, metodeBayar = METODE_BAYAR.TUNAI) {
    const invoice = await db.getById(db.keys.INVOICES, id)
    if (!invoice) throw new Error('Invoice tidak ditemukan')

    const grandTotal = Number(invoice.grandTotal || 0)
    const dibayarSebelumnya = Number(invoice.jumlahDibayar || 0)
    const sisa = Math.max(grandTotal - dibayarSebelumnya, 0)

    // Catat sisa pembayaran sebagai satu transaksi pelunasan
    if (sisa > 0) {
      await db.insert(db.keys.INVOICE_PAYMENTS, {
        invoiceId: id,
        jumlah: sisa,
        metodeBayar,
        referensi: '',
        keterangan: 'Pelunasan',
        tanggalBayar: new Date().toISOString(),
        createdAt: new Date().toISOString()
      })
    }

    return this.update(id, {
      status: INVOICE_STATUS.PAID,
      metodeBayar,
      jumlahDibayar: grandTotal,
      sisaBayar: 0,
      tanggalBayar: new Date().toISOString()
    })
  },

  async cancel(id) {
    return this.update(id, { status: INVOICE_STATUS.CANCELLED })
  },

  async delete(id) {
    await db.remove(db.keys.INVOICES, id)
    return true
  },

  // ---- Metode murni sinkron ----
  search(query, items = []) {
    const q = (query || '').toLowerCase()
    if (!q) return items
    return items.filter(inv =>
      (inv.nomorInvoice || '').toLowerCase().includes(q) ||
      ((inv.customer && inv.customer.nama) || '').toLowerCase().includes(q) ||
      ((inv.vehicle && inv.vehicle.platNomor) || '').toLowerCase().includes(q) ||
      ((inv.workOrder && inv.workOrder.nomorWo) || '').toLowerCase().includes(q)
    )
  },

  filterByStatus(status, items = []) {
    if (!status || status === 'ALL') return items
    return items.filter(inv => inv.status === status)
  },

  getStatusStats(items = []) {
    const stats = {}
    Object.values(INVOICE_STATUS).forEach(s => {
      stats[s] = items.filter(inv => inv.status === s).length
    })
    return stats
  },

  // Get invoices for a customer
  getByCustomer(customerId, items = []) {
    return items.filter(inv => Number(inv.customerId) === Number(customerId))
  },

  // Get unpaid invoices
  getUnpaid(items = []) {
    return items.filter(inv => inv.status === INVOICE_STATUS.PENDING || inv.status === INVOICE_STATUS.PARTIAL)
  },

  // Get total revenue
  getTotalRevenue(items = []) {
    return items
      .filter(inv => inv.status === INVOICE_STATUS.PAID)
      .reduce((sum, inv) => sum + Number(inv.grandTotal || 0), 0)
  },

  // Get total outstanding (belum dibayar) berdasarkan sisa bayar aktual
  getTotalOutstanding(items = []) {
    return items
      .filter(inv => inv.status === INVOICE_STATUS.PENDING || inv.status === INVOICE_STATUS.PARTIAL)
      .reduce((sum, inv) => sum + Number(inv.sisaBayar ?? inv.grandTotal ?? 0), 0)
  },

  exportToCSV(items = []) {
    const headers = ['No. Invoice', 'Tanggal', 'Pelanggan', 'Kendaraan', 'No. WO', 'Total', 'Diskon', 'Pajak', 'Grand Total', 'Dibayar', 'Sisa', 'Status', 'Metode Bayar']
    const rows = items.map(inv => [
      inv.nomorInvoice || '',
      inv.tanggalInvoice ? new Date(inv.tanggalInvoice).toLocaleDateString('id-ID') : '',
      inv.customer?.nama || '',
      inv.vehicle ? `${inv.vehicle.merk || ''} ${inv.vehicle.tipe || ''}` : '',
      inv.workOrder?.nomorWo || '',
      formatRupiah(inv.totalBiaya || 0),
      formatRupiah(inv.diskon || 0),
      formatRupiah(inv.pajak || 0),
      formatRupiah(inv.grandTotal || 0),
      formatRupiah(inv.jumlahDibayar || 0),
      formatRupiah(inv.sisaBayar ?? Math.max((inv.grandTotal || 0) - (inv.jumlahDibayar || 0), 0)),
      INVOICE_STATUS_LABELS[inv.status] || inv.status,
      inv.metodeBayar ? METODE_BAYAR_LABELS[inv.metodeBayar] || inv.metodeBayar : ''
    ])
    return { headers, rows, filename: `invoices_${new Date().toISOString().slice(0, 10)}.csv` }
  }
}
