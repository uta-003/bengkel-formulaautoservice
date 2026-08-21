import { db } from './database'

// Helper untuk generate kode customer
function generateKodeCustomer(existingItems) {
  const year = new Date().getFullYear()
  const count = (existingItems || []).length + 1
  return `CUST-${year}-${String(count).padStart(4, '0')}`
}

export const customerService = {
  async getAll() {
    return db.getAll(db.keys.CUSTOMERS)
  },

  async getById(id) {
    return db.getById(db.keys.CUSTOMERS, id) || null
  },

  async create(data) {
    const existing = await db.getAll(db.keys.CUSTOMERS)
    const kode = data.kode || generateKodeCustomer(existing)
    return db.insert(db.keys.CUSTOMERS, { ...data, kode })
  },

  async update(id, data) {
    return db.update(db.keys.CUSTOMERS, id, data)
  },

  async delete(id) {
    // Cek apakah ada kendaraan yang merujuk ke customer ini
    const vehicles = await db.getAll(db.keys.VEHICLES)
    const hasVehicles = vehicles.some(v => Number(v.customerId) === Number(id))
    if (hasVehicles) {
      throw new Error('Tidak dapat menghapus customer yang memiliki kendaraan. Hapus kendaraan terlebih dahulu.')
    }
    // Cek apakah ada work order yang merujuk ke customer ini
    const workOrders = await db.getAll(db.keys.WORK_ORDERS)
    const hasWO = workOrders.some(wo => Number(wo.customerId) === Number(id))
    if (hasWO) {
      throw new Error('Tidak dapat menghapus customer yang memiliki work order. Hapus work order terlebih dahulu.')
    }
    await db.remove(db.keys.CUSTOMERS, id)
    return true
  },

  // ---- Metode murni sinkron ----
  search(query, items = []) {
    const q = (query || '').toLowerCase()
    if (!q) return items
    return items.filter(c =>
      (c.nama || '').toLowerCase().includes(q) ||
      (c.kode || '').toLowerCase().includes(q) ||
      (c.telepon || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    )
  },

  getStats(items = [], vehicles = []) {
    return items.map(c => ({
      ...c,
      totalVehicle: vehicles.filter(v => Number(v.customerId) === Number(c.id)).length
    }))
  },

  exportToCSV(items = []) {
    const headers = ['Kode', 'Nama', 'Telepon', 'Email', 'Alamat']
    const rows = items.map(c => [
      c.kode || '',
      c.nama || '',
      c.telepon || '',
      c.email || '',
      c.alamat || ''
    ])
    return { headers, rows, filename: `customers_${new Date().toISOString().slice(0, 10)}.csv` }
  }
}
