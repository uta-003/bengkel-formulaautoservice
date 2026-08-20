// Database layer menggunakan Supabase sebagai sumber data utama
// Tabel: spareparts, suppliers, transactions, stock_movements, users, scan_history, audit_log
// Fallback ke localStorage jika Supabase tidak tersedia (offline mode)
// Mendukung realtime sync: perubahan data dari perangkat lain langsung terlihat

import { supabase } from './supabaseClient'

const DB_KEYS = {
  SPAREPARTS: 'spareparts',
  SUPPLIERS: 'suppliers',
  TRANSACTIONS: 'transactions',
  STOCK_MOVEMENTS: 'stock_movements',
  SCAN_HISTORY: 'scan_history',
  USERS: 'users',
  AUDIT_LOG: 'audit_log'
}

// Mapping field names antara Supabase (snake_case) dan aplikasi (camelCase)
const FIELD_MAPPINGS = {
  spareparts: {
    supplierId: 'supplier_id',
    hargaBeli: 'harga_beli',
    hargaJual: 'harga_jual',
    stokMinimum: 'stok_minimum',
    createdAt: 'created_at'
  },
  suppliers: {
    createdAt: 'created_at'
  },
  transactions: {
    sparepartId: 'sparepart_id',
    supplierId: 'supplier_id',
    hargaSatuan: 'harga_satuan',
    createdAt: 'created_at'
  },
  stock_movements: {
    sparepartId: 'sparepart_id',
    stokSebelum: 'stok_sebelum',
    stokSesudah: 'stok_sesudah',
    referensiId: 'referensi_id',
    createdAt: 'created_at'
  },
  scan_history: {
    sparepartId: 'sparepart_id',
    sparepartName: 'sparepart_name',
    scannedAt: 'scanned_at',
    stokSebelum: 'stok_sebelum',
    stokSesudah: 'stok_sesudah',
    jumlah: 'jumlah',
    createdAt: 'created_at'
  },
  users: {
    createdAt: 'created_at'
  },
  audit_log: {
    createdAt: 'created_at'
  }
}

// Konversi data dari Supabase (snake_case) ke format aplikasi (camelCase)
function mapFromDB(table, data) {
  if (!data) return data
  const mapping = FIELD_MAPPINGS[table] || {}
  const reverseMap = {}
  Object.entries(mapping).forEach(([camel, snake]) => {
    reverseMap[snake] = camel
  })

  const result = {}
  Object.entries(data).forEach(([key, value]) => {
    const camelKey = reverseMap[key] || key
    result[camelKey] = value
  })
  return result
}

// Konversi data dari aplikasi (camelCase) ke format Supabase (snake_case)
function mapToDB(table, data) {
  if (!data) return data
  const mapping = FIELD_MAPPINGS[table] || {}
  const result = {}
  Object.entries(data).forEach(([key, value]) => {
    const snakeKey = mapping[key] || key
    result[snakeKey] = value
  })
  return result
}

// Kunci untuk localStorage fallback
const LS_PREFIX = 'app_'
const LS_KEYS = {
  [DB_KEYS.SPAREPARTS]: `${LS_PREFIX}spareparts_data`,
  [DB_KEYS.SUPPLIERS]: `${LS_PREFIX}suppliers_data`,
  [DB_KEYS.TRANSACTIONS]: `${LS_PREFIX}transactions_data`,
  [DB_KEYS.STOCK_MOVEMENTS]: `${LS_PREFIX}stock_movements_data`,
  [DB_KEYS.SCAN_HISTORY]: `${LS_PREFIX}scan_history_data`,
  [DB_KEYS.USERS]: `${LS_PREFIX}users_data`,
  [DB_KEYS.AUDIT_LOG]: `${LS_PREFIX}audit_log_data`
}

const PENDING_QUEUE_KEY = `${LS_PREFIX}pending_sync`
const LS_SEQUENCE_KEY = `${LS_PREFIX}sequence`

// Flag status koneksi Supabase
let supabaseAvailable = true
let lastSupabaseCheck = 0
const SUPABASE_CHECK_INTERVAL = 10000 // 10 detik

// Short cache hanya untuk anti-spam dalam 500ms - sangat pendek agar data selalu fresh
const CACHE_SHORT_TTL = 500
const shortCache = new Map()

// Event yang dipancarkan setiap kali data berubah (termasuk dari realtime)
const DB_CHANGE_EVENT = 'db-updated'
const DB_SYNC_EVENT = 'db-sync-status'

function notifyChange(table, operation, source = 'local') {
  window.dispatchEvent(new CustomEvent(DB_CHANGE_EVENT, {
    detail: { table, operation, timestamp: Date.now(), source }
  }))
}

