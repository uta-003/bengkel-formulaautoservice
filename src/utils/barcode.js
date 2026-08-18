// Utilitas untuk generate dan validasi barcode EAN-13
// Format: 899 (prefix Indonesia) + 00 (kode toko) + 7 digit ID + 1 digit check digit = 13 digit

const BARCODE_PREFIX = '899' // Kode negara Indonesia
const STORE_CODE = '00' // Kode toko/lokasi

/**
 * Hitung check digit EAN-13
 * - Digit di posisi ganjil (1,3,5,7,9,11) dikali 1
 * - Digit di posisi genap (2,4,6,8,10,12) dikali 3
 * - Check digit = (10 - (jumlah % 10)) % 10
 */
function calculateCheckDigit(first12) {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(first12[i], 10)
    // Posisi ganjil (index 0,2,4,6,8,10) dikali 1
    // Posisi genap (index 1,3,5,7,9,11) dikali 3
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return (10 - (sum % 10)) % 10
}

/**
 * Generate barcode EAN-13 otomatis dari ID sparepart
 * @param {number} id - ID sparepart
 * @returns {string} barcode 13 digit
 */
export function generateBarcode(id) {
  const idStr = String(id || 0).padStart(7, '0')
  const first12 = BARCODE_PREFIX + STORE_CODE + idStr
  const checkDigit = calculateCheckDigit(first12)
  return first12 + checkDigit
}

/**
 * Validasi barcode EAN-13
 * @param {string} barcode - barcode yang akan divalidasi
 * @returns {boolean} true jika valid
 */
export function validateBarcode(barcode) {
  if (!barcode || typeof barcode !== 'string') return false
  const cleaned = barcode.replace(/\D/g, '')
  if (cleaned.length !== 13) return false
  const first12 = cleaned.slice(0, 12)
  const providedCheck = parseInt(cleaned[12], 10)
  const calculatedCheck = calculateCheckDigit(first12)
  return providedCheck === calculatedCheck
}

/**
 * Generate kode sparepart otomatis (SPR-XXX)
 * @param {number} sequence - nomor urut
 * @returns {string} kode sparepart
 */
export function generateKodeSparepart(sequence) {
  return `SPR-${String(sequence || 0).padStart(3, '0')}`
}

/**
 * Generate barcode unik yang belum ada di database
 * @param {number} id - ID sparepart
 * @param {Array} existingSpareparts - daftar sparepart yang sudah ada
 * @returns {string} barcode unik
 */
export function generateUniqueBarcode(id, existingSpareparts = []) {
  let barcode = generateBarcode(id)
  let counter = 0
  const existingBarcodes = new Set(
    (existingSpareparts || []).map(sp => sp.barcode).filter(Boolean)
  )

  // Jika barcode sudah ada, coba generate dengan variasi
  while (existingBarcodes.has(barcode) && counter < 100) {
    counter++
    const idStr = String(id + counter).padStart(7, '0')
    const first12 = BARCODE_PREFIX + STORE_CODE + idStr
    const checkDigit = calculateCheckDigit(first12)
    barcode = first12 + checkDigit
  }

  return barcode
}
