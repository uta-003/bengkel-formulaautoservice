// Eksekusi setup.sql ke Supabase via Management API
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const PROJECT_REF = 'dyruuzzrdknwjcjakmif' // project "gudangbengkel" - database tunggal aplikasi

async function runQuery(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, ok: res.ok, body }
}

async function main() {
  console.log(`Target project: ${PROJECT_REF}`)

  // 1. Verifikasi token & project
  const listRes = await fetch('https://api.supabase.com/v1/projects', {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
  })
  if (!listRes.ok) {
    console.error('Gagal verifikasi token:', await listRes.text())
    process.exit(1)
  }
  const projects = await listRes.json()
  const target = projects.find(p => p.id === PROJECT_REF)
  console.log('Token valid. Project ditemukan:', target ? `${target.name} (${target.region})` : 'TIDAK DITEMUKAN')
  if (!target) process.exit(1)

  // 2. Baca file SQL
  const sqlPath = join(__dirname, '..', 'supabase', 'setup.sql')
  const sql = readFileSync(sqlPath, 'utf8')
  console.log(`Membaca ${sqlPath} (${sql.length} karakter)`)

  // 3. Eksekusi SQL
  console.log('Menjalankan setup.sql ...')
  const result = await runQuery(sql)
  if (result.ok) {
    console.log('=== SUKSES: setup.sql berhasil dijalankan ===')
    console.log(JSON.stringify(result.body, null, 2).slice(0, 2000))
  } else {
    console.error('=== GAGAL ===')
    console.error('Status:', result.status)
    console.error(JSON.stringify(result.body, null, 2).slice(0, 3000))
    process.exit(1)
  }
}

main()