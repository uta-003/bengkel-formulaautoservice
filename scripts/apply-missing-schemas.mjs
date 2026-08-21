// Menjalankan feature_schema.sql & insurance_schema.sql ke database Supabase
// agar semua tabel fitur (retur, stock opname, pembayaran invoice, klaim asuransi)
// benar-benar ada di database dan terdaftar di realtime publication.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const PROJECT_REF = 'dyruuzzrdknwjcjakmif'
const __dirname = dirname(fileURLToPath(import.meta.url))

async function runQuery(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  })
  return { ok: res.ok, body: await res.json() }
}

const SCHEMAS = [
  join(__dirname, '..', 'supabase', 'feature_schema.sql'),
  join(__dirname, '..', 'supabase', 'insurance_schema.sql')
]

console.log('=== TERAPKAN SCHEMA YANG HILANG ===\n')

for (const path of SCHEMAS) {
  const name = path.split(/[\\/]/).pop()
  console.log(`--- Menjalankan ${name} ---`)
  const sql = readFileSync(path, 'utf8')
  const r = await runQuery(sql)
  if (r.ok) {
    console.log(`[OK] ${name} berhasil dijalankan`)
  } else {
    console.error(`[FAILED] ${name}:`, JSON.stringify(r.body))
    process.exit(1)
  }
}

// Verifikasi akhir: cek semua tabel aplikasi
const APP_TABLES = [
  'spareparts', 'suppliers', 'transactions', 'stock_movements', 'scan_history',
  'users', 'audit_log',
  'customers', 'vehicles', 'mechanics', 'service_packages',
  'work_orders', 'wo_items', 'wo_labor', 'warranties', 'invoices', 'vehicle_qr_codes',
  'returns', 'stock_opnames', 'stock_opname_items', 'invoice_payments',
  'insurance_companies', 'insurance_claims', 'claim_items', 'claim_documents', 'claim_status_history'
]

console.log('\n=== VERIFIKASI TABEL ===')
const check = await runQuery(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
`)
if (check.ok) {
  const existing = new Set(check.body.map(r => r.table_name))
  let missing = 0
  for (const t of APP_TABLES) {
    if (!existing.has(t)) {
      console.log(`[MISSING] ${t}`)
      missing += 1
    }
  }
  console.log(missing === 0
    ? `\n[PASS] Semua ${APP_TABLES.length} tabel aplikasi sekarang ada di database.`
    : `\n[FAIL] Masih ada ${missing} tabel yang hilang.`)

  // Cek publication realtime
  const pub = await runQuery(`SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename`)
  if (pub.ok) {
    const pubTables = new Set(pub.body.map(r => r.tablename))
    console.log(`\nTabel di realtime publication: ${pubTables.size}`)
    let pubMissing = 0
    for (const t of APP_TABLES) {
      if (!pubTables.has(t)) {
        console.log(`[NOT-IN-REALTIME] ${t}`)
        pubMissing += 1
      }
    }
    console.log(pubMissing === 0
      ? '[PASS] Semua tabel terdaftar di realtime publication.'
      : `[WARN] ${pubMissing} tabel belum di publication.`)
  }
} else {
  console.error('Gagal verifikasi:', JSON.stringify(check.body))
}