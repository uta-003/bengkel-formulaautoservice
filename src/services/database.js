// Simulasi Database Relasional menggunakan localStorage
// Struktur tabel: spareparts, suppliers, transactions, stock_movements

const DB_KEYS = {
  SPAREPARTS: 'spareparts',
  SUPPLIERS: 'suppliers',
  TRANSACTIONS: 'transactions',
  STOCK_MOVEMENTS: 'stock_movements',
  SEQUENCE: 'sequence_counter'
}

// Inisialisasi data awal
const seedData = {
  suppliers: [
    {
      id: 1,
      kode: 'SUP-001',
      nama: 'PT Sumber Jaya Motor',
      alamat: 'Jl. Raya Cikarang No. 45, Bekasi',
      telepon: '021-88901234',
      email: 'sales@sumberjaya.co.id',
      kontak: 'Budi Santoso',
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      kode: 'SUP-002',
      nama: 'CV Auto Parts Indonesia',
      alamat: 'Jl. Gatot Subroto No. 12, Jakarta',
      telepon: '021-56781234',
      email: 'info@autoparts.co.id',
      kontak: 'Siti Rahayu',
      createdAt: new Date().toISOString()
    },
    {
      id: 3,
      kode: 'SUP-003',
      nama: 'PT Mitra Sparepart Nusantara',
      alamat: 'Jl. Ahmad Yani No. 78, Bandung',
      telepon: '022-45678901',
      email: 'cs@mitrasparepart.co.id',
      kontak: 'Agus Wijaya',
      createdAt: new Date().toISOString()
    }
  ],
  spareparts: [
    {
      id: 1,
      kode: 'SPR-001',
      nama: 'Oli Mesin 1L',
      kategori: 'Pelumas',
      merk: 'Shell',
      supplierId: 1,
      hargaBeli: 45000,
      hargaJual: 55000,
      stok: 25,
      stokMinimum: 10,
      lokasi: 'Rak A-1',
      barcode: '8991234567890',
      satuan: 'liter',
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      kode: 'SPR-002',
      nama: 'Filter Udara',
      kategori: 'Filter',
      merk: 'Denso',
      supplierId: 2,
      hargaBeli: 35000,
      hargaJual: 45000,
      stok: 8,
      stokMinimum: 15,
      lokasi: 'Rak B-2',
      barcode: '8991234567891',
      satuan: 'pcs',
      createdAt: new Date().toISOString()
    },
    {
      id: 3,
      kode: 'SPR-003',
      nama: 'Busi Iridium',
      kategori: 'Kelistrikan',
      merk: 'NGK',
      supplierId: 1,
      hargaBeli: 60000,
      hargaJual: 75000,
      stok: 30,
      stokMinimum: 12,
      lokasi: 'Rak C-1',
      barcode: '8991234567892',
      satuan: 'pcs',
      createdAt: new Date().toISOString()
    },
    {
      id: 4,
      kode: 'SPR-004',
      nama: 'Kampas Rem Depan',
      kategori: 'Rem',
      merk: 'Aisin',
      supplierId: 3,
      hargaBeli: 120000,
      hargaJual: 150000,
      stok: 5,
      stokMinimum: 8,
      lokasi: 'Rak D-3',
      barcode: '8991234567893',
      satuan: 'set',
      createdAt: new Date().toISOString()
    },
    {
      id: 5,
      kode: 'SPR-005',
      nama: 'Aki 35Ah',
      kategori: 'Kelistrikan',
      merk: 'GS Astra',
      supplierId: 2,
      hargaBeli: 350000,
      hargaJual: 420000,
      stok: 12,
      stokMinimum: 5,
      lokasi: 'Rak E-1',
      barcode: '8991234567894',
      satuan: 'unit',
      createdAt: new Date().toISOString()
    }
  ],
  transactions: [],
  stock_movements: []
}

function getSequence(key) {
  const seq = JSON.parse(localStorage.getItem(DB_KEYS.SEQUENCE) || '{}')
  const next = (seq[key] || 0) + 1
  seq[key] = next
  localStorage.setItem(DB_KEYS.SEQUENCE, JSON.stringify(seq))
  return next
}

function initDB() {
  if (!localStorage.getItem(DB_KEYS.SPAREPARTS)) {
    localStorage.setItem(DB_KEYS.SPAREPARTS, JSON.stringify(seedData.spareparts))
  }
  if (!localStorage.getItem(DB_KEYS.SUPPLIERS)) {
    localStorage.setItem(DB_KEYS.SUPPLIERS, JSON.stringify(seedData.suppliers))
  }
  if (!localStorage.getItem(DB_KEYS.TRANSACTIONS)) {
    localStorage.setItem(DB_KEYS.TRANSACTIONS, JSON.stringify([]))
  }
  if (!localStorage.getItem(DB_KEYS.STOCK_MOVEMENTS)) {
    localStorage.setItem(DB_KEYS.STOCK_MOVEMENTS, JSON.stringify([]))
  }
}

// Generic CRUD operations
function getAll(table) {
  return JSON.parse(localStorage.getItem(table) || '[]')
}

function getById(table, id) {
  return getAll(table).find(item => item.id === id)
}

function insert(table, data) {
  const items = getAll(table)
  const newItem = { ...data, id: getSequence(table) }
  items.push(newItem)
  localStorage.setItem(table, JSON.stringify(items))
  return newItem
}

function update(table, id, data) {
  const items = getAll(table)
  const index = items.findIndex(item => item.id === id)
  if (index !== -1) {
    items[index] = { ...items[index], ...data }
    localStorage.setItem(table, JSON.stringify(items))
    return items[index]
  }
  return null
}

function remove(table, id) {
  const items = getAll(table)
  const filtered = items.filter(item => item.id !== id)
  localStorage.setItem(table, JSON.stringify(filtered))
  return filtered
}

function resetDB() {
  localStorage.removeItem(DB_KEYS.SPAREPARTS)
  localStorage.removeItem(DB_KEYS.SUPPLIERS)
  localStorage.removeItem(DB_KEYS.TRANSACTIONS)
  localStorage.removeItem(DB_KEYS.STOCK_MOVEMENTS)
  localStorage.removeItem(DB_KEYS.SEQUENCE)
  initDB()
}

export const db = {
  keys: DB_KEYS,
  init: initDB,
  getAll,
  getById,
  insert,
  update,
  remove,
  reset: resetDB,
  getSequence
}