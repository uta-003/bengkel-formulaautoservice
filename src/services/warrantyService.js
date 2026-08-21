import { db } from './database'

// Helper untuk generate kode warranty
function generateKodeWarranty(existingItems) {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const count = (existingItems || []).length + 1
  return `GW-${year}${month}-${String(count).padStart(4, '0')}`
}

export const WARRANTY_JENIS = {
  SERVICE: 'SERVICE',
  SPAREPART: 'SPAREPART'
}

export const WARRANTY_JENIS_LABELS = {
  [WARRANTY_JENIS.SERVICE]: 'Service',
  [WARRANTY_JENIS.SPAREPART]: 'Sparepart'
}

export const WARRANTY_STATUS = {
  AKTIF: 'AKTIF',
  EXPIRED: 'EXPIRED',
  CLAIMED: 'CLAIMED',
  CANCELLED: 'CANCELLED'
}

export const WARRANTY_STATUS_LABELS = {
  [WARRANTY_STATUS.AKTIF]: 'Aktif',
  [WARRANTY_STATUS.EXPIRED]: 'Kadaluarsa',
  [WARRANTY_STATUS.CLAIMED]: 'Diklaim',
  [WARRANTY_STATUS.CANCELLED]: 'Dibatalkan'
}

export const WARRANTY_STATUS_COLORS = {
  [WARRANTY_STATUS.AKTIF]: 'bg-green-100 text-green-700',
  [WARRANTY_STATUS.EXPIRED]: 'bg-gray-100 text-gray-700',
  [WARRANTY_STATUS.CLAIMED]: 'bg-blue-100 text-blue-700',
  [WARRANTY_STATUS.CANCELLED]: 'bg-red-100 text-red-700'
}