function notifySyncStatus(status) {
  window.dispatchEvent(new CustomEvent(DB_SYNC_EVENT, {
    detail: { status, timestamp: Date.now() }
  }))
}

// ---- Realtime Subscriptions ----
let realtimeChannels = []
let realtimeEnabled = false

function subscribeToTable(table) {
  if (table === DB_KEYS.AUDIT_LOG) return // Skip audit untuk mengurangi noise
  try {
    const channel = supabase
      .channel(`realtime-${table}-${Date.now()}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        const { eventType } = payload
        console.log(`[Realtime] ${table} ${eventType}`)
        const operation = eventType === 'INSERT' ? 'insert'
          : eventType === 'UPDATE' ? 'update'
          : 'remove'
        notifyChange(table, operation, 'realtime')
      })
      .subscribe((status) => {
        console.log(`[Realtime] Subscribed to ${table}: ${status}`)
      })
    realtimeChannels.push(channel)
  } catch (error) {
    console.warn(`Gagal subscribe realtime untuk ${table}:`, error)
  }
}

let syncInterval = null

function initRealtime() {
  if (realtimeEnabled) return
  realtimeEnabled = true
  const tables = [
    DB_KEYS.SPAREPARTS,
    DB_KEYS.SUPPLIERS,
    DB_KEYS.TRANSACTIONS,
    DB_KEYS.STOCK_MOVEMENTS,
    DB_KEYS.SCAN_HISTORY,
    DB_KEYS.USERS
  ]
  tables.forEach(subscribeToTable)

  // Auto-flush pending ops setiap 15 detik
  syncInterval = setInterval(() => {
    flushPendingOps()
  }, 15000)

  // Flush saat tab kembali visible dan saat online
  window.addEventListener('online', handleOnline)
  document.addEventListener('visibilitychange', handleVisibilitySync)

  console.log('[Realtime] Subscribed to all tables')
}

function handleOnline() {
  console.log('[Sync] Koneksi pulih, mengirim pending ops...')
  flushPendingOps()
}

function handleVisibilitySync() {
  if (document.visibilityState === 'visible') {
    // Refresh data dan flush pending saat kembali ke tab
    flushPendingOps()
  }
}

function removeAllRealtime() {
  if (realtimeChannels.length > 0) {
    realtimeChannels.forEach(ch => {
      supabase.removeChannel(ch).catch(() => {})
    })
    realtimeChannels = []
  }
  realtimeEnabled = false

  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
  window.removeEventListener('online', handleOnline)
  document.removeEventListener('visibilitychange', handleVisibilitySync)
}

// ---- Helper untuk localStorage fallback ----
function getLocalData(table) {
  try {
    const key = LS_KEYS[table]
    if (!key) return []
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

function saveLocalData(table, data) {
  try {
    const key = LS_KEYS[table]
    if (!key) return
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.warn(`Gagal menyimpan data ${table} ke localStorage:`, e)
  }
}

function getNextLocalId(table) {
  const data = getLocalData(table)
  const maxId = data.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0)
  const nextId = maxId + 1

  const seq = JSON.parse(localStorage.getItem(LS_SEQUENCE_KEY) || '{}')
  seq[table] = nextId
  localStorage.setItem(LS_SEQUENCE_KEY, JSON.stringify(seq))

  return nextId
}

// ---- Fungsi untuk menandai status Supabase ----
function setSupabaseUnavailable(error) {
  supabaseAvailable = false
  lastSupabaseCheck = Date.now()
  console.warn('Supabase tidak tersedia, beralih ke mode offline:', error?.message || error)
  notifySyncStatus('offline')
}

function setSupabaseAvailable() {
  supabaseAvailable = true
  lastSupabaseCheck = Date.now()
  notifySyncStatus('online')
}

function isSupabaseUsable() {
  if (supabaseAvailable) return true
  // Setelah interval, coba lagi
  return Date.now() - lastSupabaseCheck > SUPABASE_CHECK_INTERVAL
}

function isNetworkError(error) {
  if (!error) return false
  const message = String(error.message || error).toLowerCase()
  return message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error') ||
    message.includes('load failed') ||
    message.includes('fetch failed') ||
    message.includes('connection') ||
    message.includes('could not reach') ||
    message.includes('networkrequestfailed') ||
    error.name === 'TypeError'
}

// Deteksi error Supabase karena setup (tabel belum dibuat, permission denied, dll)
// Error jenis ini tidak fatal -> fallback ke localStorage agar aplikasi tetap bisa dipakai
function isSupabaseSetupError(error) {
  if (!error) return false
  const code = String(error.code || '')
  const message = String(error.message || error).toLowerCase()
  const details = String(error.details || '').toLowerCase()

  return code.startsWith('PGRST') ||
    message.includes('could not find the table') ||
    message.includes('does not exist') ||
    message.includes('permission denied') ||
    message.includes('must be owner') ||
    message.includes('new row violates') ||
    message.includes('invalid input syntax') ||
    message.includes('duplicate key') ||
    details.includes('does not exist') ||
    details.includes('permission denied')
}

// ---- Ambil data segar dari Supabase (tanpa cache) ----
async function getDataFromSupabase(table) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('id', { ascending: true })

  if (error) throw error

  // Konversi dari snake_case ke camelCase
  const mappedData = (data || []).map(item => mapFromDB(table, item))

  // Simpan ke localStorage sebagai cache offline
  saveLocalData(table, mappedData)

  return mappedData
}

// ---- Generic CRUD operations ----

// getAll: SELALU ambil dari Supabase (hanya anti-spam 500ms, bukan cache penuh)
async function getAll(table, options = {}) {
  const { forceRefresh = false } = options

  // Hanya anti-spam: jika request yang sama dilakukan dalam 500ms, gunakan cache
  if (!forceRefresh) {
    const cached = shortCache.get(table)
    if (cached && Date.now() - cached.timestamp < CACHE_SHORT_TTL) {
      return cached.data
    }
  }

  if (isSupabaseUsable()) {
    try {
      const data = await getDataFromSupabase(table)
      setSupabaseAvailable()
      shortCache.set(table, { data, timestamp: Date.now() })
      return data
    } catch (error) {
      if (isNetworkError(error) || isSupabaseSetupError(error)) {
        console.warn(`[DB] Error saat mengambil ${table}, fallback ke localStorage:`, error.message)
        if (isNetworkError(error)) setSupabaseUnavailable(error)
      } else {
        // Error Supabase lain (bukan network/setup) - jangan fallback, ini harus diperbaiki
        console.error(`[DB] Error mengambil ${table}:`, error)
        throw error
      }
    }
  }

  // Fallback ke localStorage (mode offline)
  console.info(`[DB] Menggunakan data ${table} dari localStorage (mode offline)`)
  const localData = getLocalData(table)
  shortCache.set(table, { data: localData, timestamp: Date.now() })
  return localData
}

async function getById(table, id) {
  // Coba Supabase
  if (isSupabaseUsable()) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (data) {
        setSupabaseAvailable()
        return mapFromDB(table, data)
      }
      return null
    } catch (error) {
      if (error.code === 'PGRST116') return null
      if (isNetworkError(error) || isSupabaseSetupError(error)) {
        if (isNetworkError(error)) setSupabaseUnavailable(error)
      } else {
        console.warn(`[DB] Error getById ${table}/${id}:`, error)
        return null
      }
    }
  }

  // Fallback localStorage
  const data = getLocalData(table)
  return data.find(item => Number(item.id) === Number(id)) || null
}

async function insert(table, data) {
  // Coba Supabase
  if (isSupabaseUsable()) {
    try {
      const dbData = mapToDB(table, data)
      const { data: result, error } = await supabase
        .from(table)
        .insert(dbData)
        .select()
        .single()
      if (error) throw error
      setSupabaseAvailable()
      shortCache.delete(table)
      notifyChange(table, 'insert', 'local')
      return mapFromDB(table, result)
    } catch (error) {
      if (isNetworkError(error) || isSupabaseSetupError(error)) {
        if (isNetworkError(error)) setSupabaseUnavailable(error)
      } else {
        console.warn(`[DB] Error insert ke ${table}:`, error)
        throw error // Jangan fallback jika Supabase error (bukan network/setup)
      }
    }
  }

  // Fallback localStorage (mode offline) + queue untuk sync
  const allData = getLocalData(table)
  const newItem = {
    ...data,
    id: getNextLocalId(table),
    createdAt: data.createdAt || new Date().toISOString()
  }
  allData.push(newItem)
  saveLocalData(table, allData)
  queuePendingOperation(table, 'insert', newItem)
  notifyChange(table, 'insert', 'local')
  return newItem
}

async function update(table, id, data) {
  if (isSupabaseUsable()) {
    try {
      const dbData = mapToDB(table, data)
      const { data: result, error } = await supabase
        .from(table)
        .update(dbData)
        .eq('id', id)
        .select()
        .maybeSingle()
      if (error) throw error
      if (!result) throw new Error('Data tidak ditemukan di Supabase')
      setSupabaseAvailable()
      shortCache.delete(table)
      notifyChange(table, 'update', 'local')
      return mapFromDB(table, result)
    } catch (error) {
      if (isNetworkError(error) || isSupabaseSetupError(error)) {
        if (isNetworkError(error)) setSupabaseUnavailable(error)
      } else {
        console.warn(`[DB] Error update ${table}/${id}:`, error)
        throw error
      }
    }
  }

  // Fallback localStorage + simpan untuk sync
  const allData = getLocalData(table)
  const index = allData.findIndex(item => Number(item.id) === Number(id))
  if (index === -1) throw new Error('Data tidak ditemukan')
  allData[index] = { ...allData[index], ...data, id: Number(id) }
  saveLocalData(table, allData)
  queuePendingOperation(table, 'update', { id: Number(id), ...data })
  notifyChange(table, 'update', 'local')
  return allData[index]
}

async function remove(table, id) {
  if (isSupabaseUsable()) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
      if (error) throw error
      setSupabaseAvailable()
      shortCache.delete(table)
      notifyChange(table, 'remove', 'local')
      return true
    } catch (error) {
      if (isNetworkError(error) || isSupabaseSetupError(error)) {
        if (isNetworkError(error)) setSupabaseUnavailable(error)
      } else {
        console.warn(`[DB] Error delete ${table}/${id}:`, error)
        throw error
      }
    }
  }

  // Fallback localStorage
  const allData = getLocalData(table)
  const filtered = allData.filter(item => Number(item.id) !== Number(id))
  saveLocalData(table, filtered)
  queuePendingOperation(table, 'remove', { id: Number(id) })
  notifyChange(table, 'remove', 'local')
  return true
}

// ---- Operasi khusus untuk users & audit_log ----
async function getAllUsers() {
  return getAll(DB_KEYS.USERS)
}

async function findUserByUsername(username) {
  // Coba langsung ke Supabase dulu
  if (isSupabaseUsable()) {
    try {
      const { data, error } = await supabase
        .from(DB_KEYS.USERS)
        .select('*')
        .eq('username', username)
        .maybeSingle()
      if (error) throw error
      if (data) {
        setSupabaseAvailable()
        return mapFromDB(DB_KEYS.USERS, data)
      }
      return null
    } catch (error) {
      if (isNetworkError(error) || isSupabaseSetupError(error)) {
        if (isNetworkError(error)) setSupabaseUnavailable(error)
      } else {
        console.warn(`[DB] Error findUserByUsername "${username}":`, error)
        return null
      }
    }
  }

  // Fallback localStorage
  const users = getLocalData(DB_KEYS.USERS)
  return users.find(u => u.username === username) || null
}

// ---- Pending sync (offline -> online) ----
function getPendingOps() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

function setPendingOps(ops) {
  try {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(ops.slice(-100)))
  } catch (e) {
    console.warn('[DB] Gagal menyimpan antrian pending sync:', e)
  }
}

function queuePendingOperation(table, operation, data) {
  const ops = getPendingOps()
  ops.push({
    table,
    operation,
    data,
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `pending_${Date.now()}_${Math.random()}`,
    created_at: new Date().toISOString()
  })
  setPendingOps(ops)
}

// Jalankan operasi pending saat koneksi pulih
async function flushPendingOps() {
  const ops = getPendingOps()
  if (ops.length === 0) return

  if (!isSupabaseUsable()) return

  console.log(`[Sync] Mengirim ${ops.length} operasi pending ke Supabase...`)

  for (const op of ops) {
    try {
      if (op.operation === 'insert') {
        await supabase.from(op.table).insert(mapToDB(op.table, op.data))
      } else if (op.operation === 'update') {
        await supabase.from(op.table).update(mapToDB(op.table, op.data)).eq('id', op.data.id)
      } else if (op.operation === 'remove' || op.operation === 'delete') {
        await supabase.from(op.table).delete().eq('id', op.data.id)
      }
      // Sukses, hapus dari queue
      const remaining = getPendingOps()
      const filtered = remaining.filter(item => item.id !== op.id)
      setPendingOps(filtered)
    } catch (error) {
      console.warn(`[Sync] Gagal mengirim op ${op.table}/${op.operation}:`, error)
      return // Berhenti jika gagal, akan dicoba lagi nanti
    }
  }

  // Broadcast bahwa sync selesai
  notifySyncStatus('synced')
  window.dispatchEvent(new CustomEvent('app-sync-complete', { detail: { timestamp: Date.now() } }))
}

export const db = {
  keys: DB_KEYS,
  getAll,
  getById,
  insert,
  update,
  remove,
  getAllUsers,
  findUserByUsername,
  clearCache: () => shortCache.clear(),
  changeEvent: DB_CHANGE_EVENT,
  syncEvent: DB_SYNC_EVENT,
  isSupabaseAvailable: () => supabaseAvailable,
  initRealtime,
  removeAllRealtime,
  flushPendingOps,
  getPendingOps,
  setPendingOps
}