import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============================================================
// Mock layer database in-memory agar logika perhitungan service
// dapat diuji secara terisolasi tanpa koneksi Supabase.
// Simulasi data bisa berupa STRING (seperti input user/localStorage)
// untuk memastikan semua hitungan tetap akurat.
// ============================================================

const tables = {}

function seedTable(name, rows = []) {
  tables[name] = [...rows]
}

vi.mock('../src/services/database', () => {
  let nextId = 1000
  const genId = () => ++nextId

  return {
    db: {
      keys: {
        SPAREPARTS: 'spareparts',
        SUPPLIERS: 'suppliers',
        TRANSACTIONS: 'transactions',
        STOCK_MOVEMENTS: 'stock_movements',
        CUSTOMERS: 'customers',
        VEHICLES: 'vehicles',
        MECHANICS: 'mechanics',
        SERVICE_PACKAGES: 'service_packages',
        WORK_ORDERS: 'work_orders',
        WO_ITEMS: 'wo_items',
        WO_LABOR: 'wo_labor',
        WARRANTIES: 'warranties',
        INVOICES: 'invoices',
        INVOICE_PAYMENTS: 'invoice_payments',
        RETURNS: 'returns',
        STOCK_OPNAMES: 'stock_opnames',
        STOCK_OPNAME_ITEMS: 'stock_opname_items'
      },
      async getAll(table) {
        return [...(tables[table] || [])]
      },
      async getById(table, id) {
        return (tables[table] || []).find(r => Number(r.id) === Number(id)) || null
      },
      async insert(table, data) {
        const row = { ...data, id: genId() }
        ;(tables[table] = tables[table] || []).push(row)
        return { ...row }
      },
      async update(table, id, data) {
        const list = tables[table] || []
        const idx = list.findIndex(r => Number(r.id) === Number(id))
        if (idx === -1) throw new Error('Data tidak ditemukan')
        list[idx] = { ...list[idx], ...data }
        return { ...list[idx] }
      },
      async remove(table, id) {
        tables[table] = (tables[table] || []).filter(r => Number(r.id) !== Number(id))
        return true
      },
      getAllUsers: async () => [],
      findUserByUsername: async () => null,
      clearCache: () => {},
      changeEvent: 'db-updated',
      syncEvent: 'db-sync-status',
      isSupabaseAvailable: () => true,
      initRealtime: () => {},
      removeAllRealtime: () => {},
      flushPendingOps: async () => {},
      getPendingOps: () => [],
      setPendingOps: () => {},
      checkConnection: async () => true
    }
  }
})

import { transactionService } from '../src/services/transactionService'
import { invoiceService, INVOICE_STATUS } from '../src/services/invoiceService'
import { workOrderService } from '../src/services/workOrderService'
import { stockOpnameService } from '../src/services/stockOpnameService'
import { returnService } from '../src/services/returnService'

beforeEach(() => {
  // Reset seluruh tabel mock sebelum tiap test
  Object.keys(tables).forEach(k => delete tables[k])
})

