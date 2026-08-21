import { db } from './database'

// Helper untuk generate kode service package
function generateKodePackage(existingItems) {
  const year = new Date().getFullYear()
  const count = (existingItems || []).length + 1
  return `SP-${year}-${String(count).padStart(3, '0')}`
}

export const servicePackageService = {
  async getAll() {
    return db.getAll(db.keys.SERVICE_PACKAGES)
  },

  async getById(id) {
    return db.getById(db.keys.SERVICE_PACKAGES, id) || null
  },

  async create(data) {
    const existing = await db.getAll(db.keys.SERVICE_PACKAGES)
    const kode = data.kode || generateKodePackage(existing)
    return db.insert(db.keys.SERVICE_PACKAGES, { ...data, kode })
  },

  async update(id, data) {
    return db.update(db.keys.SERVICE_PACKAGES, id, data)
  },

  async delete(id) {
    // Cek apakah ada work order yang merujuk ke service package ini
    const workOrders = await db.getAll(db.keys.WORK_ORDERS)
    const hasWO = workOrders.some(wo => Number(wo.servicePackageId) === Number(id))
    if (hasWO) {
      throw new Error('Tidak dapat menghapus service package yang sudah dipakai. Update work order terlebih dahulu.')
    }
    await db.remove(db.keys.SERVICE_PACKAGES, id)
    return true
  },

  // ---- Metode murni sinkron ----
  search(query, items = []) {
    const q = (query || '').toLowerCase()
    if (!q) return items
    return items.filter(sp =>
      (sp.nama || '').toLowerCase().includes(q) ||
      (sp.kode || '').toLowerCase().includes(q) ||
      (sp.deskripsi || '').toLowerCase().includes(q) ||
      (sp.kategori || '').toLowerCase().includes(q)
    )
  },

  getByCategory(category, items = []) {
    if (!category) return items
    return items.filter(sp => sp.kategori === category)
  },

  getCategories(items = []) {
    return [...new Set(items.map(sp => sp.kategori).filter(Boolean))]
  },

  exportToCSV(items = []) {
    const headers = ['Kode', 'Nama', 'Deskripsi', 'Harga', 'Estimasi (menit)', 'Kategori']
    const rows = items.map(sp => [
      sp.kode || '',
      sp.nama || '',
      sp.deskripsi || '',
      sp.harga || 0,
      sp.estimasiDurasi || 0,
      sp.kategori || ''
    ])
    return { headers, rows, filename: `service_packages_${new Date().toISOString().slice(0, 10)}.csv` }
  }
}
