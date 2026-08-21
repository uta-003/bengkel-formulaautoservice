// Verifikasi lengkap integrasi Supabase:
// 1. Cek semua tabel yang dipakai aplikasi ada di database
// 2. Cek semua tabel terdaftar di publication supabase_realtime
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dyruuzzrdknwjcjakmif.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_JuFWMmVwsX0ZJQtqt1bVaw_LB9LM-Ef'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Semua tabel yang dipakai aplikasi (sama dengan DB_KEYS di src/services/database.js)
const APP_TABLES = [
  'spareparts', 'suppliers', 'transactions', 'stock_movements', 'scan_history',
  'users', 'audit_log',
  'customers', 'vehicles', 'mechanics', 'service_packages',
  'work_orders', 'wo_items', 'wo_labor', 'warranties', 'invoices', 'vehicle_qr_codes',
  'returns', 'stock_opnames', 'stock_opname_items', 'invoice_payments',
  'insurance_companies', 'insurance_claims', 'claim_items', 'claim_documents', 'claim_status_history'
]

console.log('=== VERIFIKASI INTEGRASI PENUH SUPABASE ===\n')

// 1. Cek keberadaan & aksesibilitas setiap tabel (via REST seperti yang dipakai aplikasi)
console.log('--- Cek Tabel Aplikasi ---')
const missingTables = []
for (const table of APP_TABLES) {
  const { error } = await supabase.from(table).select('*').limit(1)
  if (error) {
    console.log(`[MISSING] ${table} -> ${error.code || ''} | ${error.message}`)
    missingTables.push(table)
  } else {
    console.log(`[OK] ${table}`)
  }
}

// 2. Cek publication realtime
console.log('\n--- Cek Publication supabase_realtime ---')
let realtimeTables = []
{
  // Gunakan endpoint REST untuk membaca pg_publication_tables via RPC tidak tersedia,
  // jadi kita cek dengan mencoba subscribe sederhana per tabel via information schema alternatif:
  // Supabase anon key biasanya bisa query view pg_publication_tables jika diekspos.
  const { data, error } = await supabase
    .from('pg_publication_tables')
    .select('tablename')
    .eq('pubname', 'supabase_realtime')

  if (error) {
    console.log(`[WARN] Tidak bisa membaca pg_publication_tables: ${error.message}`)
    console.log('(Gunakan scripts/check-realtime.mjs untuk cek manual)')
  } else {
    realtimeTables = (data || []).map(r => r.tablename)
    console.log(`Tabel di publication: ${realtimeTables.length}`)
    for (const t of APP_TABLES) {
      if (!realtimeTables.includes(t)) {
        console.log(`[NOT-IN-REALTIME] ${t}`)
      } else {
        console.log(`[REALTIME-OK] ${t}`)
      }
    }
  }
}

// 3. Ringkasan
console.log('\n=== RINGKASAN ===')
if (missingTables.length === 0) {
  console.log('[PASS] Semua 26 tabel aplikasi ada dan dapat diakses.')
} else {
  console.log(`[FAIL] ${missingTables.length} tabel hilang: ${missingTables.join(', ')}`)
  console.log('Jalankan SQL schema yang sesuai (feature_schema.sql / insurance_schema.sql).')
}