describe('Perhitungan Stok - Barang Masuk', () => {
  it('stok bertambah akurat meski stok lama berupa string ("5" + 10 = 15, bukan "510")', async () => {
    seedTable('spareparts', [
      { id: 1, nama: 'Filter Oli', stok: '5', hargaBeli: '50000', hargaJual: 75000 }
    ])

    await transactionService.barangMasuk({
      sparepartId: 1,
      jumlah: 10,
      hargaSatuan: 50000
    })

    const sp = tables.spareparts[0]
    expect(Number(sp.stok)).toBe(15)
  })

  it('total transaksi = harga satuan × jumlah dengan tepat', async () => {
    seedTable('spareparts', [{ id: 1, nama: 'Busi', stok: 0, hargaBeli: 25000 }])

    const trx = await transactionService.barangMasuk({
      sparepartId: 1,
      jumlah: 4,
      hargaSatuan: 25500
    })

    expect(trx.total).toBe(102000)
    expect(trx.jumlah).toBe(4)
    expect(trx.hargaSatuan).toBe(25500)
  })

  it('harga default memakai hargaBeli sparepart jika tidak dikirim', async () => {
    seedTable('spareparts', [{ id: 1, nama: 'Oli', stok: 2, hargaBeli: 80000 }])

    const trx = await transactionService.barangMasuk({ sparepartId: 1, jumlah: 3 })

    expect(trx.hargaSatuan).toBe(80000)
    expect(trx.total).toBe(240000)
  })

  it('pergerakan stok mencatat stokSebelum/stokSesudah yang benar', async () => {
    seedTable('spareparts', [{ id: 1, nama: 'Kampas Rem', stok: '7', hargaBeli: 100000 }])

    await transactionService.barangMasuk({ sparepartId: 1, jumlah: 5, hargaSatuan: 100000 })

    const mv = tables.stock_movements[0]
    expect(Number(mv.stokSebelum)).toBe(7)
    expect(Number(mv.stokSesudah)).toBe(12)
    expect(Number(mv.jumlah)).toBe(5)
  })

  it('menolak jumlah <= 0', async () => {
    seedTable('spareparts', [{ id: 1, nama: 'X', stok: 1, hargaBeli: 1000 }])
    await expect(transactionService.barangMasuk({ sparepartId: 1, jumlah: 0 })).rejects.toThrow()
    await expect(transactionService.barangMasuk({ sparepartId: 1, jumlah: -3 })).rejects.toThrow()
  })
})

describe('Perhitungan Stok - Barang Keluar', () => {
  it('stok berkurang akurat dan validasi stok menggunakan perbandingan numerik', async () => {
    // stok "9" vs jumlah 10 -> harus ditolak (string comparison "9" < "10" adalah false!)
    seedTable('spareparts', [{ id: 1, nama: 'Aki', stok: '9', hargaJual: 900000 }])

    await expect(
      transactionService.barangKeluar({ sparepartId: 1, jumlah: 10 })
    ).rejects.toThrow(/Stok tidak mencukupi/)

    // stok cukup -> berhasil, stok tersisa akurat
    const trx = await transactionService.barangKeluar({ sparepartId: 1, jumlah: 4 })
    expect(trx.total).toBe(3600000)
    expect(Number(tables.spareparts[0].stok)).toBe(5)
  })

  it('total barang keluar = harga jual × jumlah', async () => {
    seedTable('spareparts', [{ id: 1, nama: 'Ban', stok: 10, hargaJual: 450000 }])
    const trx = await transactionService.barangKeluar({ sparepartId: 1, jumlah: 2 })
    expect(trx.total).toBe(900000)
  })
})

describe('Perhitungan Stok - Hapus Transaksi (Reversal)', () => {
  it('hapus transaksi MASUK mengembalikan stok dengan akurat', async () => {
    seedTable('spareparts', [{ id: 1, nama: 'Oli', stok: 20, hargaBeli: 80000 }])
    const trx = await transactionService.barangMasuk({ sparepartId: 1, jumlah: 5, hargaSatuan: 80000 })
    expect(Number(tables.spareparts[0].stok)).toBe(25)

    await transactionService.deleteTransaction(trx.id)
    expect(Number(tables.spareparts[0].stok)).toBe(20)
    expect(tables.transactions.length).toBe(0)
  })

  it('hapus transaksi KELUAR mengembalikan stok dengan akurat', async () => {
    seedTable('spareparts', [{ id: 1, nama: 'Oli', stok: 20, hargaJual: 95000 }])
    const trx = await transactionService.barangKeluar({ sparepartId: 1, jumlah: 6 })
    expect(Number(tables.spareparts[0].stok)).toBe(14)

    await transactionService.deleteTransaction(trx.id)
    expect(Number(tables.spareparts[0].stok)).toBe(20)
  })
})

