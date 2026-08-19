import { db } from './database'
import { supabase } from './supabaseClient'

// Kunci untuk penyimpanan di localStorage (fallback)
const SESSION_KEY = 'app_session'
const AUDIT_KEY = 'app_audit_log'
const SESSION_KEY_EXPORT = SESSION_KEY

// Simple hash function (bukan untuk production, hanya proteksi dasar)
// Di aplikasi nyata, gunakan bcrypt/argon2 di server side
function hashPassword(password) {
  let hash = 0
  if (!password) return ''
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32b integer
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + password.length
}

function verifyPassword(password, hashed) {
  return hashPassword(password) === hashed
}

// Inisialisasi default users ke Supabase jika belum ada
// Menggunakan upsert untuk menghindari conflict ketika 2 device sama-sama inisialisasi
async function initAuthDB() {
  try {
    const users = await db.getAll(db.keys.USERS)
    if (!users || users.length === 0) {
      // Buat default users jika Supabase kosong
      const defaultUsers = [
        {
          username: 'admin',
          password: hashPassword('admin123'),
          nama: 'Admin Utama',
          role: 'ADMIN',
          email: 'admin@example.com',
          createdAt: new Date().toISOString()
        },
        {
          username: 'staff',
          password: hashPassword('staff123'),
          nama: 'Staff Gudang',
          role: 'STAFF',
          email: 'staff@example.com',
          createdAt: new Date().toISOString()
        }
      ]
      // Gunakan upsert langsung ke Supabase untuk menghindari race condition
      // (jika 2 device sama-sama menginisialisasi)
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
        // Fallback: coba insert satu per satu
        for (const user of defaultUsers) {
          try {
            await db.insert(db.keys.USERS, user)
          } catch (e) {
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

// Panggil inisialisasi saat service di-load
initAuthDB()

export const authService = {
  /**
   * Mencoba login dengan username dan password.
   * @param {string} username
   * @param {string} password
   * @returns {object} Data pengguna yang berhasil login
   */
  async login(username, password) {
    const users = await this.getAllUsers()
    const user = users.find(u => u.username === username)

    if (!user || !verifyPassword(password, user.password)) {
      throw new Error('Username atau password salah')
    }

    // Jangan simpan password di sesi
    const { password: _, ...userSession } = user
    localStorage.setItem(SESSION_KEY, JSON.stringify(userSession))
    auditService.log('LOGIN', `Pengguna ${username} berhasil masuk.`)
    return userSession
  },

  /**
   * Logout pengguna saat ini.
   */
  async logout() {
    const user = this.getCurrentUser()
    if (user) {
      auditService.log('LOGOUT', `Pengguna ${user.username} keluar.`)
    }
    localStorage.removeItem(SESSION_KEY)
  },

  /**
   * Mendapatkan data pengguna yang sedang login.
   * @returns {object|null}
   */
  getCurrentUser() {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  },

  /**
   * Mendapatkan semua pengguna dari database (Supabase sync).
   * @returns {Promise<Array<object>>}
   */
  async getAllUsers() {
    return db.getAll(db.keys.USERS)
  },

  /**
   * Membuat pengguna baru (disinkronkan ke Supabase).
   * @param {object} userData Data pengguna baru
   * @returns {Promise<object>} Pengguna yang baru dibuat
   */
  async createUser(userData) {
    const users = await this.getAllUsers()
    if (users.some(u => u.username === userData.username)) {
      throw new Error(`Username "${userData.username}" sudah digunakan.`)
    }
    const newUser = {
      ...userData,
      password: hashPassword(userData.password || ''),
      createdAt: new Date().toISOString()
    }
    return await db.insert(db.keys.USERS, newUser)
  },

  /**
   * Memperbarui data pengguna (disinkronkan ke Supabase).
   * @param {number} id ID pengguna
   * @param {object} updatedData Data yang akan diperbarui
   */
  async updateUser(id, updatedData) {
    const users = await this.getAllUsers()
    const user = users.find(u => u.id === id)
    if (!user) throw new Error('Pengguna tidak ditemukan')

    // Jaga password lama jika field password baru kosong
    const newPassword = updatedData.password ? hashPassword(updatedData.password) : user.password
    return await db.update(db.keys.USERS, id, { ...updatedData, password: newPassword })
  },

  /**
   * Menghapus pengguna (disinkronkan ke Supabase).
   * @param {number} id ID pengguna
   */
  async deleteUser(id) {
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
    const currentUser = authService.getCurrentUser()
    const logData = {
      timestamp: new Date().toISOString(),
      user: currentUser?.nama || 'Sistem',
      role: currentUser?.role || 'SISTEM',
      action,
      detail,
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
   * @returns {Array<object>}
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
   * Menghapus semua log aktivitas.
   */
  async clear() {
    try {
      const logs = await db.getAll(db.keys.AUDIT_LOG)
      for (const log of logs) {
        await db.remove(db.keys.AUDIT_LOG, log.id)
      }
      localStorage.setItem(AUDIT_KEY, JSON.stringify([]))
    } catch (error) {
      console.warn('Gagal menghapus audit log:', error)
    }
  }
}

// Export SESSION_KEY agar dapat digunakan di luar
export { SESSION_KEY_EXPORT as SESSION_KEY }
