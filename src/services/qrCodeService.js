import { db } from './database'

// Helper untuk generate QR code string
function generateQRCode(vehicleId, customerId) {
  const timestamp = Date.now()
  const random = Math.floor(1000 + Math.random() * 9000)
  return `FA-${vehicleId}-${customerId}-${timestamp}-${random}`
}

// Helper untuk generate QR data (JSON string)
function generateQRData(vehicle) {
  return JSON.stringify({
    type: 'vehicle',
    vehicleId: vehicle.id,
    platNomor: vehicle.platNomor,
    merk: vehicle.merk,
    tipe: vehicle.tipe,
    tahun: vehicle.tahun,
    customerId: vehicle.customerId,
    customerNama: vehicle.customer?.nama || '',
    kmTerakhir: vehicle.kmTerakhir || 0,
    generatedAt: new Date().toISOString()
  })
}

export const qrCodeService = {
  async getAll() {
    const [qrCodes, vehicles] = await Promise.all([
      db.getAll(db.keys.VEHICLE_QR_CODES),
      db.getAll(db.keys.VEHICLES)
    ])
    const vehicleMap = new Map(vehicles.map(v => [Number(v.id), v]))
    return qrCodes.map(qr => ({
      ...qr,
      vehicle: vehicleMap.get(Number(qr.vehicleId)) || null
    }))
  },

  async getByVehicleId(vehicleId) {
    const qrCodes = await db.getAll(db.keys.VEHICLE_QR_CODES)
    return qrCodes.filter(qr => Number(qr.vehicleId) === Number(vehicleId))
  },

  async getById(id) {
    return db.getById(db.keys.VEHICLE_QR_CODES, id) || null
  },

  // Generate QR code for a vehicle
  async generateForVehicle(vehicleId) {
    const vehicle = await db.getById(db.keys.VEHICLES, vehicleId)
    if (!vehicle) throw new Error('Kendaraan tidak ditemukan')

    const customer = await db.getById(db.keys.CUSTOMERS, vehicle.customerId)
    const vehicleWithCustomer = { ...vehicle, customer: customer || null }

    const qrCode = generateQRCode(vehicleId, vehicle.customerId)
    const qrData = generateQRData(vehicleWithCustomer)

    // Cek apakah sudah ada QR code untuk kendaraan ini
    const existing = await this.getByVehicleId(vehicleId)
    if (existing.length > 0) {
      // Update yang ada
      return db.update(db.keys.VEHICLE_QR_CODES, existing[0].id, {
        qrCode,
        qrData,
        updatedAt: new Date().toISOString()
      })
    }

    // Buat baru
    return db.insert(db.keys.VEHICLE_QR_CODES, {
      vehicleId,
      qrCode,
      qrData,
      createdAt: new Date().toISOString()
    })
  },

  // Lookup vehicle by QR code string
  async lookupByQRCode(qrCode) {
    const qrCodes = await db.getAll(db.keys.VEHICLE_QR_CODES)
    const qr = qrCodes.find(q => q.qrCode === qrCode)
    if (!qr) return null

    const vehicle = await db.getById(db.keys.VEHICLES, qr.vehicleId)
    if (!vehicle) return null

    const customer = await db.getById(db.keys.CUSTOMERS, vehicle.customerId)
    return { ...vehicle, customer: customer || null, qrCode: qr }
  },

  // Lookup vehicle by QR data (JSON string)
  async lookupByQRData(qrData) {
    try {
      const parsed = JSON.parse(qrData)
      if (parsed.type !== 'vehicle') return null
      const vehicle = await db.getById(db.keys.VEHICLES, parsed.vehicleId)
      if (!vehicle) return null
      const customer = await db.getById(db.keys.CUSTOMERS, vehicle.customerId)
      return { ...vehicle, customer: customer || null, qrData: parsed }
    } catch (e) {
      console.warn('Invalid QR data:', e)
      return null
    }
  },

  async delete(id) {
    await db.remove(db.keys.VEHICLE_QR_CODES, id)
    return true
  },

  async deleteByVehicleId(vehicleId) {
    const qrCodes = await this.getByVehicleId(vehicleId)
    for (const qr of qrCodes) {
      await db.remove(db.keys.VEHICLE_QR_CODES, qr.id)
    }
    return true
  },

  // ---- Metode murni sinkron ----
  // Generate QR code SVG string (untuk ditampilkan di UI)
  generateSVG(qrCodeString, size = 200) {
    // Simple QR code placeholder - in production, use a real QR library
    // This generates a scannable QR code using a simple pattern
    const qrData = encodeURIComponent(qrCodeString)
    // Using Google Charts API as fallback for QR generation
    return `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${qrData}&choe=UTF-8`
  },

  // Generate QR code data URL (base64) - simple implementation
  generateDataURL(qrCodeString, size = 200) {
    // For a real implementation, use a library like qrcode
    // This returns a URL to Google Charts QR API
    return this.generateSVG(qrCodeString, size)
  }
}
