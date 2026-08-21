import { db } from './database'
import { transactionService } from './transactionService'
import { formatRupiah } from '../utils/format'

// Durasi default garansi servis (hari) jika tidak ditentukan service package
const DEFAULT_SERVICE_WARRANTY_DAYS = 30

// Helper untuk generate nomor WO
function generateNomorWO(existingItems) {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const count = (existingItems || []).length + 1
  return `WO-${year}${month}${day}-${String(count).padStart(4, '0')}`
}

// Status constants
export const WO_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DELIVERED: 'DELIVERED'
}

export const WO_STATUS_LABELS = {
  [WO_STATUS.OPEN]: 'Terbuka',
  [WO_STATUS.IN_PROGRESS]: 'Dalam Proses',
  [WO_STATUS.ON_HOLD]: 'Ditunda',
  [WO_STATUS.COMPLETED]: 'Selesai',
  [WO_STATUS.CANCELLED]: 'Dibatalkan',
  [WO_STATUS.DELIVERED]: 'Diserahkan'
}

export const WO_STATUS_COLORS = {
  [WO_STATUS.OPEN]: 'bg-blue-100 text-blue-700',
  [WO_STATUS.IN_PROGRESS]: 'bg-yellow-100 text-yellow-700',
  [WO_STATUS.ON_HOLD]: 'bg-orange-100 text-orange-700',
  [WO_STATUS.COMPLETED]: 'bg-green-100 text-green-700',
  [WO_STATUS.CANCELLED]: 'bg-red-100 text-red-700',
  [WO_STATUS.DELIVERED]: 'bg-purple-100 text-purple-700'
}

