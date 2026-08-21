import { sparepartService } from './sparepartService'
import { warrantyService } from './warrantyService'
import { invoiceService, INVOICE_STATUS } from './invoiceService'

// Service notifikasi proaktif: low stock, garansi mendekati kadaluarsa, invoice belum dibayar
// Semua data diambil langsung dari Supabase (via db layer)

export const NOTIF_TYPES = {
  LOW_STOCK: 'LOW_STOCK',
  WARRANTY_EXPIRING: 'WARRANTY_EXPIRING',
  INVOICE_UNPAID: 'INVOICE_UNPAID'
}

export const notificationService = {
  // Ambil semua notifikasi aktif
  async getAll({ warrantyDays = 30 } = {}) {
    const [spareparts, warranties, invoices] = await Promise.all([
      sparepartService.getAll(),
      warrantyService.getAll(),
      invoiceService.getAll()
    ])

    const notifications = []

    // 1. Low stock alert
    const lowStock = sparepartService.getLowStock(spareparts || [])
    lowStock.forEach(sp => {
      notifications.push({
        id: `${NOTIF_TYPES.LOW_STOCK}-${sp.id}`,
        type: NOTIF_TYPES.LOW_STOCK,
        title: 'Stok Menipis',
        message: `${sp.nama} (${sp.kode}) tersisa ${sp.stok} pcs (min: ${sp.stokMinimum})`,
        link: '/low-stock',
        severity: Number(sp.stok) === 0 ? 'critical' : 'warning',
        timestamp: new Date().toISOString()
      })
    })

    // 2. Garansi mendekati kadaluarsa (<= warrantyDays hari) & masih AKTIF
    const expiring = warrantyService.getExpiring(warranties || [], warrantyDays)
    expiring.forEach(w => {
      const daysLeft = Math.ceil((new Date(w.tanggalBerakhir) - new Date()) / (24 * 60 * 60 * 1000))
      notifications.push({
        id: `${NOTIF_TYPES.WARRANTY_EXPIRING}-${w.id}`,
        type: NOTIF_TYPES.WARRANTY_EXPIRING,
        title: 'Garansi Segera Berakhir',
        message: `${w.judul} berakhir dalam ${daysLeft} hari (${new Date(w.tanggalBerakhir).toLocaleDateString('id-ID')})`,
        link: '/warranties',
        severity: daysLeft <= 7 ? 'warning' : 'info',
        timestamp: new Date().toISOString()
      })
    })

    // 3. Garansi sudah kadaluarsa tapi status masih AKTIF (perlu update)
    const expired = warrantyService.getExpired(warranties || [])
    expired.slice(0, 10).forEach(w => {
      notifications.push({
        id: `WARRANTY_EXPIRED-${w.id}`,
        type: NOTIF_TYPES.WARRANTY_EXPIRING,
        title: 'Garansi Kadaluarsa',
        message: `${w.judul} sudah kadaluarsa sejak ${new Date(w.tanggalBerakhir).toLocaleDateString('id-ID')}`,
        link: '/warranties',
        severity: 'info',
        timestamp: new Date().toISOString()
      })
    })

    // 4. Invoice belum dibayar / sebagian
    const unpaid = (invoices || []).filter(inv =>
      inv.status === INVOICE_STATUS.PENDING || inv.status === INVOICE_STATUS.PARTIAL
    )
    unpaid.forEach(inv => {
      const sisa = Number(inv.sisaBayar ?? inv.grandTotal ?? 0)
      const daysOverdue = Math.floor((Date.now() - new Date(inv.tanggalInvoice)) / (24 * 60 * 60 * 1000))
      notifications.push({
        id: `${NOTIF_TYPES.INVOICE_UNPAID}-${inv.id}`,
        type: NOTIF_TYPES.INVOICE_UNPAID,
        title: inv.status === INVOICE_STATUS.PARTIAL ? 'Pembayaran Sebagian' : 'Invoice Belum Dibayar',
        message: `${inv.nomorInvoice} - sisa ${sisa.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}${daysOverdue > 7 ? ` (${daysOverdue} hari)` : ''}`,
        link: '/invoices',
        severity: daysOverdue > 14 ? 'critical' : daysOverdue > 7 ? 'warning' : 'info',
        timestamp: inv.tanggalInvoice
      })
    })

    // Urutkan: critical dulu, lalu warning, lalu info
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    return notifications.sort((a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      new Date(b.timestamp) - new Date(a.timestamp)
    )
  },

  // Ringkasan jumlah per tipe (untuk badge)
  async getSummary(options = {}) {
    const notifications = await this.getAll(options)
    return {
      total: notifications.length,
      critical: notifications.filter(n => n.severity === 'critical').length,
      lowStock: notifications.filter(n => n.type === NOTIF_TYPES.LOW_STOCK).length,
      warranty: notifications.filter(n => n.type === NOTIF_TYPES.WARRANTY_EXPIRING).length,
      invoice: notifications.filter(n => n.type === NOTIF_TYPES.INVOICE_UNPAID).length
    }
  }
}