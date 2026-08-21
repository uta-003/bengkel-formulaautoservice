import { db } from './database'
import { formatRupiah } from '../utils/format'

// Helper untuk generate kode opname
function generateKodeOpname(existingItems) {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const count = (existingItems || []).length + 1
  return `SO-${year}${month}-${String(count).padStart(4, '0')}`
}

export const OPNAME_STATUS = {
  DRAFT: 'DRAFT',
  SELESAI: 'SELESAI',
  DIBATALKAN: 'DIBATALKAN'
}

export const OPNAME_STATUS_LABELS = {
  [OPNAME_STATUS.DRAFT]: 'Draft',
  [OPNAME_STATUS.SELESAI]: 'Selesai',
  [OPNAME_STATUS.DIBATALKAN]: 'Dibatalkan'
}

export const OPNAME_STATUS_COLORS = {
  [OPNAME_STATUS.DRAFT]: 'bg-yellow-100 text-yellow-700',
  [OPNAME_STATUS.SELESAI]: 'bg-green-100 text-green-700',
  [OPNAME_STATUS.DIBATALKAN]: 'bg-red-100 text-red-700'
}

export const stockOpnameService = {
  async getAll() {
    const opnames = await db.getAll(db.keys.STOCK_OPNAMES)
    return opnames.sort((a, b) => new Date(b.tanggalOpname) - new Date(a.tanggalOpname))
  },

  async getById(id) {
    const opname = await db.getById(db.keys.STOCK_OPNAMES, id)
    if (!opname) return null
    const items = await this.getItems(id)
    return { ...opname, items }
  },

  // Ambil detail item opname dengan data sparepart
  async getItems(opnameId) {
    const [items, spareparts] = await Promise.all([
      db.getAll(db.keys.STOCK_OPNAME_ITEMS),
      db.getAll(db.keys.SPAREPARTS)
    ])
    const sparepartMap = new Map(spareparts.map(sp => [Number(sp.id), sp]))
    return items
      .filter(item => Number(item.opnameId) === Number(opnameId))
      .map(item => ({
        ...item,
        sparepart: sparepartMap.get(Number(item.sparepartId)) || null
      }))
  },

  // Buat sesi opname baru dengan snapshot stok sistem saat ini
  // kategoriFilter opsional: hanya ambil sparepart pada kategori tertentu ('' = semua)
  async create({ namaPetugas = '', kategoriFilter = '', catatan = '' } = {}) {
    const existing = await db.getAll(db.keys.STOCK_OPNAMES)
    const kodeOpname = generateKodeOpname(existing)

    const spareparts = await db.getAll(db.keys.SPAREPARTS)
    const filtered = kategoriFilter
      ? spareparts.filter(sp => sp.kategori === kategoriFilter)
      : spareparts

    if (filtered.length === 0) {
      throw new Error('Tidak ada sparepart yang cocok dengan filter kategori')
    }

    const opname = await db.insert(db.keys.STOCK_OPNAMES, {
      kodeOpname,
      namaPetugas,
      kategoriFilter,
      status: OPNAME_STATUS.DRAFT,
      totalItem: filtered.length,
      totalSelisih: 0,
      totalNilaiSelisih: 0,
      catatan,
      tanggalOpname: new Date().toISOString(),
      createdAt: new Date().toISOString()
    })

    // Snapshot stok sistem saat opname dibuat
    for (const sp of filtered) {
      await db.insert(db.keys.STOCK_OPNAME_ITEMS, {
        opnameId: opname.id,
        sparepartId: sp.id,
        stokSistem: Number(sp.stok || 0),
        stokFisik: Number(sp.stok || 0), // default = sama, diisi petugas saat hitung fisik
        selisih: 0,
        nilaiSelisih: 0,
        sudahDisesuaikan: false,
        catatan: '',
        createdAt: new Date().toISOString()
      })
    }

    return this.getById(opname.id)
  },

  // Update hasil hitungan fisik satu item
  async updateItem(itemId, { stokFisik, catatan = '' }) {
    const item = await db.getById(db.keys.STOCK_OPNAME_ITEMS, itemId)
    if (!item) throw new Error('Item opname tidak ditemukan')

    const sparepart = await db.getById(db.keys.SPAREPARTS, item.sparepartId)
    const fisik = Number(stokFisik || 0)
    const selisih = fisik - Number(item.stokSistem || 0)
    const nilaiSelisih = selisih * Number(sparepart?.hargaBeli || 0)

    await db.update(db.keys.STOCK_OPNAME_ITEMS, itemId, {
      stokFisik: fisik,
      selisih,
      nilaiSelisih,
      catatan
    })

    await this.recalculateTotals(item.opnameId)
    return { ...item, stokFisik: fisik, selisih, nilaiSelisih }
  },

  // Hitung ulang ringkasan sesi opname
  async recalculateTotals(opnameId) {
    const items = await this.getItems(opnameId)
    const totalSelisih = items.reduce((sum, it) => sum + Number(it.selisih || 0), 0)
    const totalNilaiSelisih = items.reduce((sum, it) => sum + Number(it.nilaiSelisih || 0), 0)

    await db.update(db.keys.STOCK_OPNAMES, opnameId, {
      totalItem: items.length,
      totalSelisih,
      totalNilaiSelisih
    })
  },

  // Selesaikan opname & sesuaikan stok sistem ke hasil hitungan fisik
  // Setiap item yang berselisih akan dicatat sebagai pergerakan stok "OPNAME"
  async finalize(opnameId) {
    const opname = await db.getById(db.keys.STOCK_OPNAMES, opnameId)
    if (!opname) throw new Error('Sesi opname tidak ditemukan')
    if (opname.status !== OPNAME_STATUS.DRAFT) {
      throw new Error('Hanya opname berstatus Draft yang dapat diselesaikan')
    }

    const items = await this.getItems(opnameId)
    let adjustedCount = 0

    for (const item of items) {
      const selisih = Number(item.selisih || 0)
      if (selisih === 0 || item.sudahDisesuaikan) continue

      const sparepart = await db.getById(db.keys.SPAREPARTS, item.sparepartId)
      if (!sparepart) continue

      const stokSebelum = Number(sparepart.stok || 0)
      const stokBaru = Number(item.stokFisik || 0)

      // Update stok sistem ke hasil hitungan fisik
      await db.update(db.keys.SPAREPARTS, sparepart.id, { stok: stokBaru })

      // Catat pergerakan stok penyesuaian
      await db.insert(db.keys.STOCK_MOVEMENTS, {
        sparepartId: sparepart.id,
        tipe: selisih > 0 ? 'MASUK' : 'KELUAR',
        jumlah: Math.abs(selisih),
        stokSebelum,
        stokSesudah: stokBaru,
        tanggal: new Date().toISOString(),
        referensiId: opname.id,
        keterangan: `Stock opname ${opname.kodeOpname}`,
        createdAt: new Date().toISOString()
      })

      await db.update(db.keys.STOCK_OPNAME_ITEMS, item.id, { sudahDisesuaikan: true })
      adjustedCount += 1
    }

    return db.update(db.keys.STOCK_OPNAMES, opnameId, {
      status: OPNAME_STATUS.SELESAI,
      tanggalSelesai: new Date().toISOString()
    }).then(() => adjustedCount)
  },

  async cancel(opnameId) {
    const opname = await db.getById(db.keys.STOCK_OPNAMES, opnameId)
    if (!opname) throw new Error('Sesi opname tidak ditemukan')
    if (opname.status !== OPNAME_STATUS.DRAFT) {
      throw new Error('Hanya opname berstatus Draft yang dapat dibatalkan')
    }
    return db.update(db.keys.STOCK_OPNAMES, opnameId, { status: OPNAME_STATUS.DIBATALKAN })
  },

  async delete(opnameId) {
    const opname = await db.getById(db.keys.STOCK_OPNAMES, opnameId)
    if (!opname) throw new Error('Sesi opname tidak ditemukan')
    if (opname.status === OPNAME_STATUS.SELESAI) {
      throw new Error('Opname yang sudah selesai tidak dapat dihapus karena stok sudah disesuaikan')
    }

    // Hapus item terkait
    const allItems = await db.getAll(db.keys.STOCK_OPNAME_ITEMS)
    for (const item of allItems) {
      if (Number(item.opnameId) === Number(opnameId)) {
        await db.remove(db.keys.STOCK_OPNAME_ITEMS, item.id)
      }
    }

    await db.remove(db.keys.STOCK_OPNAMES, opnameId)
    return true
  },

  // ---- Metode murni sinkron ----
  search(query, items = []) {
    const q = (query || '').toLowerCase()
    if (!q) return items
    return items.filter(o =>
      (o.kodeOpname || '').toLowerCase().includes(q) ||
      (o.namaPetugas || '').toLowerCase().includes(q) ||
      (o.kategoriFilter || '').toLowerCase().includes(q)
    )
  },

  filterByStatus(status, items = []) {
    if (!status || status === 'ALL') return items
    return items.filter(o => o.status === status)
  },

  getStatusStats(items = []) {
    const stats = {}
    Object.values(OPNAME_STATUS).forEach(s => {
      stats[s] = items.filter(o => o.status === s).length
    })
    return stats
  },

  exportToCSV(items = []) {
    const headers = ['Kode Opname', 'Tanggal', 'Petugas', 'Kategori', 'Total Item', 'Total Selisih', 'Nilai Selisih', 'Status']
    const rows = items.map(o => [
      o.kodeOpname || '',
      o.tanggalOpname ? new Date(o.tanggalOpname).toLocaleDateString('id-ID') : '',
      o.namaPetugas || '',
      o.kategoriFilter || 'Semua',
      o.totalItem || 0,
      o.totalSelisih || 0,
      formatRupiah(o.totalNilaiSelisih || 0),
      OPNAME_STATUS_LABELS[o.status] || o.status
    ])
    return { headers, rows, filename: `stock_opname_${new Date().toISOString().slice(0, 10)}.csv` }
  }
}