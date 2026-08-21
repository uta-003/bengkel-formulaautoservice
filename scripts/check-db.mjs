// Script untuk memeriksa status tabel di Supabase
const SUPABASE_URL = 'https://dyruuzzrdknwjcjakmif.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_JuFWMmVwsX0ZJQtqt1bVaw_LB9LM-Ef'

const TABLES = [
  'suppliers', 'spareparts', 'transactions', 'stock_movements',
  'scan_history', 'users', 'audit_log',
  'customers', 'vehicles', 'mechanics', 'service_packages',
  'work_orders', 'wo_items', 'wo_labor', 'warranties',
  'invoices', 'vehicle_qr_codes'
]

async function checkTable(table) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    })
    if (res.ok) {
      const data = await res.json()
      return { table, exists: true, rows: data.length, sample: data[0] || null }
    } else {
      const err = await res.json()
      return { table, exists: false, error: err.message }
    }
  } catch (e) {
    return { table, exists: false, error: e.message }
  }
}

async function main() {
  console.log('=== CEK STATUS TABEL SUPABASE ===')
  for (const t of TABLES) {
    const result = await checkTable(t)
    if (result.exists) {
      console.log(`[OK] ${t} - ada (sample rows: ${result.rows})`)
    } else {
      console.log(`[MISSING] ${t} - ${result.error}`)
    }
  }
}

main()