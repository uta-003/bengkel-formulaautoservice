import { db } from './database'
import { supabase } from './supabaseClient'
import {
  hashPassword as secureHash,
  verifyPassword as secureVerify,
  validatePasswordStrength
} from '../utils/crypto'
import { sanitizeText, validateUsername } from '../utils/validation'

// Kunci untuk penyimpanan di localStorage (fallback)
const SESSION_KEY = 'app_session'
const AUDIT_KEY = 'app_audit_log'
const LOGIN_ATTEMPTS_KEY = 'app_login_attempts'

// Konfigurasi sesi & keamanan login
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000 // Sesi kadaluarsa setelah 12 jam
const MAX_LOGIN_ATTEMPTS = 5 // Kunci akun setelah 5x gagal
const LOCKOUT_DURATION_MS = 5 * 60 * 1000 // Kunci selama 5 menit

// ---- Rate limiting login (brute force protection) ----

function getLoginAttempts() {
  try {
    return JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveLoginAttempts(attempts) {
  try {
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(attempts))
  } catch (e) {
    console.warn('Gagal menyimpan data percobaan login:', e)
  }
}

/**
 * Cek apakah username sedang terkunci karena terlalu banyak percobaan gagal.
 * @returns {{locked: boolean, remainingMs: number}}
 */
export function isLoginLocked(username) {
  const attempts = getLoginAttempts()
  const record = attempts[username]
  if (!record || !record.lockedUntil) return { locked: false, remainingMs: 0 }
  const remaining = record.lockedUntil - Date.now()
  if (remaining <= 0) {
    // Lockout sudah lewat, bersihkan
    delete attempts[username]
    saveLoginAttempts(attempts)
    return { locked: false, remainingMs: 0 }
  }
  return { locked: true, remainingMs: remaining }
}

function recordFailedAttempt(username) {
  const attempts = getLoginAttempts()
  const record = attempts[username] || { count: 0, firstAt: Date.now() }
  record.count += 1
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS
    record.count = 0 // Reset counter setelah lockout dipicu
  }
  attempts[username] = record
  saveLoginAttempts(attempts)
  return record.lockedUntil ? LOCKOUT_DURATION_MS : 0
}

function clearLoginAttempts(username) {
  const attempts = getLoginAttempts()
  if (attempts[username]) {
    delete attempts[username]
    saveLoginAttempts(attempts)
  }
}

// ---- Session helpers ----