describe('Statistik & Laporan Transaksi', () => {
  it('getStats menjumlahkan total & qty dengan akurat dari data string', async () => {
    seedTable('spareparts', [
      { id: 1, nama: 'A', stok: 50, hargaBeli: 10000, hargaJual: 20000 },
      { id: 2, nama: 'B', stok: 50, hargaBeli: 10000, hargaJual: 30000 }
    ])
    await transactionService.barangMasuk({ sparepartId: 1, jumlah: 2, hargaSatuan: 10000 }) // total 20000
    await transactionService.barangMasuk({ sparepartId: 2, jumlah: 3, hargaSatuan: 15000 }) // total 45000
    await transactionService.barangKeluar({ sparepartId: 1, jumlah: 1, hargaSatuan: 20000 }) // total 20000

    const stats = await transactionService.getStats()
    expect(stats.totalQtyMasuk).toBe(5)
    expect(stats.totalQtyKeluar).toBe(1)
    expect(stats.totalMasuk).toBe(65000)
    expect(stats.totalKeluar).toBe(20000)
    expect(stats.selisih).toBe(45000)
  })

  it('getTopSpareparts mengagregasi qty & nilai keluar dengan akurat', async () => {
    seedTable('spareparts', [
      { id: 1, nama: 'A', kode: 'A-01', stok: 100, hargaJual: 20000 },
      { id: 2, nama: 'B', kode: 'B-01', stok: 100, hargaJual: 30000 }
    ])
    await transactionService.barangKeluar({ sparepartId: 1, jumlah: 2 }) // 40000
    await transactionService.barangKeluar({ sparepartId: 1, jumlah: 3 }) // 60000
    await transactionService.barangKeluar({ sparepartId: 2, jumlah: 1 }) // 30000

    const top = await transactionService.getTopSpareparts(5)
    expect(top[0].sparepartId).toBe(1)
    expect(top[0].totalQty).toBe(5)
    expect(top[0].totalNilai).toBe(100000)
    expect(top[1].totalQty).toBe(1)
    expect(top[1].totalNilai).toBe(30000)
  })
})

