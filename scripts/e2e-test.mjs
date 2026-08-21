// Uji end-to-end multi-perangkat:
// 1. Perangkat A menulis data
// 2. Perangkat B membaca data yang sama
// 3. Verifikasi keduanya identik (tidak ada selisih)
const SUPABASE_URL = 'https://dyruuzzrdknwjcjakmif.supabase.co'
const KEY = 'sb_publishable_JuFWMmVwsX0ZJQtqt1bVaw_LB9LM-Ef'

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json'
}
const insertHeaders = { ...headers, Prefer: 'return=representation' }

async function main() {
  console.log('=== UJI MULTI-PERANGKAT ===')

  // --- PERANGKAT A: insert data baru ---
  const testData = {
    kode: `TEST-${Date.now()}`,
    nama: 'Sparepart Uji Sinkronisasi',
    kategori: 'Uji',
    merk: 'Test',
    harga_beli: 10000,
    harga_jual: 15000,
    stok: 5,
    stok_minimum: 2,
    satuan: 'pcs'
  }
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/spareparts`, {
    method: 'POST',
    headers: insertHeaders,
    body: JSON.stringify(testData)
  })
  if (!insertRes.ok) {
    console.error('Gagal insert:', await insertRes.text())
    process.exit(1)
  }
  const inserted = (await insertRes.json())[0]
  console.log(`[Perangkat A] Insert OK -> id=${inserted.id}, kode=${inserted.kode}, stok=${inserted.stok}`)

  // --- PERANGKAT B: baca data yang sama ---
  const readRes = await fetch(`${SUPABASE_URL}/rest/v1/spareparts?id=eq.${inserted.id}&select=*`, { headers })
  const readData = await readRes.json()
  const same = readData.length === 1 &&
    readData[0].kode === inserted.kode &&
    Number(readData[0].stok) === Number(inserted.stok) &&
    readData[0].nama === inserted.nama
  console.log(`[Perangkat B] Baca OK -> ${JSON.stringify(readData[0])}`)
  console.log(same ? '>>> SINKRON: data di kedua perangkat IDENTIK, tidak ada selisih' : '>>> TIDAK SINKRON!')

  // --- Update dari Perangkat B, cek dari Perangkat A ---
  const updRes = await fetch(`${SUPABASE_URL}/rest/v1/spareparts?id=eq.${inserted.id}`, {
    method: 'PATCH',
    headers: insertHeaders,
    body: JSON.stringify({ stok: 99 })
  })
  if (!updRes.ok) {
    console.error('Gagal update:', await updRes.text())
  } else {
    const recheck = await (await fetch(`${SUPABASE_URL}/rest/v1/spareparts?id=eq.${inserted.id}&select=stok`, { headers })).json()
    console.log(`[Perangkat B update stok=99] [Perangkat A lihat stok=${recheck[0]?.stok}] ${recheck[0]?.stok == 99 ? '>>> UPDATE TERSINKRON' : '>>> GAGAL SYNC'}`)
  }

  // --- Cleanup ---
  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/spareparts?id=eq.${inserted.id}`, {
    method: 'DELETE', headers
  })
  console.log(delRes.ok ? '[Cleanup] Data uji dihapus' : '[Cleanup] Gagal hapus')
}

main()