export const warrantyService = {
  async getAll() {
    const [warranties, customers, vehicles, workOrders, spareparts] = await Promise.all([
      db.getAll(db.keys.WARRANTIES),
      db.getAll(db.keys.CUSTOMERS),
      db.getAll(db.keys.VEHICLES),
      db.getAll(db.keys.WORK_ORDERS),
      db.getAll(db.keys.SPAREPARTS)
    ])

    const customerMap = new Map(customers.map(c => [Number(c.id), c]))
    const vehicleMap = new Map(vehicles.map(v => [Number(v.id), v]))
    const workOrderMap = new Map(workOrders.map(wo => [Number(wo.id), wo]))
    const sparepartMap = new Map(spareparts.map(sp => [Number(sp.id), sp]))

    return warranties.map(w => ({
      ...w,
      customer: customerMap.get(Number(w.customerId)) || null,
      vehicle: vehicleMap.get(Number(w.vehicleId)) || null,
      workOrder: workOrderMap.get(Number(w.workOrderId)) || null,
      sparepart: sparepartMap.get(Number(w.sparepartId)) || null
    })).sort((a, b) => new Date(b.tanggalMulai) - new Date(a.tanggalMulai))
  },

  async getById(id) {
    const warranty = await db.getById(db.keys.WARRANTIES, id)
    if (!warranty) return null

    const [customer, vehicle, workOrder, sparepart] = await Promise.all([
      db.getById(db.keys.CUSTOMERS, warranty.customerId),
      db.getById(db.keys.VEHICLES, warranty.vehicleId),
      db.getById(db.keys.WORK_ORDERS, warranty.workOrderId),
      db.getById(db.keys.SPAREPARTS, warranty.sparepartId)
    ])

    return {
      ...warranty,
      customer: customer || null,
      vehicle: vehicle || null,
      workOrder: workOrder || null,
      sparepart: sparepart || null
    }
  },

  async create(data) {
    const existing = await db.getAll(db.keys.WARRANTIES)
    const kode = data.kode || generateKodeWarranty(existing)

    // Cek apakah garansi sudah kadaluarsa
    const now = new Date()
    const endDate = new Date(data.tanggalBerakhir)
    let status = data.status || WARRANTY_STATUS.AKTIF
    if (endDate < now) {
      status = WARRANTY_STATUS.EXPIRED
    }

    return db.insert(db.keys.WARRANTIES, {
      ...data,
      kode,
      status,
      tanggalMulai: data.tanggalMulai || new Date().toISOString(),
      createdAt: new Date().toISOString()
    })
  },

  async update(id, data) {
    // Cek status expired jika tanggal berakhir diupdate
    if (data.tanggalBerakhir) {
      const now = new Date()
      const endDate = new Date(data.tanggalBerakhir)
      if (endDate < now && (!data.status || data.status === WARRANTY_STATUS.AKTIF)) {
        data.status = WARRANTY_STATUS.EXPIRED
      }
    }
    return db.update(db.keys.WARRANTIES, id, data)
  },

  async claim(id) {
    return this.update(id, { status: WARRANTY_STATUS.CLAIMED })
  },

  async cancel(id) {
    return this.update(id, { status: WARRANTY_STATUS.CANCELLED })
  },

  async delete(id) {
    await db.remove(db.keys.WARRANTIES, id)
    return true
  },

  // ---- Metode murni sinkron ----
  search(query, items = []) {
    const q = (query || '').toLowerCase()
    if (!q) return items
    return items.filter(w =>
      (w.kode || '').toLowerCase().includes(q) ||
      (w.judul || '').toLowerCase().includes(q) ||
      ((w.customer && w.customer.nama) || '').toLowerCase().includes(q) ||
      ((w.vehicle && w.vehicle.platNomor) || '').toLowerCase().includes(q) ||
      ((w.sparepart && w.sparepart.nama) || '').toLowerCase().includes(q)
    )
  },

  filterByStatus(status, items = []) {
    if (!status || status === 'ALL') return items
    return items.filter(w => w.status === status)
  },

  filterByJenis(jenis, items = []) {
    if (!jenis || jenis === 'ALL') return items
    return items.filter(w => w.jenis === jenis)
  },

  // Get expiring warranties (within N days)
  getExpiring(items = [], days = 30) {
    const now = new Date()
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    return items.filter(w => {
      const endDate = new Date(w.tanggalBerakhir)
      return endDate >= now && endDate <= future && w.status === WARRANTY_STATUS.AKTIF
    })
  },

  // Get expired warranties
  getExpired(items = []) {
    const now = new Date()
    return items.filter(w => {
      const endDate = new Date(w.tanggalBerakhir)
      return endDate < now && w.status === WARRANTY_STATUS.AKTIF
    })
  },

  // Get warranties for a vehicle
  getByVehicle(vehicleId, items = []) {
    return items.filter(w => Number(w.vehicleId) === Number(vehicleId))
  },

  // Get warranties for a customer
  getByCustomer(customerId, items = []) {
    return items.filter(w => Number(w.customerId) === Number(customerId))
  },

  getStatusStats(items = []) {
    const stats = {}
    Object.values(WARRANTY_STATUS).forEach(s => {
      stats[s] = items.filter(w => w.status === s).length
    })
    return stats
  },

  exportToCSV(items = []) {
    const headers = ['Kode', 'Jenis', 'Judul', 'Deskripsi', 'Pelanggan', 'Kendaraan', 'Sparepart', 'Tanggal Mulai', 'Tanggal Berakhir', 'Status']
    const rows = items.map(w => [
      w.kode || '',
      WARRANTY_JENIS_LABELS[w.jenis] || w.jenis,
      w.judul || '',
      w.deskripsi || '',
      w.customer?.nama || '',
      w.vehicle ? `${w.vehicle.merk || ''} ${w.vehicle.tipe || ''}` : '',
      w.sparepart?.nama || '',
      w.tanggalMulai ? new Date(w.tanggalMulai).toLocaleDateString('id-ID') : '',
      w.tanggalBerakhir ? new Date(w.tanggalBerakhir).toLocaleDateString('id-ID') : '',
      WARRANTY_STATUS_LABELS[w.status] || w.status
    ])
    return { headers, rows, filename: `warranties_${new Date().toISOString().slice(0, 10)}.csv` }
  }
}