describe('Perhitungan Invoice', () => {
  it('create: grandTotal = totalBiaya - diskon + pajak, sisaBayar konsisten', async () => {
    const inv = await invoiceService.create({
      totalBiaya: 1000000,
      diskon: 150000,
      pajak: 110000,
      customerId: 1,
      vehicleId: 1,
      workOrderId: 1
    })

    expect(inv.grandTotal).toBe(960000)
    expect(inv.jumlahDibayar).toBe(0)
    expect(inv.sisaBayar).toBe(960000)
    expect(inv.status).toBe(INVOICE_STATUS.PENDING)
  })

  it('create: status PAID jika dibayar penuh di awal', async () => {
    const inv = await invoiceService.create({
      totalBiaya: 500000,
      diskon: 0,
      pajak: 0,
      jumlahDibayar: 500000
    })
    expect(inv.status).toBe(INVOICE_STATUS.PAID)
    expect(inv.sisaBayar).toBe(0)
  })

  it('addPayment parsial: akumulasi dibayar & sisa akurat tanpa selisih', async () => {
    const inv = await invoiceService.create({
      totalBiaya: 1000000, diskon: 0, pajak: 0
    })

    await invoiceService.addPayment(inv.id, { jumlah: 400000 })
    let updated = await invoiceService.getById(inv.id)
    expect(updated.jumlahDibayar).toBe(400000)
    expect(updated.sisaBayar).toBe(600000)
    expect(updated.status).toBe(INVOICE_STATUS.PARTIAL)

    await invoiceService.addPayment(inv.id, { jumlah: 350000 })
    updated = await invoiceService.getById(inv.id)
    expect(updated.jumlahDibayar).toBe(750000)
    expect(updated.sisaBayar).toBe(250000)

    // Riwayat pembayaran tersimpan lengkap di tabel invoice_payments
    const payments = await invoiceService.getPayments(inv.id)
    expect(payments.length).toBe(2)
    expect(payments.reduce((s, p) => s + Number(p.jumlah), 0)).toBe(750000)
  })

  it('addPayment menolak pembayaran melebihi sisa tagihan', async () => {
    const inv = await invoiceService.create({ totalBiaya: 100000 })
    await expect(invoiceService.addPayment(inv.id, { jumlah: 150000 })).rejects.toThrow(/melebihi/)
  })

  it('markAsPaid melunasi sisa dengan tepat & mencatat riwayat pelunasan', async () => {
    const inv = await invoiceService.create({ totalBiaya: 1000000 })
    await invoiceService.addPayment(inv.id, { jumlah: 600000 })

    await invoiceService.markAsPaid(inv.id)
    const final = await invoiceService.getById(inv.id)
    expect(final.jumlahDibayar).toBe(1000000)
    expect(final.sisaBayar).toBe(0)
    expect(final.status).toBe(INVOICE_STATUS.PAID)

    const payments = await invoiceService.getPayments(inv.id)
    expect(payments.reduce((s, p) => s + Number(p.jumlah), 0)).toBe(1000000)
  })

  it('update: sisaBayar & status dihitung ulang saat grandTotal berubah (bug fix)', async () => {
    const inv = await invoiceService.create({
      totalBiaya: 1000000, diskon: 0, pajak: 0
    })
    await invoiceService.addPayment(inv.id, { jumlah: 400000 })
    // sisa = 600000

    // Diskon dinaikkan sehingga grandTotal turun menjadi 900000 -> sisa harus 500000
    await invoiceService.update(inv.id, { diskon: 100000 })
    let updated = await invoiceService.getById(inv.id)
    expect(updated.grandTotal).toBe(900000)
    expect(updated.sisaBayar).toBe(500000)
    expect(updated.status).toBe(INVOICE_STATUS.PARTIAL)

    // Diskon dinaikkan lagi hingga grandTotal 400000 == dibayar -> otomatis LUNAS
    await invoiceService.update(inv.id, { diskon: 600000 })
    updated = await invoiceService.getById(inv.id)
    expect(updated.grandTotal).toBe(400000)
    expect(updated.sisaBayar).toBe(0)
    expect(updated.status).toBe(INVOICE_STATUS.PAID)
  })

  it('getTotalRevenue & getTotalOutstanding akurat', async () => {
    await invoiceService.create({ totalBiaya: 1000000, diskon: 0, pajak: 0 }) // pending
    const inv2 = await invoiceService.create({ totalBiaya: 500000, diskon: 0, pajak: 0 })
    await invoiceService.markAsPaid(inv2.id) // paid
    const inv3 = await invoiceService.create({ totalBiaya: 800000, diskon: 0, pajak: 0 })
    await invoiceService.addPayment(inv3.id, { jumlah: 300000 }) // partial, sisa 500000

    const all = await invoiceService.getAll()
    expect(invoiceService.getTotalRevenue(all)).toBe(500000)
    // Outstanding = inv1 pending (sisa 1.000.000) + inv3 partial (sisa 500.000)
    expect(invoiceService.getTotalOutstanding(all)).toBe(1500000)
  })

  it('generateFromWorkOrder menyalin total WO dengan akurat', async () => {
    seedTable('work_orders', [{
      id: 7, nomorWo: 'WO-X', customerId: 1, vehicleId: 1,
      totalLabor: 200000, totalParts: 300000, totalBiaya: 500000
    }])

    const inv = await invoiceService.generateFromWorkOrder(7)
    expect(inv.totalLabor).toBe(200000)
    expect(inv.totalParts).toBe(300000)
    expect(inv.totalBiaya).toBe(500000)
    expect(inv.grandTotal).toBe(500000)
    expect(inv.sisaBayar).toBe(500000)
    expect(inv.status).toBe(INVOICE_STATUS.PENDING)
  })
})

