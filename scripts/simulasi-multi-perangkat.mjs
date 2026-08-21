// ============================================================
// SIMULASI NYATA MULTI-PERANGKAT (meniru persis alur aplikasi)
// Perangkat A input "A" -> Supabase -> Perangkat B buka -> lihat "A"
// Menggunakan field mapping yang sama dengan src/services/database.js
// ============================================================
const SUPABASE_URL = 'https://dyruuzzrdknwjcjakmif.supabase.co'
const KEY = 'sb_publishable_JuFWMmVwsX0ZJQtqt1bVaw_LB9LM-Ef'

// Field mapping sama seperti database.js (spareparts)
const MAPPING = {
  supplierId: 'supplier_id',
  hargaBeli: 'harga_beli',
  hargaJual: 'harga_jual',
  stokMinimum: 'stok_minimum',
  createdAt: 'created_at'
}
function mapToDB(data) {
  const r = {}
  for (const [k, v] of Object.entries(data)) r[MAPPING[k] || k] = v
  return r
}
function mapFromDB(data) {
  const rev = {}
  for (const [camel, snake] of Object.entries(MAPPING)) rev[snake] = camel
  const r = {}
  for (const [k, v] of Object.entries(data)) r[rev[k] || k] = v
  return r
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
}

async function main() {
  console.log('=== SIMULASI: INPUT "A" DI PERANGKAT SATU, DIBUKA DI PERANGKAT LAIN ===\n')

  // ===== PERANGKAT A: user isi form sparepart bernama "A" =====
  // (persis seperti Sparepart.jsx -> sparepartService.create -> db.insert)
  const formInput = {
    nama: 'A',
    kategori: 'Uji Sinkron',
    merk: 'TestBrand',
    hargaBeli: 1000,
    hargaJual: 2000,
    stok: 7,
    stokMinimum: 3,
    satuan: 'pcs',
    lokasi: 'Rak Test'
  }
  console.log('[PERANGKAT A] User mengisi form & klik Simpan:')
  console.log('   ', JSON.stringify(formInput))

  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/spareparts`, {
    method: 'POST', headers, body: JSON.stringify(mapToDB(formInput))
  })
  if (!insRes.ok) { console.error('GAGAL insert:', await insRes.text()); process.exit(1) }
  const savedInDB = mapFromDB((await insRes.json())[0])
  console.log(`[DATABASE SUPABASE] Tersimpan permanen dengan id=${savedInDB.id}`)

  // ===== PERANGKAT B: orang lain membuka aplikasi (fresh load) =====
  // (persis seperti db.getAll -> GET /rest/v1/spareparts?select=*&order=id.asc)
  console.log('\n[PERANGKAT B] Orang lain membuka aplikasi, aplikasi memuat data dari Supabase...')
  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/spareparts?select=*&order=id.asc`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  })
  const allItems = (await listRes.json()).map(mapFromDB)
  const seenByB = allItems.find(i => i.id === savedInDB.id)

  console.log('[PERANGKAT B] Yang terlihat di layar:')
  console.log('   ', JSON.stringify({ nama: seenByB.nama, kategori: seenByB.kategori, merk: seenByB.merk, hargaBeli: Number(seenByB.hargaBeli), hargaJual: Number(seenByB.hargaJual), stok: seenByB.stok, stokMinimum: seenByB.stokMinimum, satuan: seenByB.satuan, lokasi: seenByB.lokasi }))

  const identical =
    seenByB.nama === formInput.nama &&
    seenByB.kategori === formInput.kategori &&
    seenByB.merk === formInput.merk &&
    Number(seenByB.hargaBeli) === formInput.hargaBeli &&
    Number(seenByB.hargaJual) === formInput.hargaJual &&
    Number(seenByB.stok) === formInput.stok &&
    Number(seenByB.stokMinimum) === formInput.stokMinimum &&
    seenByB.satuan === formInput.satuan &&
    seenByB.lokasi === formInput.lokasi

  console.log(identical
    ? '\n>>> HASIL: Input "A" di Perangkat A TAMPIL PERSIS "A" di Perangkat B - TIDAK ADA SELISIH <<<'
    : '\n>>> HASIL: ADA SELISIH! <<<')

  // ===== Uji realtime event: update stok dari Perangkat B =====
  console.log('\n[BONUS] Perangkat B mengubah stok jadi 100...')
  await fetch(`${SUPABASE_URL}/rest/v1/spareparts?id=eq.${savedInDB.id}`, {
    method: 'PATCH', headers, body: JSON.stringify({ stok: 100 })
  })
  const recheck = (await (await fetch(`${SUPABASE_URL}/rest/v1/spareparts?id=eq.${savedInDB.id}&select=stok`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json())
  console.log(`[PERANGKAT A] Stok yang dilihat sekarang: ${recheck[0]?.stok} (realtime event akan memicu refresh otomatis di aplikasi)`)

  // ===== Cleanup =====
  await fetch(`${SUPABASE_URL}/rest/v1/spareparts?id=eq.${savedInDB.id}`, { method: 'DELETE', headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  console.log('\n[Cleanup] Data uji dihapus dari database.')
}

main()