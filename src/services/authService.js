// Kunci untuk penyimpanan di localStorage
const USERS_KEY = 'app_users'
const SESSION_KEY = 'app_session'
const AUDIT_KEY = 'app_audit_log'
const SEQUENCE_KEY = 'app_sequence'

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

/**
 * Mendapatkan ID berikutnya untuk sebuah tabel (users atau audit_log)
 * @param {string} key Nama tabel
 * @returns {number} ID berikutnya
 */
function getSequence(key) {
  const seq = JSON.parse(localStorage.getItem(SEQUENCE_KEY) || '{}')
  const next = (seq[key] || 0) + 1
  seq[key] = next
  localStorage.setItem(SEQUENCE_KEY, JSON.stringify(seq))
  return next
}

/**
 * Inisialisasi database pengguna jika belum ada.
 * Membuat pengguna default 'admin' dan 'staff'.
 */
function initAuthDB() {
  if (!localStorage.getItem(USERS_KEY)) {
    const defaultUsers = [
      {
        id: getSequence('users'),
        username: 'admin',
        password: hashPassword('admin123'),
        nama: 'Admin Utama',
        role: 'ADMIN',
        email: 'admin@example.com',
        createdAt: new Date().toISOString()
      },
      {
        id: getSequence('users'),
        username: 'staff',
        password: hashPassword('staff123'),
        nama: 'Staff Gudang',
        role: 'STAFF',
        email: 'staff@example.com',
        createdAt: new Date().toISOString()
      }
    ]
    localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers))
  }
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
  login(username, password) {
    const users = this.getAllUsers()
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
  logout() {
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
   * Mendapatkan semua pengguna dari database.
   * @returns {Array<object>}
   */
  getAllUsers() {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
  },

  /**
   * Membuat pengguna baru.
   * @param {object} userData Data pengguna baru
   * @returns {object} Pengguna yang baru dibuat
   */
  createUser(userData) {
    const users = this.getAllUsers()
    if (users.some(u => u.username === userData.username)) {
      throw new Error(`Username "${userData.username}" sudah digunakan.`)
    }
    const newUser = {
      ...userData,
      password: hashPassword(userData.password || ''),
      id: getSequence('users'),
      createdAt: new Date().toISOString()
    }
    users.push(newUser)
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
    return newUser
  },

  /**
   * Memperbarui data pengguna.
   * @param {number} id ID pengguna
   * @param {object} updatedData Data yang akan diperbarui
   */
  updateUser(id, updatedData) {
    const users = this.getAllUsers()
    const index = users.findIndex(u => u.id === id)
    if (index === -1) throw new Error('Pengguna tidak ditemukan')

    // Jaga password lama jika field password baru kosong
    const newPassword = updatedData.password ? hashPassword(updatedData.password) : users[index].password

    users[index] = { ...users[index], ...updatedData, password: newPassword }
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  },

  /**
   * Menghapus pengguna.
   * @param {number} id ID pengguna
   */
  deleteUser(id) {
    let users = this.getAllUsers()
    users = users.filter(u => u.id !== id)
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  }
}

export const auditService = {
  /**
   * Mencatat log aktivitas baru.
   * @param {string} action Tipe aksi (misal: CREATE_USER, LOGIN)
   * @param {string} detail Detail dari aksi
   */
  log(action, detail) {
    const logs = this.getAll()
    const currentUser = authService.getCurrentUser()
    const newLog = {
      id: getSequence('audit_log'),
      timestamp: new Date().toISOString(),
      user: currentUser?.nama || 'Sistem',
      role: currentUser?.role || 'SISTEM',
      action,
      detail
    }
    logs.unshift(newLog) // Tambahkan ke awal array
    localStorage.setItem(AUDIT_KEY, JSON.stringify(logs.slice(0, 200))) // Batasi 200 log
  },

  /**
   * Mendapatkan semua log aktivitas.
   * @returns {Array<object>}
   */
  getAll() {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]')
  },

  /**
   * Menghapus semua log aktivitas.
   */
  clear() {
    localStorage.setItem(AUDIT_KEY, JSON.stringify([]))
    this.log('CLEAR_LOGS', 'Semua log aktivitas telah dihapus.')
  }
}