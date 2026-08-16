import { apiService } from './apiService'
import { db } from './database'

export const supplierService = {
  async getAll() {
    try {
      const response = await apiService.getSuppliers()
      return response?.data || []
    } catch (error) {
      // Fallback ke localStorage ketika API tidak tersedia
      console.warn('API tidak tersedia, menggunakan data lokal:', error.message)
      return db.getAll('suppliers')
    }
  },

  async getById(id) {
    try {
      const response = await apiService.getSupplierById(id)
      if (response?.data) return response.data
      throw new Error('Data kosong')
    } catch (error) {
      console.warn('API getById gagal, fallback lokal:', error.message)
      return db.getById('suppliers', id) || null
    }
  },

  async create(data) {
    try {
      const response = await apiService.createSupplier(data)
      return response?.data || null
    } catch (error) {
      console.warn('API create gagal, fallback lokal:', error.message)
      return db.insert('suppliers', data)
    }
  },

  async update(id, data) {
    try {
      const response = await apiService.updateSupplier(id, data)
      if (response?.data) return response.data
      throw new Error('Data kosong')
    } catch (error) {
      console.warn('API update gagal, fallback lokal:', error.message)
      return db.update('suppliers', id, data)
    }
  },

  async delete(id) {
    try {
      await apiService.deleteSupplier(id)
    } catch (error) {
      console.warn('API delete gagal, fallback lokal:', error.message)
      db.remove('suppliers', id)
    }
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