describe('Perhitungan Work Order', () => {
  beforeEach(() => {
    seedTable('mechanics', [
      { id: 1, nama: 'Mekanik A', tarifPerJam: 50000, status: 'AKTIF' },
      { id: 2, nama: 'Mekanik B', tarifPerJam: 75000, status: 'AKTIF' }
    ])
    seedTable('spareparts', [
      { id: 1, nama: 'Filter', stok: 10, hargaJual: 50000, hargaBeli: 35000 },
      { id: 2, nama: 'Busi', stok: 4, hargaJual: 25000, hargaBeli: 18000 }
    ])
  })

  it('addItem: total item = jumlah × hargaSatuan & totalParts/totalBiaya terhitung ulang', async () => {
    const wo = await workOrderService.create({ customerId: 1, vehicleId: 1 })
    expect(wo.totalBiaya).toBe(0)

    await workOrderService.addItem(wo.id, { sparepartId: 1, jumlah: 2, hargaSatuan: 50000 })
    await workOrderService.addItem(wo.id, { sparepartId: 2, jumlah: 4, hargaSatuan: 25000 })

    const detail = await workOrderService.getById(wo.id)
    expect(detail.items.length).toBe(2)
    expect(detail.totalParts).toBe(200000) // 100000 + 100000
    expect(detail.totalLabor).toBe(0)
    expect(detail.totalBiaya).toBe(200000)
  })

  it('addLabor: total labor = jam × tarifPerJam & totalBiaya = parts + labor', async () => {
    const wo = await workOrderService.create({ customerId: 1, vehicleId: 1 })

    await workOrderService.addItem(wo.id, { sparepartId: 1, jumlah: 1, hargaSatuan: 50000 })
    await workOrderService.addLabor(wo.id, { mechanicId: 1, jam: 2, tarifPerJam: 50000 })
    await workOrderService.addLabor(wo.id, { mechanicId: 2, jam: 1.5, tarifPerJam: 75000 })

    const detail = await workOrderService.getById(wo.id)
    expect(detail.totalParts).toBe(50000)
    expect(detail.totalLabor).toBe(212500) // 100000 + 112500
    expect(detail.totalBiaya).toBe(262500)
  })

  it('removeItem/removeLabor menghitung ulang total dengan akurat', async () => {
    const wo = await workOrderService.create({ customerId: 1, vehicleId: 1 })
    await workOrderService.addItem(wo.id, { sparepartId: 1, jumlah: 2, hargaSatuan: 50000 })
    await workOrderService.addItem(wo.id, { sparepartId: 2, jumlah: 1, hargaSatuan: 25000 })
    await workOrderService.addLabor(wo.id, { mechanicId: 1, jam: 1, tarifPerJam: 50000 })

    const before = await workOrderService.getById(wo.id)
    expect(before.totalBiaya).toBe(175000)

    const firstItem = before.items.find(i => i.sparepartId === 1)
    await workOrderService.removeItem(firstItem.id)

    const after = await workOrderService.getById(wo.id)
    expect(after.totalParts).toBe(25000)
    expect(after.totalBiaya).toBe(75000)
  })

  it('addItem menolak jika stok tidak cukup', async () => {
    const wo = await workOrderService.create({ customerId: 1, vehicleId: 1 })
    await expect(
      workOrderService.addItem(wo.id, { sparepartId: 2, jumlah: 99, hargaSatuan: 25000 })
    ).rejects.toThrow(/tidak mencukupi/)
  })

  it('updateStatus COMPLETED memotong stok & membuat transaksi barang keluar (integrasi)', async () => {
    const wo = await workOrderService.create({ customerId: 1, vehicleId: 1 })
    await workOrderService.addItem(wo.id, { sparepartId: 1, jumlah: 3, hargaSatuan: 50000 })

    await workOrderService.updateStatus(wo.id, 'COMPLETED')

    // Stok berkurang 10 -> 7
    const sp = tables.spareparts.find(s => s.id === 1)
    expect(Number(sp.stok)).toBe(7)

    // Transaksi barang keluar otomatis tercipta dengan total benar
    const bk = tables.transactions.find(t => t.tipe === 'KELUAR')
    expect(bk).toBeTruthy()
    expect(Number(bk.jumlah)).toBe(3)
    expect(Number(bk.total)).toBe(150000)

    // Pergerakan stok tercatat
    const mv = tables.stock_movements.find(m => m.tipe === 'KELUAR')
    expect(mv).toBeTruthy()
    expect(Number(mv.stokSebelum)).toBe(10)
    expect(Number(mv.stokSesudah)).toBe(7)
  })

  it('updateStatus COMPLETED ditolak all-or-nothing jika satu item stok kurang', async () => {
    const wo = await workOrderService.create({ customerId: 1, vehicleId: 1 })
    await workOrderService.addItem(wo.id, { sparepartId: 1, jumlah: 2, hargaSatuan: 50000 }) // stok 10 OK
    // Tambahkan item manual melewati addItem (simulasi item lama) dengan jumlah > stok busi (4)
    await tables.wo_items.push({
      id: 999, workOrderId: wo.id, sparepartId: 2, jumlah: 10, hargaSatuan: 25000, total: 250000
    })

    await expect(workOrderService.updateStatus(wo.id, 'COMPLETED')).rejects.toThrow(/Stok tidak mencukupi/)

    // Tidak ada stok yang berkurang sama sekali (all-or-nothing)
    expect(Number(tables.spareparts.find(s => s.id === 1).stok)).toBe(10)
    expect((tables.transactions || []).filter(t => t.tipe === 'KELUAR').length).toBe(0)
  })

  it('pembatalan WO selesai melakukan reversal stok dengan akurat', async () => {
    const wo = await workOrderService.create({ customerId: 1, vehicleId: 1 })
    await workOrderService.addItem(wo.id, { sparepartId: 1, jumlah: 3, hargaSatuan: 50000 })
    await workOrderService.updateStatus(wo.id, 'COMPLETED')
    expect(Number(tables.spareparts.find(s => s.id === 1).stok)).toBe(7)

    await workOrderService.updateStatus(wo.id, 'CANCELLED')
    expect(Number(tables.spareparts.find(s => s.id === 1).stok)).toBe(10)
  })

  it('recalculateTotals konsisten: totalBiaya = totalParts + totalLabor', async () => {
    const wo = await workOrderService.create({ customerId: 1, vehicleId: 1 })
    await workOrderService.addItem(wo.id, { sparepartId: 1, jumlah: 2, hargaSatuan: 50000 })
    await workOrderService.addLabor(wo.id, { mechanicId: 1, jam: 3, tarifPerJam: 50000 })

    const result = await workOrderService.recalculateTotals(wo.id)
    expect(result.totalParts).toBe(100000)
    expect(result.totalLabor).toBe(150000)
    expect(result.totalBiaya).toBe(250000)
    expect(result.totalBiaya).toBe(result.totalParts + result.totalLabor)
  })
})

