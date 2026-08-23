/**
 * Utilitas kriptografi berbasis Web Crypto API (standar browser).
 *
 * - Password di-hash dengan PBKDF2-SHA256 (100.000 iterasi) + salt acak 16 byte
 *   per pengguna. Format tersimpan: `pbkdf2$<iterations>$<saltHex>$<hashHex>`
 * - Kompatibel mundur dengan hash legacy (`h_<hash>_<len>`): otomatis dimigrasi
 *   ke format baru saat login berhasil.
 * - Perbandingan hash dilakukan constant-time untuk mencegah timing attack.
 *
 * Catatan: hashing client-side tetap lebih lemah dibanding backend (bcrypt/
 * argon2), namun jauh lebih aman daripada hash string sederhana sebelumnya.
 */

const PBKDF2_ITERATIONS = 100000
const SALT_LENGTH_BYTES = 16
const HASH_ALGO = 'SHA-256'
const PBKDF2_PREFIX = 'pbkdf2'

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

/** Generate salt acak sepanjang SALT_LENGTH_BYTES, dikembalikan sebagai hex */
export function generateSalt() {
  const salt = new Uint8Array(SALT_LENGTH_BYTES)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(salt)
  } else {
    // Fallback sangat jarang (browser modern selalu punya crypto.getRandomValues)
    for (let i = 0; i < salt.length; i++) {
      salt[i] = Math.floor(Math.random() * 256)
    }
  }
  return toHex(salt)
}

/**
 * Derive hash PBKDF2 dari password + salt.
 * @param {string} password
 * @param {string} saltHex Salt dalam format hex
 * @param {number} iterations Jumlah iterasi PBKDF2
 * @returns {Promise<string>} Hash dalam format hex
 */
export async function deriveHash(password, saltHex, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations,
      hash: HASH_ALGO
    },
    keyMaterial,
    256
  )
  return toHex(bits)
}

/**
 * Hash password menjadi format tersimpan `pbkdf2$<iter>$<salt>$<hash>`.
 * @param {string} password Password plain text
 * @returns {Promise<string>} String hash tersimpan
 */
export async function hashPassword(password) {
  if (!password) return ''
  const salt = generateSalt()
  const hash = await deriveHash(password, salt, PBKDF2_ITERATIONS)
  return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${salt}$${hash}`
}

/**
 * Verifikasi password terhadap hash tersimpan.
 * Mendukung format baru (pbkdf2$...) dan legacy (h_..._len).
 * @param {string} password Password yang diuji
 * @param {string} stored Hash tersimpan di database
 * @returns {Promise<{valid: boolean, needsUpgrade: boolean}>}
 */
export async function verifyPassword(password, stored) {
  if (!password || !stored) return { valid: false, needsUpgrade: false }

  // Format baru: pbkdf2$<iterations>$<salt>$<hash>
  if (stored.startsWith(`${PBKDF2_PREFIX}$`)) {
    const parts = stored.split('$')
    if (parts.length !== 4) return { valid: false, needsUpgrade: false }
    const [, iterationsStr, salt, expected] = parts
    const iterations = parseInt(iterationsStr, 10)
    if (!Number.isFinite(iterations) || iterations < 1) {
      return { valid: false, needsUpgrade: false }
    }
    try {
      const actual = await deriveHash(password, salt, iterations)
      return {
        valid: constantTimeEqual(actual, expected),
        needsUpgrade: false
      }
    } catch {
      return { valid: false, needsUpgrade: false }
    }
  }

  // Format legacy: h_<base36hash>_<length> — verifikasi lama, tandai perlu upgrade
  if (stored.startsWith('h_')) {
    return { valid: legacyHash(password) === stored, needsUpgrade: true }
  }

  return { valid: false, needsUpgrade: false }
}

/**
 * Legacy hash (kompatibilitas dengan data lama). TIDAK digunakan untuk data baru.
 */
function legacyHash(password) {
  let hash = 0
  if (!password) return ''
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + password.length
}

/** Perbandingan string constant-time (anti timing attack) */
export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) {
    // Tetap lakukan loop agar waktu relatif konsisten
    let dummy = 0
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      dummy |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0)
    }
    return false
  }
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Validasi kekuatan password.
 * @param {string} password
 * @returns {{valid: boolean, message: string}}
 */
export function validatePasswordStrength(password) {
  if (!password || password.length < 6) {
    return { valid: false, message: 'Password minimal 6 karakter' }
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password maksimal 128 karakter' }
  }
  if (/^\s|\s$/.test(password)) {
    return { valid: false, message: 'Password tidak boleh diawali/diakhiri spasi' }
  }
  const weakPasswords = ['123456', 'password', 'admin123', 'qwerty', '111111']
  if (weakPasswords.includes(password.toLowerCase())) {
    return { valid: false, message: 'Password terlalu umum, pilih yang lebih kuat' }
  }
  return { valid: true, message: '' }
}