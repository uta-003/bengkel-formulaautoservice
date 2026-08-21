// Dump isi tabel utama untuk inspeksi
const SUPABASE_URL = 'https://dyruuzzrdknwjcjakmif.supabase.co'
const KEY = 'sb_publishable_JuFWMmVwsX0ZJQtqt1bVaw_LB9LM-Ef'

async function dump(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=id.asc`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  })
  const data = await res.json()
  console.log(`\n--- ${table} (${data.length} baris) ---`)
  for (const row of data) {
    console.log(JSON.stringify(row))
  }
}

const TABLES = process.argv.slice(2)
for (const t of (TABLES.length ? TABLES : ['suppliers', 'spareparts', 'transactions'])) {
  await dump(t)
}