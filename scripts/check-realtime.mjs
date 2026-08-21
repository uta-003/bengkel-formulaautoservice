// Verifikasi realtime publication di database
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

const r = await runQuery(`SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename`)
if (r.ok) {
  console.log('=== REALTIME PUBLICATION (supabase_realtime) ===')
  for (const row of r.body) console.log(`- ${row.schemaname}.${row.tablename}`)
  console.log(`Total tabel realtime: ${r.body.length}`)
} else {
  console.error('Gagal:', JSON.stringify(r.body))
}