import { db } from './database'

export const transactionService = {
  // Barang Masuk (Stock In)
  barangMasuk(data) {
    const sparepart = db.getById(db.keys.SPAREPARTS, data.sparepartId)
    if (!sparepart) throw new Error('Sparepart tidak ditemukan')

    // Update stok sparepart
    const newStok = sparepart.stok + data.jumlah
    db.update(db.keys.SPAREPARTS, sparepart.id, { stok: newStok })

    // Buat transaksi
    const transaction = db.insert(db.keys.TRANSACTIONS, {
      tipe: 'MASUK',
      nomor: `BM-${new Date().getFullYear()}${String(db.getSequence('bm_seq')).padStart(4, '0')}`,
      sparepartId: sparepart.id,
      supplierId: data.supplierId || sparepart.supplierId,
      jumlah: data.jumlah,
      hargaSatuan: data.hargaSatuan || sparepart.hargaBeli,
      total: (data.hargaSatuan || sparepart.hargaBeli) * data.jumlah,
      tanggal: data.tanggal || new Date().toISOString(),
      keterangan: data.keterangan || '',
      createdAt: new Date().toISOString()
    })

    // Catat pergerakan stok
    db.insert(db.keys.STOCK_MOVEMENTS, {
      sparepartId: sparepart.id,
      tipe: 'MASUK',
      jumlah: data.jumlah,
      stokSebelum: sparepart.stok,
      stokSesudah: newStok,
      tanggal: transaction.tanggal,
      referensiId: transaction.id,
      createdAt: new Date().toISOString()
    })

    return transaction
  },

  // Barang Keluar (Stock Out)
  barangKeluar(data) {
    const sparepart = db.getById(db.keys.SPAREPARTS, data.sparepartId)
    if (!sparepart) throw new Error('Sparepart tidak ditemukan')
    if (sparepart.stok < data.jumlah) {
      throw new Error(`Stok tidak mencukupi. Stok tersedia: ${sparepart.stok}`)
    }

    // Update stok sparepart
    const newStok = sparepart.stok - data.jumlah
    db.update(db.keys.SPAREPARTS, sparepart.id, { stok: newStok })

    // Buat transaksi
    const transaction = db.insert(db.keys.TRANSACTIONS, {
      tipe: 'KELUAR',
      nomor: `BK-${new Date().getFullYear()}${String(db.getSequence('bk_seq')).padStart(4, '0')}`,
      sparepartId: sparepart.id,
      supplierId: sparepart.supplierId,
      jumlah: data.jumlah,
      hargaSatuan: data.hargaSatuan || sparepart.hargaJual,
      total: (data.hargaSatuan || sparepart.hargaJual) * data.jumlah,
      tanggal: data.tanggal || new Date().toISOString(),
      keterangan: data.keterangan || '',
      createdAt: new Date().toISOString()
    })

    // Catat pergerakan stok
    db.insert(db.keys.STOCK_MOVEMENTS, {
      sparepartId: sparepart.id,
      tipe: 'KELUAR',
      jumlah: data.jumlah,
      stokSebelum: sparepart.stok,
      stokSesudah: newStok,
      tanggal: transaction.tanggal,
      referensiId: transaction.id,
      createdAt: new Date().toISOString()
    })

    return transaction
  },

  getAll() {
    const transactions = db.getAll(db.keys.TRANSACTIONS)
    const spareparts = db.getAll(db.keys.SPAREPARTS)
    const suppliers = db.getAll(db.keys.SUPPLIERS)
    return transactions
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
      .map(t => ({
        ...t,
        sparepart: spareparts.find(sp => sp.id === t.sparepartId) || null,
        supplier: suppliers.find(s => s.id === t.supplierId) || null
      }))
  },

  getByType(tipe) {
    return this.getAll().filter(t => t.tipe === tipe)
  },

  getStockMovements() {
    const movements = db.getAll(db.keys.STOCK_MOVEMENTS)
    const spareparts = db.getAll(db.keys.SPAREPARTS)
    return movements
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
      .map(m => ({
        ...m,
        sparepart: spareparts.find(sp => sp.id === m.sparepartId) || null
      }))
  },

  getStats() {
    const transactions = this.getAll()
    const masuk = transactions.filter(t => t.tipe === 'MASUK')
    const keluar = transactions.filter(t => t.tipe === 'KELUAR')
    const totalMasuk = masuk.reduce((sum, t) => sum + t.total, 0)
    const totalKeluar = keluar.reduce((sum, t) => sum + t.total, 0)
    const totalQtyMasuk = masuk.reduce((sum, t) => sum + t.jumlah, 0)
    const totalQtyKeluar = keluar.reduce((sum, t) => sum + t.jumlah, 0)

    return {
      totalTransaksi: transactions.length,
      totalMasuk,
      totalKeluar,
      totalQtyMasuk,
      totalQtyKeluar,
      selisih: totalMasuk - totalKeluar
    }
  },

  getMonthlyReport(year = new Date().getFullYear()) {
    const transactions = this.getAll()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    
    return months.map((month, index) => {
      const monthTransactions = transactions.filter(t => {
        const date = new Date(t.tanggal)
        return date.getFullYear() === year && date.getMonth() === index
      })
      const masuk = monthTransactions.filter(t => t.tipe === 'MASUK')
      const keluar = monthTransactions.filter(t => t.tipe === 'KELUAR')
      return {
        bulan: month,
        masuk: masuk.reduce((sum, t) => sum + t.total, 0),
        keluar: keluar.reduce((sum, t) => sum + t.total, 0),
        qtyMasuk: masuk.reduce((sum, t) => sum + t.jumlah, 0),
        qtyKeluar: keluar.reduce((sum, t) => sum + t.jumlah, 0)
      }
    })
  },

  getTopSpareparts(limit = 5) {
    const transactions = this.getAll()
    const keluar = transactions.filter(t => t.tipe === 'KELUAR')
    const grouped = keluar.reduce((acc, t) => {
      if (!acc[t.sparepartId]) {
        acc[t.sparepartId] = {
          sparepartId: t.sparepartId,
          nama: t.sparepart?.nama || 'Unknown',
          kode: t.sparepart?.kode || '',
          totalQty: 0,
          totalNilai: 0
        }
      }
      acc[t.sparepartId].totalQty += t.jumlah
      acc[t.sparepartId].totalNilai += t.total
      return acc
    }, {})

    return Object.values(grouped)
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, limit)
  },

  // Hapus transaksi dan kembalikan stok
  deleteTransaction(id) {
    const transaction = db.getById(db.keys.TRANSACTIONS, id)
    if (!transaction) throw new Error('Transaksi tidak ditemukan')

    const sparepart = db.getById(db.keys.SPAREPARTS, transaction.sparepartId)
    if (!sparepart) throw new Error('Sparepart tidak ditemukan')

    // Kembalikan stok
    const newStok = transaction.tipe === 'MASUK'
      ? sparepart.stok - transaction.jumlah
      : sparepart.stok + transaction.jumlah

    if (newStok < 0) {
      throw new Error('Tidak dapat menghapus transaksi karena stok akan menjadi negatif')
    }

    db.update(db.keys.SPAREPARTS, sparepart.id, { stok: newStok })

    // Hapus transaksi
    db.remove(db.keys.TRANSACTIONS, id)

    // Hapus pergerakan stok terkait
    const movements = db.getAll(db.keys.STOCK_MOVEMENTS)
    const filteredMovements = movements.filter(m => m.referensiId !== id)
    localStorage.setItem(db.keys.STOCK_MOVEMENTS, JSON.stringify(filteredMovements))

    return true
  },

  // Export transaksi ke CSV
  exportToCSV(tipe = 'ALL') {
    const transactions = this.getAll().filter(t => tipe === 'ALL' || t.tipe === tipe)
    const headers = ['No. Transaksi', 'Tanggal', 'Tipe', 'Sparepart', 'Supplier', 'Jumlah', 'Harga Satuan', 'Total', 'Keterangan']
    const rows = transactions.map(t => [
      t.nomor,
      new Date(t.tanggal).toLocaleDateString('id-ID'),
      t.tipe,
      t.sparepart?.nama || '',
      t.supplier?.nama || '',
      t.jumlah,
      t.hargaSatuan,
      t.total,
      t.keterangan || ''
    ])
    return { headers, rows, filename: `transactions_${tipe.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv` }
  },

  // Riwayat transaksi per sparepart
  getBySparepartId(sparepartId) {
    return this.getAll().filter(t => t.sparepartId === sparepartId)
  }
}