export const workOrderService = {
  // Get all work orders with enriched data (customer, vehicle, mechanic, service package)
  async getAll() {
    const [workOrders, customers, vehicles, mechanics, servicePackages] = await Promise.all([
      db.getAll(db.keys.WORK_ORDERS),
      db.getAll(db.keys.CUSTOMERS),
      db.getAll(db.keys.VEHICLES),
      db.getAll(db.keys.MECHANICS),
      db.getAll(db.keys.SERVICE_PACKAGES)
    ])

    const customerMap = new Map(customers.map(c => [Number(c.id), c]))
    const vehicleMap = new Map(vehicles.map(v => [Number(v.id), v]))
    const mechanicMap = new Map(mechanics.map(m => [Number(m.id), m]))
    const packageMap = new Map(servicePackages.map(sp => [Number(sp.id), sp]))

    return workOrders.map(wo => ({
      ...wo,
      customer: customerMap.get(Number(wo.customerId)) || null,
      vehicle: vehicleMap.get(Number(wo.vehicleId)) || null,
      mechanic: mechanicMap.get(Number(wo.mechanicId)) || null,
      servicePackage: packageMap.get(Number(wo.servicePackageId)) || null
    })).sort((a, b) => new Date(b.tanggalMasuk) - new Date(a.tanggalMasuk))
  },

  async getById(id) {
    const wo = await db.getById(db.keys.WORK_ORDERS, id)
    if (!wo) return null

    const [customer, vehicle, mechanic, servicePackage, woItems, woLabor] = await Promise.all([
      db.getById(db.keys.CUSTOMERS, wo.customerId),
      db.getById(db.keys.VEHICLES, wo.vehicleId),
      db.getById(db.keys.MECHANICS, wo.mechanicId),
      db.getById(db.keys.SERVICE_PACKAGES, wo.servicePackageId),
      this.getWoItems(id),
      this.getWoLabor(id)
    ])

    return {
      ...wo,
      customer: customer || null,
      vehicle: vehicle || null,
      mechanic: mechanic || null,
      servicePackage: servicePackage || null,
      items: woItems,
      labor: woLabor
    }
  },

  async create(data) {
    const existing = await db.getAll(db.keys.WORK_ORDERS)
    const nomorWo = data.nomorWo || generateNomorWO(existing)

    // Hitung estimasi biaya (konversi eksplisit ke Number agar akurat)
    let estimasiBiaya = 0
    if (data.servicePackageId) {
      const pkg = await db.getById(db.keys.SERVICE_PACKAGES, data.servicePackageId)
      if (pkg) estimasiBiaya += Number(pkg.harga || 0)
    }
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const sparepart = await db.getById(db.keys.SPAREPARTS, item.sparepartId)
        if (sparepart) {
          const jumlah = Number(item.jumlah || 0)
          const hargaSatuan = Number(item.hargaSatuan ?? sparepart.hargaJual ?? 0)
          estimasiBiaya += jumlah * hargaSatuan
        }
      }
    }

    const newWO = await db.insert(db.keys.WORK_ORDERS, {
      ...data,
      nomorWo,
      estimasiBiaya,
      status: data.status || WO_STATUS.OPEN,
      tanggalMasuk: data.tanggalMasuk || new Date().toISOString(),
      totalBiaya: 0,
      totalLabor: 0,
      totalParts: 0
    })

    // Simpan wo_items jika ada (jumlah & harga dikonversi ke Number agar total akurat)
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const jumlah = Number(item.jumlah || 0)
        const hargaSatuan = Number(item.hargaSatuan || 0)
        await db.insert(db.keys.WO_ITEMS, {
          workOrderId: newWO.id,
          sparepartId: item.sparepartId,
          jumlah,
          hargaSatuan,
          total: jumlah * hargaSatuan,
          createdAt: new Date().toISOString()
        })
      }
    }

    // Simpan wo_labor jika ada (jam & tarif dikonversi ke Number agar total akurat)
    if (data.labor && data.labor.length > 0) {
      for (const lab of data.labor) {
        const jam = Number(lab.jam || 0)
        const tarifPerJam = Number(lab.tarifPerJam || 0)
        await db.insert(db.keys.WO_LABOR, {
          workOrderId: newWO.id,
          mechanicId: lab.mechanicId,
          jam,
          tarifPerJam,
          total: jam * tarifPerJam,
          keterangan: lab.keterangan || '',
          createdAt: new Date().toISOString()
        })
      }
    }

    return this.getById(newWO.id)
  },

  async update(id, data) {
    await db.update(db.keys.WORK_ORDERS, id, data)
    return this.getById(id)
  },

  async updateStatus(id, status, additionalData = {}) {
    const wo = await db.getById(db.keys.WORK_ORDERS, id)
    if (!wo) throw new Error('Work order tidak ditemukan')

    const prevStatus = wo.status
    const updateData = { status, ...additionalData }
    if (status === WO_STATUS.COMPLETED || status === WO_STATUS.DELIVERED) {
      if (status === WO_STATUS.COMPLETED && !additionalData.tanggalSelesai) {
        updateData.tanggalSelesai = new Date().toISOString()
      }
      if (status === WO_STATUS.DELIVERED && !additionalData.tanggalKirim) {
        updateData.tanggalKirim = new Date().toISOString()
      }
    }

    // Integrasi stok: kurangi stok sparepart saat WO selesai (COMPLETED/DELIVERED)
    const isFinishing = status === WO_STATUS.COMPLETED || status === WO_STATUS.DELIVERED
    const wasFinished = prevStatus === WO_STATUS.COMPLETED || prevStatus === WO_STATUS.DELIVERED

    if (isFinishing && !wasFinished && !wo.stokDiproses) {
      // Validasi ketersediaan stok SEMUA item dulu (all-or-nothing)
      // agar tidak terjadi pemotongan parsial jika satu item stoknya kurang
      const woItems = await this.getWoItems(wo.id)
      const itemsToProcess = woItems.filter(it => it.sparepartId && Number(it.jumlah || 0) > 0)
      const availability = await this.validateStockAvailability(itemsToProcess)
      const insufficient = availability.filter(a => !a.stokCukup)
      if (insufficient.length > 0) {
        const detail = insufficient.map(a => `${a.sparepart?.nama || 'Item'} (tersedia ${a.stokTersedia}, butuh ${Number(a.jumlah || 0)})`).join(', ')
        throw new Error(`Stok tidak mencukupi untuk menyelesaikan WO: ${detail}`)
      }
      await this.processStockDeduction(wo)
      updateData.stokDiproses = true
    }

    // Reversal stok jika WO yang sudah selesai dibatalkan
    if (status === WO_STATUS.CANCELLED && wasFinished && wo.stokDiproses) {
      await this.revertStockDeduction(wo)
      updateData.stokDiproses = false
    }

    // Auto-generate garansi saat WO selesai
    if (isFinishing && !wasFinished && !wo.garansiDibuat) {
      try {
        await this.generateWarranties({ ...wo, ...updateData })
        updateData.garansiDibuat = true
      } catch (error) {
        console.warn('Gagal generate garansi otomatis:', error)
      }
    }

    return this.update(id, updateData)
  },

  // Kurangi stok sparepart & buat transaksi barang keluar otomatis untuk semua item WO
  async processStockDeduction(wo) {
    const items = await this.getWoItems(wo.id)
    for (const item of items) {
      if (!item.sparepartId || !item.jumlah) continue
      await transactionService.barangKeluar({
        sparepartId: item.sparepartId,
        jumlah: item.jumlah,
        hargaSatuan: item.hargaSatuan,
        keterangan: `Pemakaian WO ${wo.nomorWo}`
      })
    }
  },

  // Kembalikan stok (reversal) jika WO selesai dibatalkan
  async revertStockDeduction(wo) {
    const items = await this.getWoItems(wo.id)
    for (const item of items) {
      if (!item.sparepartId || !item.jumlah) continue
      await transactionService.barangMasuk({
        sparepartId: item.sparepartId,
        jumlah: item.jumlah,
        hargaSatuan: item.hargaSatuan,
        keterangan: `Reversal WO ${wo.nomorWo} (dibatalkan)`
      })
    }
  },

  // Auto-generate garansi servis + garansi sparepart saat WO selesai
  async generateWarranties(wo) {
    const existing = await db.getAll(db.keys.WARRANTIES)
    const finishDate = new Date(wo.tanggalSelesai || new Date().toISOString())
    let count = existing.length

    // Garansi servis (default 30 hari dari tanggal selesai)
    const serviceEnd = new Date(finishDate.getTime() + DEFAULT_SERVICE_WARRANTY_DAYS * 24 * 60 * 60 * 1000)
    count += 1
    await db.insert(db.keys.WARRANTIES, {
      customerId: wo.customerId || null,
      vehicleId: wo.vehicleId || null,
      workOrderId: wo.id,
      sparepartId: null,
      jenis: 'SERVICE',
      judul: `Garansi Servis ${wo.nomorWo}`,
      deskripsi: `Garansi servis otomatis ${DEFAULT_SERVICE_WARRANTY_DAYS} hari sejak WO selesai`,
      tanggalMulai: finishDate.toISOString(),
      tanggalBerakhir: serviceEnd.toISOString(),
      status: 'AKTIF',
      createdAt: new Date().toISOString()
    })

    // Garansi sparepart berdasarkan kolom garansi_bulan di tabel spareparts
    const items = await this.getWoItems(wo.id)
    for (const item of items) {
      const sp = item.sparepart
      const bulan = Number(sp?.garansiBulan || 0)
      if (!sp || bulan <= 0) continue
      const end = new Date(finishDate)
      end.setMonth(end.getMonth() + bulan)
      count += 1
      await db.insert(db.keys.WARRANTIES, {
        customerId: wo.customerId || null,
        vehicleId: wo.vehicleId || null,
        workOrderId: wo.id,
        sparepartId: sp.id,
        jenis: 'SPAREPART',
        judul: `Garansi ${sp.nama}`,
        deskripsi: `Garansi sparepart ${bulan} bulan sejak dipasang pada ${wo.nomorWo}`,
        tanggalMulai: finishDate.toISOString(),
        tanggalBerakhir: end.toISOString(),
        status: 'AKTIF',
        createdAt: new Date().toISOString()
      })
    }

    return count
  },

  async delete(id) {
    const wo = await db.getById(db.keys.WORK_ORDERS, id)

    // Reversal stok jika WO sudah selesai (stok pernah dikurangi)
    if (wo && wo.stokDiproses) {
      try {
        await this.revertStockDeduction(wo)
      } catch (error) {
        console.warn('Gagal reversal stok saat hapus WO:', error)
      }
    }

    // Hapus wo_items dan wo_labor terkait
    const woItems = await db.getAll(db.keys.WO_ITEMS)
    for (const item of woItems) {
      if (Number(item.workOrderId) === Number(id)) {
        await db.remove(db.keys.WO_ITEMS, item.id)
      }
    }
    const woLabor = await db.getAll(db.keys.WO_LABOR)
    for (const lab of woLabor) {
      if (Number(lab.workOrderId) === Number(id)) {
        await db.remove(db.keys.WO_LABOR, lab.id)
      }
    }
    // Hapus invoice terkait
    const invoices = await db.getAll(db.keys.INVOICES)
    for (const inv of invoices) {
      if (Number(inv.workOrderId) === Number(id)) {
        await db.remove(db.keys.INVOICES, inv.id)
      }
    }
    await db.remove(db.keys.WORK_ORDERS, id)
    return true
  },

  // Get WO items (spareparts used)
  async getWoItems(workOrderId) {
    const [items, spareparts] = await Promise.all([
      db.getAll(db.keys.WO_ITEMS),
      db.getAll(db.keys.SPAREPARTS)
    ])
    const sparepartMap = new Map(spareparts.map(sp => [Number(sp.id), sp]))
    return items
      .filter(item => Number(item.workOrderId) === Number(workOrderId))
      .map(item => ({
        ...item,
        sparepart: sparepartMap.get(Number(item.sparepartId)) || null
      }))
  },

  // Get WO labor entries
  async getWoLabor(workOrderId) {
    const [labor, mechanics] = await Promise.all([
      db.getAll(db.keys.WO_LABOR),
      db.getAll(db.keys.MECHANICS)
    ])
    const mechanicMap = new Map(mechanics.map(m => [Number(m.id), m]))
    return labor
      .filter(lab => Number(lab.workOrderId) === Number(workOrderId))
      .map(lab => ({
        ...lab,
        mechanic: mechanicMap.get(Number(lab.mechanicId)) || null
      }))
  },

  // Validasi ketersediaan stok untuk daftar item WO
  // Mengembalikan array item dengan flag stokCukup & stokTersedia
  async validateStockAvailability(items = []) {
    const spareparts = await db.getAll(db.keys.SPAREPARTS)
    const sparepartMap = new Map(spareparts.map(sp => [Number(sp.id), sp]))
    return items.map(item => {
      const sp = sparepartMap.get(Number(item.sparepartId))
      const tersedia = Number(sp?.stok || 0)
      return {
        ...item,
        stokTersedia: tersedia,
        stokCukup: tersedia >= Number(item.jumlah || 0)
      }
    })
  },

  // Add item to work order
  async addItem(workOrderId, item) {
    // Validasi stok tersedia sebelum menambahkan item ke WO
    const sparepart = await db.getById(db.keys.SPAREPARTS, item.sparepartId)
    if (!sparepart) throw new Error('Sparepart tidak ditemukan')
    const jumlah = Number(item.jumlah || 0)
    const hargaSatuan = Number(item.hargaSatuan ?? sparepart.hargaJual ?? 0)
    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      throw new Error('Jumlah harus lebih dari 0')
    }
    if (Number(sparepart.stok || 0) < jumlah) {
      throw new Error(`Stok ${sparepart.nama} tidak mencukupi. Stok tersedia: ${sparepart.stok}`)
    }

    const newItem = await db.insert(db.keys.WO_ITEMS, {
      workOrderId,
      sparepartId: item.sparepartId,
      jumlah,
      hargaSatuan,
      total: jumlah * hargaSatuan,
      createdAt: new Date().toISOString()
    })
    await this.recalculateTotals(workOrderId)
    return newItem
  },

  // Add labor to work order
  async addLabor(workOrderId, labor) {
    const jam = Number(labor.jam || 0)
    const tarifPerJam = Number(labor.tarifPerJam || 0)
    if (!Number.isFinite(jam) || jam <= 0) {
      throw new Error('Jumlah jam harus lebih dari 0')
    }
    const newLabor = await db.insert(db.keys.WO_LABOR, {
      workOrderId,
      mechanicId: labor.mechanicId,
      jam,
      tarifPerJam,
      total: jam * tarifPerJam,
      keterangan: labor.keterangan || '',
      createdAt: new Date().toISOString()
    })
    await this.recalculateTotals(workOrderId)
    return newLabor
  },

  // Remove item from work order
  async removeItem(itemId) {
    const item = await db.getById(db.keys.WO_ITEMS, itemId)
    if (!item) throw new Error('Item tidak ditemukan')
    await db.remove(db.keys.WO_ITEMS, itemId)
    await this.recalculateTotals(item.workOrderId)
    return true
  },

  // Remove labor from work order
  async removeLabor(laborId) {
    const labor = await db.getById(db.keys.WO_LABOR, laborId)
    if (!labor) throw new Error('Labor tidak ditemukan')
    await db.remove(db.keys.WO_LABOR, laborId)
    await this.recalculateTotals(labor.workOrderId)
    return true
  },

  // Recalculate totals for a work order
  // Total per baris dihitung ulang dari jumlah × harga/jam × tarif agar selalu konsisten,
  // dengan fallback ke nilai `total` tersimpan jika komponennya tidak lengkap
  async recalculateTotals(workOrderId) {
    const [items, labor] = await Promise.all([
      this.getWoItems(workOrderId),
      this.getWoLabor(workOrderId)
    ])

    const lineTotal = (row) => {
      const qty = Number(row.jumlah ?? row.jam ?? 0)
      const rate = Number(row.hargaSatuan ?? row.tarifPerJam ?? 0)
      if (qty !== 0 && rate !== 0) return qty * rate
      return Number(row.total || 0)
    }

    const totalParts = items.reduce((sum, item) => sum + lineTotal(item), 0)
    const totalLabor = labor.reduce((sum, lab) => sum + lineTotal(lab), 0)
    const totalBiaya = totalParts + totalLabor

    await db.update(db.keys.WORK_ORDERS, workOrderId, {
      totalParts,
      totalLabor,
      totalBiaya
    })

    return { totalParts, totalLabor, totalBiaya }
  },

  // ---- Metode murni sinkron ----
  search(query, items = []) {
    const q = (query || '').toLowerCase()
    if (!q) return items
    return items.filter(wo =>
      (wo.nomorWo || '').toLowerCase().includes(q) ||
      ((wo.customer && wo.customer.nama) || '').toLowerCase().includes(q) ||
      ((wo.vehicle && wo.vehicle.platNomor) || '').toLowerCase().includes(q) ||
      ((wo.mechanic && wo.mechanic.nama) || '').toLowerCase().includes(q) ||
      ((wo.servicePackage && wo.servicePackage.nama) || '').toLowerCase().includes(q) ||
      (wo.keluhan || '').toLowerCase().includes(q)
    )
  },

  filterByStatus(status, items = []) {
    if (!status || status === 'ALL') return items
    return items.filter(wo => wo.status === status)
  },

  getStatusStats(items = []) {
    const stats = {}
    Object.values(WO_STATUS).forEach(s => {
      stats[s] = items.filter(wo => wo.status === s).length
    })
    return stats
  },

  // Get work order history for a vehicle
  async getHistoryByVehicle(vehicleId) {
    const all = await this.getAll()
    return all.filter(wo => Number(wo.vehicleId) === Number(vehicleId))
      .sort((a, b) => new Date(b.tanggalMasuk) - new Date(a.tanggalMasuk))
  },

  // Get work order history for a customer
  async getHistoryByCustomer(customerId) {
    const all = await this.getAll()
    return all.filter(wo => Number(wo.customerId) === Number(customerId))
      .sort((a, b) => new Date(b.tanggalMasuk) - new Date(a.tanggalMasuk))
  },

  // Get recent work orders
  async getRecent(limit = 10) {
    const all = await this.getAll()
    return all.slice(0, limit)
  },

  // Get stats for dashboard
  async getStats() {
    const workOrders = await this.getAll()
    const statusStats = this.getStatusStats(workOrders)
    const totalWO = workOrders.length
    const totalCompleted = statusStats[WO_STATUS.COMPLETED] + statusStats[WO_STATUS.DELIVERED]
    const totalRevenue = workOrders
      .filter(wo => wo.status === WO_STATUS.COMPLETED || wo.status === WO_STATUS.DELIVERED)
      .reduce((sum, wo) => sum + Number(wo.totalBiaya || 0), 0)
    const totalEstimasi = workOrders
      .filter(wo => wo.status === WO_STATUS.OPEN || wo.status === WO_STATUS.IN_PROGRESS)
      .reduce((sum, wo) => sum + Number(wo.estimasiBiaya || 0), 0)


    return {
      totalWO,
      totalCompleted,
      totalRevenue,
      totalEstimasi,
      statusStats
    }
  },

  // Export to CSV
  exportToCSV(items = []) {
    const headers = ['No. WO', 'Tanggal Masuk', 'Pelanggan', 'Kendaraan', 'Mekanik', 'Service', 'Keluhan', 'Estimasi', 'Total', 'Status']
    const rows = items.map(wo => [
      wo.nomorWo || '',
      wo.tanggalMasuk ? new Date(wo.tanggalMasuk).toLocaleDateString('id-ID') : '',
      wo.customer?.nama || '',
      wo.vehicle ? `${wo.vehicle.merk || ''} ${wo.vehicle.tipe || ''}` : '',
      wo.mechanic?.nama || '',
      wo.servicePackage?.nama || '',
      wo.keluhan || '',
      formatRupiah(wo.estimasiBiaya || 0),
      formatRupiah(wo.totalBiaya || 0),
      WO_STATUS_LABELS[wo.status] || wo.status
    ])
    return { headers, rows, filename: `work_orders_${new Date().toISOString().slice(0, 10)}.csv` }
  }
}
