// Menambahkan tabel yang belum terdaftar ke publication supabase_realtime
// agar realtime sync berfungsi untuk SEMUA data aplikasi.
// Aman & idempotent: hanya ADD TABLE (jika sudah ada akan di-skip).
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

// Tabel yang dipakai aplikasi untuk realtime (semua kecuali audit_log)
const REQUIRED_TABLES = [
  'spareparts', 'suppliers', 'transactions', 'stock_movements', 'scan_history', 'users',
  'customers', 'vehicles', 'mechanics', 'service_packages',
  'work_orders', 'wo_items', 'wo_labor', 'warranties', 'invoices', 'vehicle_qr_codes',
  'returns', 'stock_opnames', 'stock_opname_items', 'invoice_payments',
  'insurance_companies', 'insurance_claims', 'claim_items', 'claim_documents', 'claim_status_history'
]

console.log('=== PERBAIKI REALTIME PUBLICATION ===\n')

// 1. Baca daftar tabel yang sudah ada di publication
const current = await runQuery(`SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'`)
if (!current.ok) {
  console.error('Gagal membaca publication:', JSON.stringify(current.body))
  process.exit(1)
}
const existing = new Set(current.body.map(r => r.tablename))
console.log(`Tabel saat ini di publication: ${existing.size}`)

// 2. Tambahkan tabel yang belum terdaftar
let added = 0
for (const table of REQUIRED_TABLES) {
  if (existing.has(table)) continue
  const r = await runQuery(`ALTER PUBLICATION supabase_realtime ADD TABLE public.${table}`)
  if (r.ok) {
    console.log(`[ADDED] ${table}`)
    added += 1
  } else {
    console.log(`[FAILED] ${table} -> ${JSON.stringify(r.body)}`)
  }
}

// 3. Verifikasi akhir
const final = await runQuery(`SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename`)
if (final.ok) {
  const finalTables = new Set(final.body.map(r => r.tablename))
  console.log(`\nTotal tabel di publication sekarang: ${finalTables.size}`)
  let allOk = true
  for (const t of REQUIRED_TABLES) {
    if (!finalTables.has(t)) {
      console.log(`[STILL-MISSING] ${t}`)
      allOk = false
    }
  }
  if (allOk) {
    console.log('\n[PASS] Semua tabel aplikasi kini terdaftar di realtime publication.')
  }
} else {
  console.error('Gagal verifikasi akhir:', JSON.stringify(final.body))
}