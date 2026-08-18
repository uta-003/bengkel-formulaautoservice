import { db } from './database'

export const scanHistoryService = {
  // Simpan riwayat scan ke Supabase (dengan fallback localStorage)
  async addScan({ barcode, status, sparepartId = null, sparepartName = null, scannedAt = null, timestamp = null }) {
    const now = new Date().toISOString()
    const scan = {
      barcode,
      status, // 'FOUND' | 'NOT_FOUND'
      sparepartId,
      sparepartName,
      scannedAt: scannedAt || timestamp || now,
      createdAt: now
    }

    try {
      const result = await db.insert(db.keys.SCAN_HISTORY, scan)
      return result
    } catch (error) {
      console.error('Gagal menyimpan riwayat scan:', error)
      return null
    }
  },

  // Ambil riwayat scan terbaru dari Supabase
  async getRecentScans(limit = 20) {
    try {
      const scans = await db.getAll(db.keys.SCAN_HISTORY)
      return scans
        .filter(Boolean)
        .sort((a, b) => new Date(b.scannedAt || b.createdAt) - new Date(a.scannedAt || a.createdAt))
        .slice(0, limit)
    } catch (error) {
      console.error('Gagal mengambil riwayat scan:', error)
      return []
    }
  },

  // Hapus semua riwayat scan
  async clearHistory() {
    try {
      const scans = await db.getAll(db.keys.SCAN_HISTORY)
      for (const scan of scans) {
        await db.remove(db.keys.SCAN_HISTORY, scan.id)
      }
      return true
    } catch (error) {
      console.error('Gagal menghapus riwayat scan:', error)
      return false
    }
  }
}
