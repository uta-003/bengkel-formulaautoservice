// Database layer menggunakan Supabase sebagai sumber data utama
// Tabel: spareparts, suppliers, transactions, stock_movements, users, audit_log
// Fallback ke localStorage jika Supabase tidak tersedia

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

// In-memory cache untuk mengurangi fetch berulang ke Supabase
const cache = new Map()
const CACHE_TTL = 10000 // 10 detik

function getCached(table) {
  const entry = cache.get(table)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(table)
    return null
  }
  return entry.data
}

function setCached(table, data) {
  cache.set(table, { data, timestamp: Date.now() })
}

function clearCache(table) {
  if (table) {
    cache.delete(table)
  } else {
    cache.clear()
  }
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

// Flag status koneksi Supabase
let supabaseAvailable = true
let lastSupabaseCheck = 0
const SUPABASE_CHECK_INTERVAL = 30000 // 30 detik

// Event yang dipancarkan setiap kali data berubah
const DB_CHANGE_EVENT = 'db-updated'

function notifyChange(table, operation) {
  clearCache(table)
  window.dispatchEvent(new CustomEvent(DB_CHANGE_EVENT, {
    detail: { table, operation, timestamp: Date.now() }
  }))
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

  // Simpan ID berikutnya untuk konsistensi
  const seqKey = `${LS_PREFIX}sequence`
  const seq = JSON.parse(localStorage.getItem(seqKey) || '{}')
  seq[table] = nextId
  localStorage.setItem(seqKey, JSON.stringify(seq))

  return nextId
}

// ---- Fungsi untuk menandai status Supabase ----
function setSupabaseUnavailable(error) {
  supabaseAvailable = false
  lastSupabaseCheck = Date.now()
  console.warn('Supabase tidak tersedia, beralih ke mode localStorage:', error?.message || error)
}

function setSupabaseAvailable() {
  supabaseAvailable = true
  lastSupabaseCheck = Date.now()
}

function isSupabaseUsable() {
  if (supabaseAvailable) return true
  // Setelah interval, coba lagi
  return Date.now() - lastSupabaseCheck > SUPABASE_CHECK_INTERVAL
}

// Cek apakah error adalah "Failed to fetch" (network error) atau error Supabase lain
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

// ---- Generic CRUD operations ----
async function getAll(table) {
  // Cek cache dulu
  const cached = getCached(table)
  if (cached) return cached

  // Coba Supabase dulu jika dianggap tersedia
  if (isSupabaseUsable()) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('id', { ascending: true })
      if (error) throw error
      if (data) {
        setSupabaseAvailable()
        // Konversi dari snake_case ke camelCase
        const mappedData = data.map(item => mapFromDB(table, item))
        // Simpan ke localStorage sebagai cache
        saveLocalData(table, mappedData)
        // Simpan ke in-memory cache
        setCached(table, mappedData)
        return mappedData
      }
    } catch (error) {
      if (isNetworkError(error)) {
        console.warn(`Network error saat mengambil ${table}:`, error.message)
      }
      setSupabaseUnavailable(error)
    }
  }

  // Fallback ke localStorage
  console.info(`Menggunakan data ${table} dari localStorage (mode offline)`)
  const localData = getLocalData(table)
  setCached(table, localData)
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
        .single()
      if (error) {
        if (error.code === 'PGRST116') return null // not found
        throw error
      }
      setSupabaseAvailable()
      return mapFromDB(table, data)
    } catch (error) {
      if (error.code === 'PGRST116') return null
      setSupabaseUnavailable(error)
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
      // Konversi dari camelCase ke snake_case untuk Supabase
      const dbData = mapToDB(table, data)
      const { data: result, error } = await supabase
        .from(table)
        .insert(dbData)
        .select()
        .single()
      if (error) throw error
      setSupabaseAvailable()
      notifyChange(table, 'insert')
      return mapFromDB(table, result)
    } catch (error) {
      setSupabaseUnavailable(error)
    }
  }

  // Fallback localStorage
  const allData = getLocalData(table)
  const newItem = {
    ...data,
    id: getNextLocalId(table),
    createdAt: data.createdAt || new Date().toISOString()
  }
  allData.push(newItem)
  saveLocalData(table, allData)
  notifyChange(table, 'insert')
  return newItem
}

async function update(table, id, data) {
  // Coba Supabase
  if (isSupabaseUsable()) {
    try {
      // Konversi dari camelCase ke snake_case untuk Supabase
      const dbData = mapToDB(table, data)
      const { data: result, error } = await supabase
        .from(table)
        .update(dbData)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      setSupabaseAvailable()
      notifyChange(table, 'update')
      return mapFromDB(table, result)
    } catch (error) {
      setSupabaseUnavailable(error)
    }
  }

  // Fallback localStorage
  const allData = getLocalData(table)
  const index = allData.findIndex(item => Number(item.id) === Number(id))
  if (index === -1) throw new Error('Data tidak ditemukan')
  allData[index] = { ...allData[index], ...data, id: Number(id) }
  saveLocalData(table, allData)
  notifyChange(table, 'update')
  return allData[index]
}

async function remove(table, id) {
  // Coba Supabase
  if (isSupabaseUsable()) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
      if (error) throw error
      setSupabaseAvailable()
      notifyChange(table, 'remove')
      return true
    } catch (error) {
      setSupabaseUnavailable(error)
    }
  }

  // Fallback localStorage
  const allData = getLocalData(table)
  const filtered = allData.filter(item => Number(item.id) !== Number(id))
  saveLocalData(table, filtered)
  notifyChange(table, 'remove')
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
    } catch (error) {
      setSupabaseUnavailable(error)
    }
  }

  // Fallback localStorage
  const users = getLocalData(DB_KEYS.USERS)
  return users.find(u => u.username === username) || null
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
  clearCache,
  changeEvent: DB_CHANGE_EVENT,
  isSupabaseAvailable: () => supabaseAvailable
}