describe('Perhitungan Stock Opname', () => {
  it('selisih & nilaiSelisih dihitung akurat (fisik - sistem) × harga beli', async () => {
    seedTable('spareparts', [
      { id: 1, nama: 'Oli', kategori: 'Pelumas', stok: 10, hargaBeli: 80000, hargaJual: 95000 }
    ])

    const opname = await stockOpnameService.create({ namaPetugas: 'Tester' })
    const items = await stockOpnameService.getItems(opname.id)
    expect(items.length).toBe(1)
    expect(items[0].stokSistem).toBe(10)

    // Hitung fisik = 8 -> selisih -2, nilai selisih = -160000
    await stockOpnameService.updateItem(items[0].id, { stokFisik: 8 })
    const after = await stockOpnameService.getItems(opname.id)
    expect(after[0].selisih).toBe(-2)
    expect(after[0].nilaiSelisih).toBe(-160000)

    const refreshed = await stockOpnameService.getById(opname.id)
    expect(refreshed.totalSelisih).toBe(-2)
    expect(refreshed.totalNilaiSelisih).toBe(-160000)
  })

  it('finalize menyesuaikan stok sistem ke hasil fisik & catat pergerakan', async () => {
    seedTable('spareparts', [
      { id: 1, nama: 'Oli', kategori: '', stok: 10, hargaBeli: 80000 }
    ])

    const opname = await stockOpnameService.create({})
    const items = await stockOpnameService.getItems(opname.id)
    await stockOpnameService.updateItem(items[0].id, { stokFisik: 13 })

    const adjusted = await stockOpnameService.finalize(opname.id)
    expect(adjusted).toBe(1)
    expect(Number(tables.spareparts[0].stok)).toBe(13)

    const mv = tables.stock_movements[0]
    expect(mv.tipe).toBe('MASUK')
    expect(Number(mv.jumlah)).toBe(3)
    expect(Number(mv.stokSebelum)).toBe(10)
    expect(Number(mv.stokSesudah)).toBe(13)
  })
})

