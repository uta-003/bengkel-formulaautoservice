import { db } from './database'

// Helper untuk map transaksi dengan spareparts dan suppliers menggunakan Map
// untuk menghindari O(n*m) lookup
function enrichTransactions(transactions, sparepartMap, supplierMap) {
  return transactions.map(t => ({
    ...t,
    sparepart: sparepartMap.get(Number(t.sparepartId)) || null,
    supplier: supplierMap.get(Number(t.supplierId)) || null
  }))
}

function buildMaps(spareparts, suppliers) {
  return {
    sparepartMap: new Map(spareparts.map(sp => [Number(sp.id), sp])),
    supplierMap: new Map(suppliers.map(s => [Number(s.id), s]))
  }
}

// Cache untuk data yang sudah di-join (transaksi + sparepart + supplier)
let joinedCache = null
let joinedCacheTimestamp = 0
const JOINED_CACHE_TTL = 5000 // 5 detik

export const transactionService = {
  // Barang Masuk (Stock In)
  async barangMasuk(data) {
    const sparepart = await db.getById(db.keys.SPAREPARTS, data.sparepartId)
    if (!sparepart) throw new Error('Sparepart tidak ditemukan')

    // Update stok sparepart
    const newStok = sparepart.stok + data.jumlah
    await db.update(db.keys.SPAREPARTS, sparepart.id, { stok: newStok })

    // Buat transaksi dengan nomor acak
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const random = Math.floor(1000 + Math.random() * 9000)
    const nomor = `BM-${year}${month}${random}`

    const transaction = await db.insert(db.keys.TRANSACTIONS, {
      tipe: 'MASUK',
      nomor,
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
    await db.insert(db.keys.STOCK_MOVEMENTS, {
      sparepartId: sparepart.id,
      tipe: 'MASUK',
      jumlah: data.jumlah,
      stokSebelum: sparepart.stok,
      stokSesudah: newStok,
      tanggal: transaction.tanggal,
      referensiId: transaction.id,
      createdAt: new Date().toISOString()
    })

    joinedCache = null
    return transaction
  },

  // Barang Keluar (Stock Out)
  async barangKeluar(data) {
    const sparepart = await db.getById(db.keys.SPAREPARTS, data.sparepartId)
    if (!sparepart) throw new Error('Sparepart tidak ditemukan')
    if (sparepart.stok < data.jumlah) {
      throw new Error(`Stok tidak mencukupi. Stok tersedia: ${sparepart.stok}`)
    }

    // Update stok sparepart
    const newStok = sparepart.stok - data.jumlah
    await db.update(db.keys.SPAREPARTS, sparepart.id, { stok: newStok })

    // Buat transaksi
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const random = Math.floor(1000 + Math.random() * 9000)
    const nomor = `BK-${year}${month}${random}`

    const transaction = await db.insert(db.keys.TRANSACTIONS, {
      tipe: 'KELUAR',
      nomor,
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
    await db.insert(db.keys.STOCK_MOVEMENTS, {
      sparepartId: sparepart.id,
      tipe: 'KELUAR',
      jumlah: data.jumlah,
      stokSebelum: sparepart.stok,
      stokSesudah: newStok,
      tanggal: transaction.tanggal,
      referensiId: transaction.id,
      createdAt: new Date().toISOString()
    })

    joinedCache = null
    return transaction
  },

  // Muat semua data sekaligus dengan join efisien menggunakan Map
  async getAll() {
    // Cek cache joined
    if (joinedCache && Date.now() - joinedCacheTimestamp < JOINED_CACHE_TTL) {
      return joinedCache
    }

    const [transactions, spareparts, suppliers] = await Promise.all([
      db.getAll(db.keys.TRANSACTIONS),
      db.getAll(db.keys.SPAREPARTS),
      db.getAll(db.keys.SUPPLIERS)
    ])

    const { sparepartMap, supplierMap } = buildMaps(spareparts, suppliers)
    const enriched = enrichTransactions(transactions, sparepartMap, supplierMap)
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))

    joinedCache = enriched
    joinedCacheTimestamp = Date.now()
    return enriched
  },

  async getByType(tipe) {
    const all = await this.getAll()
    return all.filter(t => t.tipe === tipe)
  },

  // Ambil transaksi terbaru saja (lebih efisien untuk dashboard)
  async getRecentTransactions(limit = 5) {
    const all = await this.getAll()
    return all.slice(0, limit)
  },

  async getStockMovements() {
    const [movements, spareparts] = await Promise.all([
      db.getAll(db.keys.STOCK_MOVEMENTS),
      db.getAll(db.keys.SPAREPARTS)
    ])
    const sparepartMap = new Map(spareparts.map(sp => [Number(sp.id), sp]))
    return movements
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
      .map(m => ({
        ...m,
        sparepart: sparepartMap.get(Number(m.sparepartId)) || null
      }))
  },

  async getStats() {
    const transactions = await this.getAll()
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

  async getMonthlyReport(year = new Date().getFullYear()) {
    const transactions = await this.getAll()
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
        bulanAngka: index + 1,
        masuk: masuk.reduce((sum, t) => sum + t.total, 0),
        keluar: keluar.reduce((sum, t) => sum + t.total, 0),
        qtyMasuk: masuk.reduce((sum, t) => sum + t.jumlah, 0),
        qtyKeluar: keluar.reduce((sum, t) => sum + t.jumlah, 0)
      }
    })
  },

  // Helper untuk filter transaksi berdasarkan periode
  filterByPeriod(transactions, period, date) {
    const target = date ? new Date(date) : new Date()
    const year = target.getFullYear()
    const month = target.getMonth()
    const day = target.getDate()

    // Hitung awal minggu (Senin) dan akhir minggu (Minggu)
    const dayOfWeek = target.getDay() // 0 = Minggu, 1 = Senin, ...
    const diffToMonday = (dayOfWeek + 6) % 7
    const monday = new Date(year, month, day - diffToMonday, 0, 0, 0)
    const sunday = new Date(year, month, day - diffToMonday + 6, 23, 59, 59, 999)

    const startOfYear = new Date(year, 0, 1, 0, 0, 0)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)

    return transactions.filter(t => {
      const tDate = new Date(t.tanggal)
      const tYear = tDate.getFullYear()
      const tMonth = tDate.getMonth()
      const tDay = tDate.getDate()

      switch (period) {
        case 'harian':
          return tYear === year && tMonth === month && tDay === day
        case 'mingguan':
          return tDate >= monday && tDate <= sunday
        case 'bulanan':
          return tYear === year && tMonth === month
        case 'tahunan':
          return tDate >= startOfYear && tDate <= endOfYear
        default:
          return true
      }
    })
  },

  // Laporan harian
  async getDailyReport(date = new Date()) {
    const transactions = await this.getAll()
    const target = new Date(date)
    const year = target.getFullYear()
    const month = target.getMonth()
    const day = target.getDate()

    const dayTransactions = transactions.filter(t => {
      const tDate = new Date(t.tanggal)
      return tDate.getFullYear() === year && tDate.getMonth() === month && tDate.getDate() === day
    })

    const masuk = dayTransactions.filter(t => t.tipe === 'MASUK')
    const keluar = dayTransactions.filter(t => t.tipe === 'KELUAR')

    return {
      tanggal: target.toISOString(),
      totalTransaksi: dayTransactions.length,
      totalMasuk: masuk.reduce((sum, t) => sum + t.total, 0),
      totalKeluar: keluar.reduce((sum, t) => sum + t.total, 0),
      qtyMasuk: masuk.reduce((sum, t) => sum + t.jumlah, 0),
      qtyKeluar: keluar.reduce((sum, t) => sum + t.jumlah, 0),
      selisih: masuk.reduce((sum, t) => sum + t.total, 0) - keluar.reduce((sum, t) => sum + t.total, 0),
      transaksi: dayTransactions
    }
  },

  // Laporan mingguan
  async getWeeklyReport(date = new Date()) {
    const transactions = await this.getAll()
    const target = new Date(date)
    const year = target.getFullYear()
    const month = target.getMonth()
    const day = target.getDate()

    const dayOfWeek = target.getDay()
    const diffToMonday = (dayOfWeek + 6) % 7
    const monday = new Date(year, month, day - diffToMonday)

    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
    const weeklyData = days.map((label, index) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index)
      const dayTransactions = transactions.filter(t => {
        const tDate = new Date(t.tanggal)
        return tDate.getFullYear() === date.getFullYear() &&
               tDate.getMonth() === date.getMonth() &&
               tDate.getDate() === date.getDate()
      })
      const masuk = dayTransactions.filter(t => t.tipe === 'MASUK')
      const keluar = dayTransactions.filter(t => t.tipe === 'KELUAR')
      return {
        hari: label,
        tanggal: date.toISOString(),
        masuk: masuk.reduce((sum, t) => sum + t.total, 0),
        keluar: keluar.reduce((sum, t) => sum + t.total, 0),
        qtyMasuk: masuk.reduce((sum, t) => sum + t.jumlah, 0),
        qtyKeluar: keluar.reduce((sum, t) => sum + t.jumlah, 0)
      }
    })

    const weekTransactions = this.filterByPeriod(transactions, 'mingguan', target)
    const masuk = weekTransactions.filter(t => t.tipe === 'MASUK')
    const keluar = weekTransactions.filter(t => t.tipe === 'KELUAR')

    return {
      mingguKe: Math.ceil((day + diffToMonday) / 7),
      mulai: monday.toISOString(),
      akhir: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6).toISOString(),
      totalTransaksi: weekTransactions.length,
      totalMasuk: masuk.reduce((sum, t) => sum + t.total, 0),
      totalKeluar: keluar.reduce((sum, t) => sum + t.total, 0),
      qtyMasuk: masuk.reduce((sum, t) => sum + t.jumlah, 0),
      qtyKeluar: keluar.reduce((sum, t) => sum + t.jumlah, 0),
      selisih: masuk.reduce((sum, t) => sum + t.total, 0) - keluar.reduce((sum, t) => sum + t.total, 0),
      data: weeklyData
    }
  },

  // Laporan bulanan (detail per minggu)
  async getMonthlyDetailReport(date = new Date()) {
    const transactions = await this.getAll()
    const target = new Date(date)
    const year = target.getFullYear()
    const month = target.getMonth()

    const monthTransactions = transactions.filter(t => {
      const tDate = new Date(t.tanggal)
      return tDate.getFullYear() === year && tDate.getMonth() === month
    })

    const masuk = monthTransactions.filter(t => t.tipe === 'MASUK')
    const keluar = monthTransactions.filter(t => t.tipe === 'KELUAR')

    const weeks = []
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day += 7) {
      const weekStart = new Date(year, month, day, 0, 0, 0)
      const weekEnd = new Date(year, month, Math.min(day + 6, daysInMonth), 23, 59, 59, 999)
      const weekTransactions = monthTransactions.filter(t => {
        const tDate = new Date(t.tanggal)
        return tDate >= weekStart && tDate <= weekEnd
      })
      const weekMasuk = weekTransactions.filter(t => t.tipe === 'MASUK')
      const weekKeluar = weekTransactions.filter(t => t.tipe === 'KELUAR')
      weeks.push({
        minggu: weeks.length + 1,
        rentang: `${weekStart.getDate()} - ${weekEnd.getDate()}`,
        masuk: weekMasuk.reduce((sum, t) => sum + t.total, 0),
        keluar: weekKeluar.reduce((sum, t) => sum + t.total, 0),
        qtyMasuk: weekMasuk.reduce((sum, t) => sum + t.jumlah, 0),
        qtyKeluar: weekKeluar.reduce((sum, t) => sum + t.jumlah, 0)
      })
    }

    return {
      bulan: target.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
      totalTransaksi: monthTransactions.length,
      totalMasuk: masuk.reduce((sum, t) => sum + t.total, 0),
      totalKeluar: keluar.reduce((sum, t) => sum + t.total, 0),
      qtyMasuk: masuk.reduce((sum, t) => sum + t.jumlah, 0),
      qtyKeluar: keluar.reduce((sum, t) => sum + t.jumlah, 0),
      selisih: masuk.reduce((sum, t) => sum + t.total, 0) - keluar.reduce((sum, t) => sum + t.total, 0),
      data: weeks
    }
  },

  // Laporan tahunan
  async getYearlyReport(year = new Date().getFullYear()) {
    const transactions = await this.getAll()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

    const yearlyData = months.map((bulan, index) => {
      const monthTransactions = transactions.filter(t => {
        const tDate = new Date(t.tanggal)
        return tDate.getFullYear() === year && tDate.getMonth() === index
      })
      const masuk = monthTransactions.filter(t => t.tipe === 'MASUK')
      const keluar = monthTransactions.filter(t => t.tipe === 'KELUAR')
      return {
        bulan,
        masuk: masuk.reduce((sum, t) => sum + t.total, 0),
        keluar: keluar.reduce((sum, t) => sum + t.total, 0),
        qtyMasuk: masuk.reduce((sum, t) => sum + t.jumlah, 0),
        qtyKeluar: keluar.reduce((sum, t) => sum + t.jumlah, 0)
      }
    })

    const yearTransactions = this.filterByPeriod(transactions, 'tahunan', new Date(year, 0, 1))
    const masuk = yearTransactions.filter(t => t.tipe === 'MASUK')
    const keluar = yearTransactions.filter(t => t.tipe === 'KELUAR')

    return {
      tahun: year,
      totalTransaksi: yearTransactions.length,
      totalMasuk: masuk.reduce((sum, t) => sum + t.total, 0),
      totalKeluar: keluar.reduce((sum, t) => sum + t.total, 0),
      qtyMasuk: masuk.reduce((sum, t) => sum + t.jumlah, 0),
      qtyKeluar: keluar.reduce((sum, t) => sum + t.jumlah, 0),
      selisih: masuk.reduce((sum, t) => sum + t.total, 0) - keluar.reduce((sum, t) => sum + t.total, 0),
      data: yearlyData
    }
  },

  // Get top spareparts dengan filter periode
  async getTopSpareparts(limit = 5, period = 'all', date = null) {
    let filtered = await this.getAll()
    if (period && period !== 'all') {
      filtered = this.filterByPeriod(filtered, period, date)
    }
    const keluar = filtered.filter(t => t.tipe === 'KELUAR')
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

  // Get stock movements dengan filter periode
  async getStockMovementsByPeriod(period = 'all', date = null, limit = 20) {
    let movements = await this.getStockMovements()
    if (period && period !== 'all') {
      movements = this.filterByPeriod(movements, period, date)
    }
    return movements.slice(0, limit)
  },

  // Statistik lengkap per periode
  async getPeriodStats(period = 'all', date = null) {
    const transactions = await this.getAll()
    const filtered = this.filterByPeriod(transactions, period, date)
    const masuk = filtered.filter(t => t.tipe === 'MASUK')
    const keluar = filtered.filter(t => t.tipe === 'KELUAR')
    const totalMasuk = masuk.reduce((sum, t) => sum + t.total, 0)
    const totalKeluar = keluar.reduce((sum, t) => sum + t.total, 0)

    return {
      totalTransaksi: filtered.length,
      totalQtyMasuk: masuk.reduce((sum, t) => sum + t.jumlah, 0),
      totalQtyKeluar: keluar.reduce((sum, t) => sum + t.jumlah, 0),
      totalMasuk,
      totalKeluar,
      selisih: totalMasuk - totalKeluar,
      rataRataMasuk: masuk.length > 0 ? totalMasuk / masuk.length : 0,
      rataRataKeluar: keluar.length > 0 ? totalKeluar / keluar.length : 0
    }
  },

  // Hapus transaksi dan kembalikan stok
  async deleteTransaction(id) {
    const transaction = await db.getById(db.keys.TRANSACTIONS, id)
    if (!transaction) throw new Error('Transaksi tidak ditemukan')

    const sparepart = await db.getById(db.keys.SPAREPARTS, transaction.sparepartId)
    if (!sparepart) throw new Error('Sparepart tidak ditemukan')

    // Kembalikan stok
    const newStok = transaction.tipe === 'MASUK'
      ? sparepart.stok - transaction.jumlah
      : sparepart.stok + transaction.jumlah

    if (newStok < 0) {
      throw new Error('Tidak dapat menghapus transaksi karena stok akan menjadi negatif')
    }

    await db.update(db.keys.SPAREPARTS, sparepart.id, { stok: newStok })

    // Hapus transaksi
    await db.remove(db.keys.TRANSACTIONS, id)

    // Hapus pergerakan stok terkait
    const movements = await db.getAll(db.keys.STOCK_MOVEMENTS)
    // Delete specific movements by reference
    for (const m of movements) {
      if (m.referensiId === id) {
        await db.remove(db.keys.STOCK_MOVEMENTS, m.id)
      }
    }

    joinedCache = null
    return true
  },

  // Export transaksi ke CSV
  async exportToCSV(tipe = 'ALL') {
    const transactions = await this.getAll()
    const filtered = transactions.filter(t => tipe === 'ALL' || t.tipe === tipe)
    const headers = ['No. Transaksi', 'Tanggal', 'Tipe', 'Sparepart', 'Supplier', 'Jumlah', 'Harga Satuan', 'Total', 'Keterangan']
    const rows = filtered.map(t => [
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

  // Export laporan lengkap ke CSV dengan filter periode
  async exportReportToCSV(period = 'harian', date = null) {
    const transactions = await this.getAll()
    const filtered = this.filterByPeriod(transactions, period, date)
    const masuk = filtered.filter(t => t.tipe === 'MASUK')
    const keluar = filtered.filter(t => t.tipe === 'KELUAR')
    const totalMasuk = masuk.reduce((sum, t) => sum + t.total, 0)
    const totalKeluar = keluar.reduce((sum, t) => sum + t.total, 0)

    // Ambil data pendukung
    const [topSpareparts, movements] = await Promise.all([
      this.getTopSpareparts(10, period, date),
      this.getStockMovementsByPeriod(period, date, 50)
    ])

    // Helper untuk escape CSV field
    const escapeCSV = (value) => {
      const str = String(value ?? '')
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Bagian 1: Ringkasan
    const summaryHeaders = ['Ringkasan Laporan', 'Nilai']
    const summaryRows = [
      ['Periode', period.toUpperCase()],
      ['Total Transaksi', filtered.length],
      ['Total Barang Masuk', totalMasuk],
      ['Total Qty Masuk', masuk.reduce((sum, t) => sum + t.jumlah, 0)],
      ['Total Barang Keluar', totalKeluar],
      ['Total Qty Keluar', keluar.reduce((sum, t) => sum + t.jumlah, 0)],
      ['Selisih', totalMasuk - totalKeluar]
    ]

    // Bagian 2: Detail Transaksi
    const transHeaders = ['No. Transaksi', 'Tanggal', 'Tipe', 'Sparepart', 'Supplier', 'Jumlah', 'Harga Satuan', 'Total', 'Keterangan']
    const transRows = filtered.map(t => [
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

    // Bagian 3: Top Sparepart
    const topHeaders = ['Peringkat', 'Kode', 'Nama Sparepart', 'Total Qty', 'Total Nilai']
    const topRows = topSpareparts.map((sp, index) => [
      index + 1,
      sp.kode,
      sp.nama,
      sp.totalQty,
      sp.totalNilai
    ])

    // Bagian 4: Pergerakan Stok
    const movementHeaders = ['Tanggal', 'Sparepart', 'Tipe', 'Jumlah', 'Stok Sebelum', 'Stok Sesudah']
    const movementRows = movements.map(m => [
      new Date(m.tanggal).toLocaleDateString('id-ID'),
      m.sparepart?.nama || '',
      m.tipe,
      m.jumlah,
      m.stokSebelum,
      m.stokSesudah
    ])

    // Gabungkan semua bagian dengan baris kosong sebagai pemisah
    const csvParts = []
    csvParts.push(['RINGKASAN LAPORAN'])
    csvParts.push(summaryHeaders)
    csvParts.push(...summaryRows)
    csvParts.push([])
    csvParts.push(['DETAIL TRANSAKSI'])
    csvParts.push(transHeaders)
    csvParts.push(...transRows)
    csvParts.push([])
    csvParts.push(['SPAREPART TERLARIS'])
    csvParts.push(topHeaders)
    csvParts.push(...topRows)
    csvParts.push([])
    csvParts.push(['PERGERAKAN STOK'])
    csvParts.push(movementHeaders)
    csvParts.push(...movementRows)

    const csvContent = csvParts.map(row => row.map(escapeCSV).join(',')).join('\n')
    const periodLabel = period === 'harian' ? 'harian' : period === 'mingguan' ? 'mingguan' : period === 'bulanan' ? 'bulanan' : 'tahunan'
    const dateStr = date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)

    return {
      csvContent,
      filename: `laporan_${periodLabel}_${dateStr}.csv`
    }
  },

  // Riwayat transaksi per sparepart
  async getBySparepartId(sparepartId) {
    const all = await this.getAll()
    return all.filter(t => Number(t.sparepartId) === Number(sparepartId))
  }
}