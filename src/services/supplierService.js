import { db } from './database'

export const supplierService = {
  // Gunakan Supabase sebagai database utama
  async getAll() {
    return db.getAll('suppliers')
  },

  async getById(id) {
    return db.getById('suppliers', id) || null
  },

  async create(data) {
    return db.insert('suppliers', data)
  },

  async update(id, data) {
    return db.update('suppliers', id, data)
  },

  async delete(id) {
    await db.remove('suppliers', id)
    return true
  },

  // ---- Metode murni sinkron ----
  search(query, items = []) {
    const q = (query || '').toLowerCase()
    if (!q) return items

    return items.filter(s =>
      (s.nama || '').toLowerCase().includes(q) ||
      (s.kode || '').toLowerCase().includes(q) ||
      (s.kontak || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    )
  },

  getStats(items = [], spareparts = []) {
    return items.map(sup => ({
      ...sup,
      totalSparepart: spareparts.filter(sp => Number(sp.supplierId) === Number(sup.id)).length
    }))
  },

  exportToCSV(items = []) {
    const headers = ['Kode', 'Nama', 'Kontak', 'Telepon', 'Email', 'Alamat']
    const rows = items.map(s => [
      s.kode,
      s.nama,
      s.kontak || '',
      s.telepon,
      s.email || '',
      s.alamat || ''
    ])
    return { headers, rows, filename: `suppliers_${new Date().toISOString().slice(0, 10)}.csv` }
  }
}