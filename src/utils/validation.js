/**
 * Utilitas validasi & sanitasi input.
 * Melindungi aplikasi dari input berbahaya (XSS via teks yang dirender),
 * nilai numerik tidak valid, dan format data yang salah.
 */

/**
 * Sanitasi string: hapus karakter kontrol dan tag HTML/script.
 * Aman digunakan sebelum menyimpan ke database maupun menampilkan kembali.
 * @param {string} value
 * @returns {string}
 */
export function sanitizeText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    // Hapus tag HTML (<script>, <img onerror=...>, dll)
    .replace(/<[^>]*>/g, '')
    // Hapus karakter kontrol kecuali newline & tab
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
}

/**
 * Sanitasi objek: terapkan sanitizeText pada semua properti string.
 * Properti non-string dibiarkan apa adanya.
 * @param {object} obj
 * @returns {object} Salinan objek dengan string tersanitasi
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = typeof value === 'string' ? sanitizeText(value) : value
  }
  return result
}

/**
 * Validasi & parse angka positif.
 * @param {any} value
 * @param {{min?: number, max?: number, integer?: boolean, label?: string}} options
 * @returns {{valid: boolean, value: number|null, message: string}}
 */
export function validateNumber(value, options = {}) {
  const { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false, label = 'Nilai' } = options
  const num = typeof value === 'string' ? Number(value.replace(/,/g, '.')) : Number(value)

  if (value === '' || value === null || value === undefined || Number.isNaN(num)) {
    return { valid: false, value: null, message: `${label} harus berupa angka` }
  }
  if (num < min) {
    return { valid: false, value: null, message: `${label} minimal ${min}` }
  }
  if (num > max) {
    return { valid: false, value: null, message: `${label} maksimal ${max}` }
  }
  if (integer && !Number.isInteger(num)) {
    return { valid: false, value: null, message: `${label} harus bilangan bulat` }
  }
  return { valid: true, value: num, message: '' }
}

/**
 * Validasi teks wajib isi dengan panjang tertentu.
 * @param {any} value
 * @param {{required?: boolean, minLength?: number, maxLength?: number, label?: string}} options
 * @returns {{valid: boolean, value: string, message: string}}
 */
export function validateText(value, options = {}) {
  const {
    required = true,
    minLength = 1,
    maxLength = 500,
    label = 'Kolom'
  } = options

  const clean = sanitizeText(value)

  if (required && clean.length === 0) {
    return { valid: false, value: '', message: `${label} wajib diisi` }
  }
  if (clean.length > 0 && clean.length < minLength) {
    return { valid: false, value: clean, message: `${label} minimal ${minLength} karakter` }
  }
  if (clean.length > maxLength) {
    return { valid: false, value: clean.slice(0, maxLength), message: `${label} maksimal ${maxLength} karakter` }
  }
  return { valid: true, value: clean, message: '' }
}

/** Pola umum untuk validasi format */
export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  phoneID: /^(\+62|62|0)8[1-9][0-9]{6,11}$/,
  plateNumber: /^[A-Z]{1,2}\s?[0-9]{1,4}\s?[A-Z]{0,3}$/i,
  username: /^[a-zA-Z0-9_.]{3,30}$/
}

/**
 * Validasi email (boleh kosong jika tidak required).
 */
export function validateEmail(value, required = false) {
  const clean = sanitizeText(value)
  if (!clean) {
    return required
      ? { valid: false, value: '', message: 'Email wajib diisi' }
      : { valid: true, value: '', message: '' }
  }
  if (!patterns.email.test(clean)) {
    return { valid: false, value: clean, message: 'Format email tidak valid' }
  }
  return { valid: true, value: clean.toLowerCase(), message: '' }
}

/**
 * Validasi nomor telepon Indonesia (boleh kosong jika tidak required).
 */
export function validatePhone(value, required = false) {
  const clean = sanitizeText(value).replace(/[\s-]/g, '')
  if (!clean) {
    return required
      ? { valid: false, value: '', message: 'Nomor telepon wajib diisi' }
      : { valid: true, value: '', message: '' }
  }
  if (!patterns.phoneID.test(clean)) {
    return { valid: false, value: clean, message: 'Format nomor HP tidak valid (contoh: 081234567890)' }
  }
  return { valid: true, value: clean, message: '' }
}

/**
 * Validasi username: huruf, angka, titik, underscore; 3-30 karakter.
 */
export function validateUsername(value) {
  const clean = sanitizeText(value)
  if (!clean) return { valid: false, value: '', message: 'Username wajib diisi' }
  if (!patterns.username.test(clean)) {
    return {
      valid: false,
      value: clean,
      message: 'Username 3-30 karakter, hanya huruf/angka/titik/underscore'
    }
  }
  return { valid: true, value: clean.toLowerCase(), message: '' }
}

/**
 * Validasi tanggal ISO / Date string.
 */
export function validateDate(value, { required = true, label = 'Tanggal' } = {}) {
  if (!value) {
    return required
      ? { valid: false, value: null, message: `${label} wajib diisi` }
      : { valid: true, value: null, message: '' }
  }
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return { valid: false, value: null, message: `${label} tidak valid` }
  }
  return { valid: true, value: date.toISOString(), message: '' }
}