/** Generate token sesi acak (hex 32 byte) */
function generateSessionToken() {
  const bytes = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Ambil user yang sedang login. Session otomatis tidak valid jika:
 * - Sudah melewati SESSION_DURATION_MS, atau
 * - Struktur data tidak memiliki token keamanan.
 * @returns {object|null}
 */
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session || !session._token || !session._expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    if (Date.now() > session._expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

// Inisialisasi default users ke Supabase jika belum ada
// Menggunakan upsert untuk menghindari conflict ketika 2 device sama-sama inisialisasi
async function initAuthDB() {
  try {
    const users = await db.getAll(db.keys.USERS)
    if (!users || users.length === 0) {
      // Buat default users jika Supabase kosong (password di-hash PBKDF2)
      const adminHash = await secureHash('admin123')
      const staffHash = await secureHash('staff123')
      const defaultUsers = [
        {
          username: 'admin',
          password: adminHash,
          nama: 'Admin Utama',
          role: 'ADMIN',
          email: 'admin@example.com',
          createdAt: new Date().toISOString()
        },
        {
          username: 'staff',
          password: staffHash,
          nama: 'Staff Gudang',
          role: 'STAFF',
          email: 'staff@example.com',
          createdAt: new Date().toISOString()
        }
      ]
      // Gunakan upsert langsung ke Supabase untuk menghindari race condition
      const dbUsers = defaultUsers.map(u => ({
        username: u.username,
        password: u.password,
        nama: u.nama,
        role: u.role,
        email: u.email,
        created_at: u.createdAt
      }))
      const { error } = await supabase
        .from(db.keys.USERS)
        .upsert(dbUsers, { onConflict: 'username' })
      if (error) {
        console.warn('Gagal upsert default users:', error)
        for (const user of defaultUsers) {
          try {
            await db.insert(db.keys.USERS, user)
          } catch {
            // Mungkin sudah ada, lewati
          }
        }
      }
    }
  } catch (error) {
    console.warn('Gagal inisialisasi users:', error)
  }

  // Inisialisasi audit log
  if (!localStorage.getItem(AUDIT_KEY)) {
    localStorage.setItem(AUDIT_KEY, JSON.stringify([]))
  }
}

// Panggil inisialisasi saat service di-load (non-blocking)
initAuthDB().catch(err => console.warn('initAuthDB error:', err))

export const authService = {
  /**
   * Mencoba login dengan username dan password.
   * Dilengkapi rate-limiting: akun dikunci sementara setelah MAX_LOGIN_ATTEMPTS gagal.
   * @param {string} usernameInput
   * @param {string} password
   * @returns {Promise<object>} Data pengguna yang berhasil login
   */
  async login(usernameInput, password) {
    const usernameCheck = validateUsername(usernameInput)
    const username = usernameCheck.valid ? usernameCheck.value : sanitizeText(usernameInput).toLowerCase()

    // Cek lockout SEBELUM verifikasi
    const lockStatus = isLoginLocked(username)
    if (lockStatus.locked) {
      const minutes = Math.ceil(lockStatus.remainingMs / 60000)
      throw new Error(`Terlalu banyak percobaan gagal. Coba lagi dalam ${minutes} menit.`)
    }

    const users = await this.getAllUsers()
    const user = users.find(u => u.username === username)

    let verified = false
    let needsUpgrade = false
    if (user && password) {
      const result = await secureVerify(password, user.password)
      verified = result.valid
      needsUpgrade = result.needsUpgrade
    }

    if (!verified) {
      const lockoutTriggered = recordFailedAttempt(username)
      auditService.log(
        'LOGIN_GAGAL',
        `Percobaan login gagal untuk username "${username}".` +
        (lockoutTriggered ? ' Akun dikunci sementara.' : '')
      )
      throw new Error('Username atau password salah')
    }

    // Login sukses — reset counter percobaan gagal
    clearLoginAttempts(username)

    // Migrasi otomatis: hash legacy -> PBKDF2
    if (needsUpgrade) {
      try {
        const newHash = await secureHash(password)
        await db.update(db.keys.USERS, user.id, { ...user, password: newHash })
      } catch (err) {
        console.warn('Gagal migrasi hash password:', err)
      }
    }

    // Jangan simpan password di sesi; tambahkan metadata keamanan sesi
    const { password: _, ...userData } = user
    const userSession = {
      ...userData,
      _token: generateSessionToken(),
      _expiresAt: Date.now() + SESSION_DURATION_MS
    }

    // Sinkronisasi user ke Supabase agar bisa lintas perangkat
    try {
      const allUsers = await db.getAll(db.keys.USERS)
      const existing = allUsers.find(u => u.username === userSession.username)
      if (existing) {
        await db.update(db.keys.USERS, existing.id, userData)
      } else {
        await db.insert(db.keys.USERS, userData)
      }
    } catch (err) {
      console.warn('Gagal sinkronisasi user:', err)
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(userSession))
    auditService.log('LOGIN', `Pengguna ${username} berhasil masuk.`)
    return userSession
  },

  /**
   * Logout pengguna saat ini.
   */
  async logout() {
    const user = getCurrentUser()
    if (user) {
      auditService.log('LOGOUT', `Pengguna ${user.username} keluar.`)
    }
    localStorage.removeItem(SESSION_KEY)
  },

  /**
   * Mendapatkan data pengguna yang sedang login (validasi expiry internal).
   * @returns {object|null}
   */
  getCurrentUser,

  /**
   * Mendapatkan semua pengguna dari database (Supabase sync).
   * @returns {Promise<Array<object>>}
   */
  async getAllUsers() {
    return db.getAll(db.keys.USERS)
  },

  /**
   * Membuat pengguna baru (disinkronkan ke Supabase).
   * Validasi: username unik & format benar, password kuat.
   * @param {object} userData Data pengguna baru
   * @returns {Promise<object>} Pengguna yang baru dibuat
   */
  async createUser(userData) {
    const usernameCheck = validateUsername(userData.username)
    if (!usernameCheck.valid) throw new Error(usernameCheck.message)

    const strength = validatePasswordStrength(userData.password || '')
    if (!strength.valid) throw new Error(strength.message)

    const users = await this.getAllUsers()
    if (users.some(u => u.username === usernameCheck.value)) {
      throw new Error(`Username "${usernameCheck.value}" sudah digunakan.`)
    }

    const newUser = {
      ...userData,
      username: usernameCheck.value,
      nama: sanitizeText(userData.nama),
      email: sanitizeText(userData.email || ''),
      role: ['ADMIN', 'STAFF'].includes(userData.role) ? userData.role : 'STAFF',
      password: await secureHash(userData.password || ''),
      createdAt: new Date().toISOString()
    }
    const saved = await db.insert(db.keys.USERS, newUser)

    // Sinkronisasi user ke Supabase agar bisa lintas perangkat
    try {
      const remoteUsers = await db.getAll(db.keys.USERS)
      const remoteExists = remoteUsers.find(u => u.username === newUser.username)
      if (remoteExists) {
        await db.update(db.keys.USERS, remoteExists.id, newUser)
      } else {
        await db.insert(db.keys.USERS, newUser)
      }
    } catch (err) {
      console.warn('Gagal sinkronisasi user:', err)
    }

    return saved
  },

  /**
   * Memperbarui data pengguna (disinkronkan ke Supabase).
   * @param {number} id ID pengguna
   * @param {object} updatedData Data yang akan diperbarui
   */
  async updateUser(id, updatedData) {
    const users = await this.getAllUsers()
    const user = users.find(u => Number(u.id) === Number(id))
    if (!user) throw new Error('Pengguna tidak ditemukan')

    // Jaga password lama jika field password baru kosong;
    // jika diisi, validasi kekuatan lalu hash PBKDF2
    let newPassword = user.password
    if (updatedData.password) {
      const strength = validatePasswordStrength(updatedData.password)
      if (!strength.valid) throw new Error(strength.message)
      newPassword = await secureHash(updatedData.password)
    }

    const cleanData = {
      ...updatedData,
      nama: sanitizeText(updatedData.nama ?? user.nama),
      email: sanitizeText(updatedData.email ?? user.email ?? ''),
      role: ['ADMIN', 'STAFF'].includes(updatedData.role) ? updatedData.role : user.role,
      password: newPassword
    }
    return await db.update(db.keys.USERS, id, cleanData)
  },

  /**
   * Menghapus pengguna (disinkronkan ke Supabase).
   * Proteksi: tidak boleh menghapus diri sendiri atau admin terakhir.
   * @param {number} id ID pengguna
   */
  async deleteUser(id) {
    const current = getCurrentUser()
    if (current && Number(current.id) === Number(id)) {
      throw new Error('Tidak dapat menghapus akun yang sedang login')
    }
    const users = await this.getAllUsers()
    const target = users.find(u => Number(u.id) === Number(id))
    if (target?.role === 'ADMIN') {
      const adminCount = users.filter(u => u.role === 'ADMIN').length
      if (adminCount <= 1) {
        throw new Error('Tidak dapat menghapus satu-satunya admin')
      }
    }
    return await db.remove(db.keys.USERS, id)
  }
}

export const auditService = {
  /**
   * Mencatat log aktivitas baru (disinkronkan ke Supabase).
   * @param {string} action Tipe aksi (misal: CREATE_USER, LOGIN)
   * @param {string} detail Detail dari aksi
   */
  async log(action, detail) {
    const currentUser = getCurrentUser()
    const logData = {
      timestamp: new Date().toISOString(),
      user: currentUser?.nama || 'Sistem',
      role: currentUser?.role || 'SISTEM',
      action: sanitizeText(action),
      detail: sanitizeText(detail),
      createdAt: new Date().toISOString()
    }

    try {
      // Simpan ke Supabase via db
      await db.insert(db.keys.AUDIT_LOG, logData)
    } catch (error) {
      console.warn('Gagal menyimpan audit log ke Supabase:', error)
    }

    // Juga simpan ke localStorage untuk akses cepat
    try {
      const logs = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]')
      logs.unshift(logData)
      localStorage.setItem(AUDIT_KEY, JSON.stringify(logs.slice(0, 200)))
    } catch (e) {
      console.warn('Gagal menyimpan audit log ke localStorage:', e)
    }
  },

  /**
   * Mendapatkan semua log aktivitas (dari Supabase jika tersedia).
   * @returns {Promise<Array<object>>}
   */
  async getAll() {
    try {
      const logs = await db.getAll(db.keys.AUDIT_LOG)
      return logs.reverse() // Urutkan dari terbaru
    } catch {
      return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]')
    }
  },

  /**
   * Membersihkan cache audit log lokal.
   * Catatan keamanan: audit log di Supabase bersifat IMMUTABLE
   * (dilindungi trigger prevent_audit_mutation di security_hardening.sql)
   * sehingga jejak audit di server tidak dapat dihapus dari client.
   */
  async clear() {
    try {
      localStorage.setItem(AUDIT_KEY, JSON.stringify([]))
    } catch (error) {
      console.warn('Gagal membersihkan cache audit log lokal:', error)
    }
  }
}