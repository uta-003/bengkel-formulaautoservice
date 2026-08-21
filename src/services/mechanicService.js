import { db } from './database'

// Helper untuk generate kode mekanik
function generateKodeMechanic(existingItems) {
  const year = new Date().getFullYear()
  const count = (existingItems || []).length + 1
  return `MEK-${year}-${String(count).padStart(3, '0')}`
}

export const mechanicService = {
  async getAll() {
    return db.getAll(db.keys.MECHANICS)
  },

  async getById(id) {
    return db.getById(db.keys.MECHANICS, id) || null
  },

  async create(data) {
    const existing = await db.getAll(db.keys.MECHANICS)
    const kode = data.kode || generateKodeMechanic(existing)
    return db.insert(db.keys.MECHANICS, { ...data, kode })
  },

  async update(id, data) {
    return db.update(db.keys.MECHANICS, id, data)
  },

  async delete(id) {
    // Cek apakah ada work order yang merujuk ke mekanik ini
    const workOrders = await db.getAll(db.keys.WORK_ORDERS)
    const hasWO = workOrders.some(wo => Number(wo.mechanicId) === Number(id))
    if (hasWO) {
      throw new Error('Tidak dapat menghapus mekanik yang memiliki work order. Update work order terlebih dahulu.')
    }
    await db.remove(db.keys.MECHANICS, id)
    return true
  },

  // ---- Metode murni sinkron ----
  search(query, items = []) {
    const q = (query || '').toLowerCase()
    if (!q) return items
    return items.filter(m =>
      (m.nama || '').toLowerCase().includes(q) ||
      (m.kode || '').toLowerCase().includes(q) ||
      (m.keahlian || '').toLowerCase().includes(q) ||
      (m.telepon || '').toLowerCase().includes(q)
    )
  },

  getActive(items = []) {
    return items.filter(m => m.status === 'AKTIF')
  },

  exportToCSV(items = []) {
    const headers = ['Kode', 'Nama', 'Keahlian', 'Telepon', 'Email', 'Tarif/Jam', 'Status']
    const rows = items.map(m => [
      m.kode || '',
      m.nama || '',
      m.keahlian || '',
      m.telepon || '',
      m.email || '',
      m.tarifPerJam || 0,
      m.status || ''
    ])
    return { headers, rows, filename: `mechanics_${new Date().toISOString().slice(0, 10)}.csv` }
  }
}
