// Diagnosa: bandingkan daftar tabel aktual di database vs yang terlihat via REST API
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const PROJECT_REF = 'dyruuzzrdknwjcjakmif'

async function runQuery(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  })
  return { ok: res.ok, body: await res.json() }
}

console.log('=== DAFTAR TABEL AKTUAL DI SCHEMA PUBLIC (via SQL) ===')
const r = await runQuery(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`)
if (r.ok) {
  console.log(`Total tabel di schema public: ${r.body.length}`)
  for (const row of r.body) console.log(`- ${row.table_name}`)
} else {
  console.error('Gagal:', JSON.stringify(r.body))
}