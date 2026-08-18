import { db } from './database'
import { generateUniqueBarcode, generateKodeSparepart } from '../utils/barcode'

// Helper untuk get data dari Supabase (async)
async function getSupabaseAll() {
  const items = await db.getAll(db.keys.SPAREPARTS)
  const suppliers = await db.getAll('suppliers')
  return items.map(sp => ({
    ...sp,
    supplier: suppliers.find(s => Number(s.id) === Number(sp.supplierId)) || null
  }))
}

export const sparepartService = {
  // Gunakan Supabase sebagai database utama
  async getAll() {
    return getSupabaseAll()
  },

  async getById(id) {
    const local = await db.getById('spareparts', id)
    if (!local) return null
    const suppliers = await db.getAll('suppliers')
    return { ...local, supplier: suppliers.find(s => Number(s.id) === Number(local.supplierId)) || null }
  },

  async create(data) {
    // Auto-generate kode jika kosong
    const existingSpareparts = await db.getAll(db.keys.SPAREPARTS)
    const nextId = existingSpareparts.length + 1
    const kode = data.kode || generateKodeSparepart(nextId)

    // Auto-generate barcode jika kosong
    const barcode = data.barcode || generateUniqueBarcode(nextId, existingSpareparts)

    const newItem = await db.insert('spareparts', { ...data, kode, barcode })
    return { ...newItem, supplier: null }
  },

  async update(id, data) {
    return db.update('spareparts', id, data)
  },

  async delete(id) {
    await db.remove('spareparts', id)
    return true
  },

  // ---- Metode murni sinkron (tidak butuh API) ----
  search(query, items = []) {
    const q = (query || '').toLowerCase()
    if (!q) return items

    return items.filter(sp =>
      (sp.nama || '').toLowerCase().includes(q) ||
      (sp.kode || '').toLowerCase().includes(q) ||
      (sp.merk || '').toLowerCase().includes(q) ||
      (sp.barcode || '').toLowerCase().includes(q) ||
      ((sp.supplier && sp.supplier.nama) || '').toLowerCase().includes(q)
    )
  },

  findByBarcode(barcode, items = []) {
    const list = items.length > 0 ? items : []
    return list.find(sp => (sp.barcode || '') === barcode) || null
  },

  getLowStock(items = []) {
    const list = items
    return list.filter(sp => Number(sp.stok || 0) <= Number(sp.stokMinimum || 0))
  },

  getStockValue(items = []) {
    return items.reduce((total, sp) => total + (Number(sp.stok || 0) * Number(sp.hargaBeli || 0)), 0)
  },

  getTotalValue(items = []) {
    return items.reduce((total, sp) => total + (Number(sp.stok || 0) * Number(sp.hargaJual || 0)), 0)
  },

  getCategories(items = []) {
    const list = items
    return [...new Set(list.map(sp => sp.kategori).filter(Boolean))]
  },

  getStats(items = []) {
    const list = items
    const lowStock = this.getLowStock(list)
    const totalStok = list.reduce((sum, sp) => sum + Number(sp.stok || 0), 0)
    const totalNilai = this.getTotalValue(list)
    const totalModal = this.getStockValue(list)
    return {
      totalItems: list.length,
      totalStok,
      totalNilai,
      totalModal,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock
    }
  },

  exportToCSV(items = []) {
    const list = items
    const headers = ['Kode', 'Nama', 'Kategori', 'Merk', 'Supplier', 'Harga Beli', 'Harga Jual', 'Stok', 'Stok Min', 'Lokasi', 'Barcode', 'Satuan']
    const rows = list.map(sp => [
      sp.kode,
      sp.nama,
      sp.kategori,
      sp.merk,
      sp.supplier?.nama || '',
      sp.hargaBeli,
      sp.hargaJual,
      sp.stok,
      sp.stokMinimum,
      sp.lokasi || '',
      sp.barcode || '',
      sp.satuan || 'pcs'
    ])
    return { headers, rows, filename: `spareparts_${new Date().toISOString().slice(0, 10)}.csv` }
  },

  getStockByCategory(items = []) {
    const list = items
    const categories = {}
    list.forEach(sp => {
      if (!categories[sp.kategori]) {
        categories[sp.kategori] = {
          kategori: sp.kategori,
          totalItems: 0,
          totalStok: 0,
          totalNilai: 0
        }
      }
      categories[sp.kategori].totalItems++
      categories[sp.kategori].totalStok += Number(sp.stok || 0)
      categories[sp.kategori].totalNilai += Number(sp.stok || 0) * Number(sp.hargaJual || 0)
    })
    return Object.values(categories)
  },

  async importFromCSV(csvText) {
    // Parse CSV sederhana (support quote untuk koma di dalam field)
    const lines = csvText.trim().split(/\r?\n/)
    if (lines.length < 2) {
      throw new Error('File CSV kosong atau tidak valid')
    }

    const parseCSVLine = (line) => {
      const result = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (inQuotes) {
          if (char === '"') {
            if (line[i + 1] === '"') {
              current += '"'
              i++
            } else {
              inQuotes = false
            }
          } else {
            current += char
          }
        } else {
          if (char === '"') {
            inQuotes = true
          } else if (char === ',') {
            result.push(current)
            current = ''
          } else {
            current += char
          }
        }
      }
      result.push(current)
      return result.map(field => field.trim())
    }

    // Ambil header
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())
    const nameMap = {
      'kode': 'kode',
      'nama': 'nama',
      'nama sparepart': 'nama',
      'kategori': 'kategori',
      'merk': 'merk',
      'supplier': 'supplierName',
      'harga beli': 'hargaBeli',
      'harga jual': 'hargaJual',
      'stok': 'stok',
      'stok min': 'stokMinimum',
      'stok minimum': 'stokMinimum',
      'lokasi': 'lokasi',
      'barcode': 'barcode',
      'satuan': 'satuan'
    }

    const imported = []
    const errors = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length === 1 && values[0] === '') continue // skip baris kosong

      const raw = {}
      headers.forEach((header, index) => {
        raw[header] = values[index] || ''
      })

      const mapped = {}
      let hasError = false
      let errorMsg = ''

      // Map header ke field
      Object.keys(raw).forEach(key => {
        const field = nameMap[key] || null
        const value = raw[key]
        if (field) mapped[field] = value
      })

      // Validasi wajib
      if (!mapped.nama || !mapped.kategori || !mapped.merk) {
        hasError = true
        errorMsg = `Baris ${i}: Nama, kategori, dan merk wajib diisi`
      }

      // Validasi angka
      const numericFields = ['hargaBeli', 'hargaJual', 'stok', 'stokMinimum']
      numericFields.forEach(field => {
        if (mapped[field]) {
          const num = Number(mapped[field])
          if (isNaN(num)) {
            hasError = true
            errorMsg = `Baris ${i}: ${field} harus berupa angka`
          } else {
            mapped[field] = num
          }
        }
      })

      if (hasError) {
        errors.push({ row: i, message: errorMsg })
      } else {
        const newItem = await db.insert('spareparts', mapped)
        imported.push(newItem)
      }
    }

    return { imported: imported.length, errors }
  }
}