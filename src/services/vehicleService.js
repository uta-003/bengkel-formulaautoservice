import { db } from './database'

export const vehicleService = {
  async getAll() {
    const [vehicles, customers] = await Promise.all([
      db.getAll(db.keys.VEHICLES),
      db.getAll(db.keys.CUSTOMERS)
    ])
    const customerMap = new Map(customers.map(c => [Number(c.id), c]))
    return vehicles.map(v => ({
      ...v,
      customer: customerMap.get(Number(v.customerId)) || null
    }))
  },

  async getById(id) {
    const vehicle = await db.getById(db.keys.VEHICLES, id)
    if (!vehicle) return null
    const customer = await db.getById(db.keys.CUSTOMERS, vehicle.customerId)
    return { ...vehicle, customer: customer || null }
  },

  async getByCustomerId(customerId) {
    const vehicles = await db.getAll(db.keys.VEHICLES)
    return vehicles.filter(v => Number(v.customerId) === Number(customerId))
  },

  async create(data) {
    return db.insert(db.keys.VEHICLES, data)
  },

  async update(id, data) {
    return db.update(db.keys.VEHICLES, id, data)
  },

  async delete(id) {
    // Cek apakah ada work order yang merujuk ke vehicle ini
    const workOrders = await db.getAll(db.keys.WORK_ORDERS)
    const hasWO = workOrders.some(wo => Number(wo.vehicleId) === Number(id))
    if (hasWO) {
      throw new Error('Tidak dapat menghapus kendaraan yang memiliki work order. Hapus work order terlebih dahulu.')
    }
    // Hapus QR code terkait
    const qrCodes = await db.getAll(db.keys.VEHICLE_QR_CODES)
    for (const qr of qrCodes) {
      if (Number(qr.vehicleId) === Number(id)) {
        await db.remove(db.keys.VEHICLE_QR_CODES, qr.id)
      }
    }
    await db.remove(db.keys.VEHICLES, id)
    return true
  },

  // ---- Metode murni sinkron ----
  search(query, items = []) {
    const q = (query || '').toLowerCase()
    if (!q) return items
    return items.filter(v =>
      (v.platNomor || '').toLowerCase().includes(q) ||
      (v.merk || '').toLowerCase().includes(q) ||
      (v.tipe || '').toLowerCase().includes(q) ||
      (v.tahun || '').toLowerCase().includes(q) ||
      ((v.customer && v.customer.nama) || '').toLowerCase().includes(q)
    )
  },

  exportToCSV(items = []) {
    const headers = ['Plat Nomor', 'Merk', 'Tipe', 'Tahun', 'Warna', 'KM Terakhir', 'Pelanggan']
    const rows = items.map(v => [
      v.platNomor || '',
      v.merk || '',
      v.tipe || '',
      v.tahun || '',
      v.warna || '',
      v.kmTerakhir || 0,
      v.customer?.nama || ''
    ])
    return { headers, rows, filename: `vehicles_${new Date().toISOString().slice(0, 10)}.csv` }
  }
}