describe('Perhitungan Retur', () => {
  it('create: total retur = jumlah × hargaSatuan', async () => {
    seedTable('spareparts', [{ id: 1, nama: 'Oli', stok: 10, hargaBeli: 80000, supplierId: 1 }])

    const retur = await returnService.create({
      tipe: 'KE_SUPPLIER',
      sparepartId: 1,
      jumlah: 3,
      hargaSatuan: 80000
    })

    expect(retur.total).toBe(240000)
    expect(retur.status).toBe('PENDING')
  })

  it('approve retur KE_SUPPLIER mengurangi stok via barang keluar', async () => {
    seedTable('spareparts', [{ id: 1, nama: 'Oli', stok: 10, hargaBeli: 80000 }])

    const retur = await returnService.create({
      tipe: 'KE_SUPPLIER', sparepartId: 1, jumlah: 2, hargaSatuan: 80000
    })
    await returnService.approve(retur.id)

    expect(Number(tables.spareparts[0].stok)).toBe(8)
    const bk = tables.transactions.find(t => t.tipe === 'KELUAR')
    expect(bk).toBeTruthy()
    expect(Number(bk.total)).toBe(160000)
  })

  it('approve retur DARI_CUSTOMER menambah stok via barang masuk', async () => {
    seedTable('spareparts', [{ id: 1, nama: 'Oli', stok: 10, hargaBeli: 80000 }])

    const retur = await returnService.create({
      tipe: 'DARI_CUSTOMER', sparepartId: 1, jumlah: 2, hargaSatuan: 80000
    })
    await returnService.approve(retur.id)

    expect(Number(tables.spareparts[0].stok)).toBe(12)
    const bm = tables.transactions.find(t => t.tipe === 'MASUK')
    expect(bm).toBeTruthy()
    expect(Number(bm.total)).toBe(160000)
  })

  it('approve menolak jika stok tidak cukup untuk retur ke supplier', async () => {
    seedTable('spareparts', [{ id: 1, nama: 'Oli', stok: 1, hargaBeli: 80000 }])
    const retur = await returnService.create({
      tipe: 'KE_SUPPLIER', sparepartId: 1, jumlah: 5, hargaSatuan: 80000
    }).catch(() => null)
    // create juga sudah divalidasi; jika lolos (mis. stok berubah), approve harus menolak
    if (retur) {
      tables.spareparts[0].stok = 1
      await expect(returnService.approve(retur.id)).rejects.toThrow(/Stok tidak mencukupi/)
    }
  })
})

describe('Integrasi antar modul (WO -> Invoice -> Pembayaran)', () => {
  it('alur lengkap: WO selesai -> invoice -> bayar parsial -> lunas, semua angka konsisten', async () => {
    seedTable('mechanics', [{ id: 1, nama: 'Mek', tarifPerJam: 50000, status: 'AKTIF' }])
    seedTable('spareparts', [{ id: 1, nama: 'Filter', stok: 10, hargaJual: 50000, hargaBeli: 35000 }])

    // 1. Buat WO + item + jasa
    const wo = await workOrderService.create({ customerId: 1, vehicleId: 1 })
    await workOrderService.addItem(wo.id, { sparepartId: 1, jumlah: 2, hargaSatuan: 50000 })   // 100000
    await workOrderService.addLabor(wo.id, { mechanicId: 1, jam: 2, tarifPerJam: 50000 })       // 100000

    // 2. Selesaikan WO -> stok terpotong
    await workOrderService.updateStatus(wo.id, 'COMPLETED')
    expect(Number(tables.spareparts[0].stok)).toBe(8)

    const woFinal = await workOrderService.getById(wo.id)
    expect(woFinal.totalBiaya).toBe(200000)

    // 3. Generate invoice dari WO
    const inv = await invoiceService.generateFromWorkOrder(wo.id)
    expect(inv.grandTotal).toBe(200000)

    // 4. Bayar parsial lalu lunas
    await invoiceService.addPayment(inv.id, { jumlah: 120000 })
    await invoiceService.markAsPaid(inv.id)

    const invFinal = await invoiceService.getById(inv.id)
    expect(invFinal.jumlahDibayar).toBe(200000)
    expect(invFinal.sisaBayar).toBe(0)
    expect(invFinal.status).toBe(INVOICE_STATUS.PAID)

    // Riwayat pembayaran = grandTotal persis (tanpa selisih)
    const payments = await invoiceService.getPayments(inv.id)
    expect(payments.reduce((s, p) => s + Number(p.jumlah), 0)).toBe(invFinal.grandTotal)
  })
})